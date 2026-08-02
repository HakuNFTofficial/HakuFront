#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, defineChain, getAddress, http, isAddress } from 'viem'
import {
  ARC_CHAIN_ID,
  assertBaselineSnapshot,
  assertUpgradedSnapshot,
  readProxySnapshot,
} from './hukunft-metadata-v2-lib.mjs'

const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: 'Arc Network Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['http://invalid.local'] } },
})

export async function main(argv = process.argv.slice(2), env = process.env) {
  if (!env.ARC_RPC_URL) throw new Error('ARC_RPC_URL is required')
  const [mode, value, outputArg, ...extra] = argv
  if (extra.length > 0) throw new Error('Unexpected extra arguments')
  let implementation
  let outputPath
  if (mode === 'baseline') {
    if (outputArg !== undefined) throw new Error('Unexpected extra arguments for baseline mode')
    outputPath = value ?? 'deployments/arc-testnet/HukuNFT-metadata-v2-baseline.json'
  } else if (mode === 'upgraded') {
    if (!value || !isAddress(value)) throw new Error('upgraded mode requires NEW_IMPLEMENTATION')
    implementation = getAddress(value)
    outputPath = outputArg ?? 'deployments/arc-testnet/HukuNFT-metadata-v2-post-upgrade.json'
  } else {
    throw new Error('Usage: verify-hukunft-metadata-v2.mjs baseline [OUTPUT]|upgraded NEW_IMPLEMENTATION [OUTPUT]')
  }

  const client = createPublicClient({
    chain: arcTestnet,
    transport: http(env.ARC_RPC_URL),
    batch: { multicall: false },
  })
  const snapshot = await readProxySnapshot(client)
  if (mode === 'baseline') assertBaselineSnapshot(snapshot)
  else assertUpgradedSnapshot(snapshot, implementation)

  const absoluteOutput = resolve(outputPath)
  mkdirSync(dirname(absoluteOutput), { recursive: true })
  writeFileSync(absoluteOutput, `${JSON.stringify(snapshot, null, 2)}\n`)
  process.stdout.write(`${JSON.stringify({ mode, output: absoluteOutput, snapshot }, null, 2)}\n`)
  return snapshot
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`HukuNFT verification failed: ${error.message}\n`)
    process.exitCode = 1
  })
}
