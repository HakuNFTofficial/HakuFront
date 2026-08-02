#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  http,
  isAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  ARC_CHAIN_ID,
  EXPECTED_OWNER,
  HUKUNFT_ABI,
  HUKUNFT_PROXY,
  IMPLEMENTATION_SLOT,
  assertBaselineSnapshot,
  assertUpgradeConfirmations,
  assertUpgradedSnapshot,
  buildUpgradeCalldata,
  calldataSha256,
  decodeUpgradeCalldata,
  readProxySnapshot,
} from './hukunft-metadata-v2-lib.mjs'

const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Network Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['http://invalid.local'] } },
})

function requireRpcUrl(env) {
  if (!env.ARC_RPC_URL) throw new Error('ARC_RPC_URL is required')
  return env.ARC_RPC_URL
}

function ownerAccount(env) {
  if (!env.PRIVATE_KEY) throw new Error('PRIVATE_KEY is required for this command')
  const normalized = env.PRIVATE_KEY.startsWith('0x') ? env.PRIVATE_KEY : `0x${env.PRIVATE_KEY}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) throw new Error('PRIVATE_KEY has an invalid format')
  const account = privateKeyToAccount(normalized)
  if (getAddress(account.address) !== getAddress(EXPECTED_OWNER)) {
    throw new Error(`Signer account mismatch: expected ${EXPECTED_OWNER}, received ${account.address}`)
  }
  return account
}

function clients(env, needsSigner) {
  const rpcUrl = requireRpcUrl(env)
  const transport = http(rpcUrl)
  const publicClient = createPublicClient({ chain: arcTestnet, transport, batch: { multicall: false } })
  if (!needsSigner) return { publicClient }
  const account = ownerAccount(env)
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport })
  return { account, publicClient, walletClient }
}

function requiredImplementation(value) {
  if (!value || !isAddress(value)) throw new Error('A valid NEW_IMPLEMENTATION address is required')
  return getAddress(value)
}

async function assertImplementation(publicClient, implementation) {
  const code = await publicClient.getCode({ address: implementation })
  if (!code || code === '0x') throw new Error(`New implementation has no code: ${implementation}`)
  const uuid = await publicClient.readContract({
    address: implementation,
    abi: HUKUNFT_ABI,
    functionName: 'proxiableUUID',
  })
  if (uuid.toLowerCase() !== IMPLEMENTATION_SLOT) {
    throw new Error(`New implementation proxiableUUID mismatch: ${uuid}`)
  }
}

async function snapshotCommand(env) {
  const { publicClient } = clients(env, false)
  const snapshot = await readProxySnapshot(publicClient)
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`)
  return snapshot
}

async function deployCommand(env) {
  const { account, publicClient, walletClient } = clients(env, true)
  const baseline = await readProxySnapshot(publicClient)
  assertBaselineSnapshot(baseline, account.address)
  const artifact = JSON.parse(readFileSync(resolve('out/HukuNFT.sol/HukuNFT.json'), 'utf8'))
  if (!artifact.bytecode?.object?.startsWith('0x')) throw new Error('HukuNFT deployment bytecode is missing; run forge build')
  const transactionHash = await walletClient.deployContract({
    account,
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash })
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`Implementation deployment failed: ${transactionHash}`)
  await assertImplementation(publicClient, receipt.contractAddress)
  const result = {
    action: 'deploy-implementation-only',
    implementation: receipt.contractAddress,
    transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    proxyTouched: false,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result
}

async function prepareUpgradeCommand(env, implementation) {
  const { account, publicClient } = clients(env, true)
  const baseline = await readProxySnapshot(publicClient)
  assertBaselineSnapshot(baseline, account.address)
  await assertImplementation(publicClient, implementation)
  const calldata = buildUpgradeCalldata(implementation)
  const result = {
    action: 'prepare-upgrade',
    chainId: baseline.chainId,
    signer: account.address,
    to: HUKUNFT_PROXY,
    value: '0',
    calldata,
    calldataSha256: calldataSha256(calldata),
    decoded: decodeUpgradeCalldata(calldata),
    currentImplementation: baseline.implementation,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result
}

async function upgradeCommand(env, implementation) {
  const { account, publicClient, walletClient } = clients(env, true)
  const calldata = buildUpgradeCalldata(implementation)
  assertUpgradeConfirmations({ env, newImplementation: implementation, calldata })
  const baseline = await readProxySnapshot(publicClient)
  assertBaselineSnapshot(baseline, account.address)
  await assertImplementation(publicClient, implementation)

  const transactionHash = await walletClient.sendTransaction({
    account,
    to: HUKUNFT_PROXY,
    data: calldata,
    value: 0n,
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash })
  if (receipt.status !== 'success') throw new Error(`Proxy upgrade failed: ${transactionHash}`)
  const snapshot = await readProxySnapshot(publicClient)
  assertUpgradedSnapshot(snapshot, implementation)
  const result = {
    action: 'upgrade-proxy',
    implementation,
    calldataSha256: calldataSha256(calldata),
    transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    verifiedSnapshot: snapshot,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const [command, implementationArg, ...extra] = argv
  if (extra.length > 0) throw new Error('Unexpected extra arguments')
  if (command === 'snapshot' && implementationArg === undefined) return snapshotCommand(env)
  if (command === 'deploy' && implementationArg === undefined) return deployCommand(env)
  if (command === 'prepare-upgrade') return prepareUpgradeCommand(env, requiredImplementation(implementationArg))
  if (command === 'upgrade') return upgradeCommand(env, requiredImplementation(implementationArg))
  throw new Error('Usage: deploy-hukunft-metadata-v2.mjs snapshot|deploy|prepare-upgrade NEW_IMPLEMENTATION|upgrade NEW_IMPLEMENTATION')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`HukuNFT deployment command failed: ${error.message}\n`)
    process.exitCode = 1
  })
}
