import { createHash } from 'node:crypto'
import {
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  isAddress,
} from 'viem'

export const ARC_CHAIN_ID = 5_042_002
export const HUKUNFT_PROXY = '0x703CEB677e9fbB1f4c6E917195c3b63B7EFA4Fe8'
export const EXPECTED_OLD_IMPLEMENTATION = '0x73a0c937228837b79c2364f14b660c8a7d8f1472'
export const EXPECTED_OWNER = '0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510'
export const HAKUTOKEN_PROXY = '0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12'
export const METADATA_BASE_URI = 'https://www.hakupump.club/nft-metadata/v2/'
export const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
export const EXPECTED_BASE_CID = 'QmeqYrSGKCaKzcLGuJT3N12HFH4ws47Lqbs18hSiuGEZGn'
// Verified on 2026-08-02 after Token #39 had been minted and burned.
export const EXPECTED_NEXT_TOKEN_ID = 40n
export const REFERENCE_TOKEN_ID = 38n
export const REFERENCE_TOKEN_OWNER = '0x2FBF4aD90BfE460A0eD12ac8ebF969a1c9462E8c'
export const REFERENCE_IPFS_URI = `ipfs://${EXPECTED_BASE_CID}/740.json`
export const REFERENCE_HTTPS_URI = `${METADATA_BASE_URI}740.json`

export const PROXY_ABI = [
  {
    type: 'function',
    name: 'upgradeToAndCall',
    stateMutability: 'payable',
    inputs: [
      { name: 'newImplementation', type: 'address' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [],
  },
]

export const HUKUNFT_ABI = [
  { type: 'function', name: 'initializeV2', stateMutability: 'nonpayable', inputs: [{ name: 'metadataBaseURI_', type: 'string' }], outputs: [] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'baseCID', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'metadataBaseURI', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'nextTokenId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'hakuToken', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'mintPrice', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'tokenURI', stateMutability: 'view', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'supportsInterface', stateMutability: 'view', inputs: [{ name: 'interfaceId', type: 'bytes4' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'proxiableUUID', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
]

export function buildUpgradeCalldata(newImplementation) {
  if (!isAddress(newImplementation)) throw new Error(`Invalid new implementation: ${newImplementation}`)
  const initializer = encodeFunctionData({
    abi: HUKUNFT_ABI,
    functionName: 'initializeV2',
    args: [METADATA_BASE_URI],
  })
  return encodeFunctionData({
    abi: PROXY_ABI,
    functionName: 'upgradeToAndCall',
    args: [getAddress(newImplementation), initializer],
  })
}

export function decodeUpgradeCalldata(calldata) {
  const outer = decodeFunctionData({ abi: PROXY_ABI, data: calldata })
  if (outer.functionName !== 'upgradeToAndCall') throw new Error('Unexpected proxy function')
  const [newImplementation, initializer] = outer.args
  const inner = decodeFunctionData({ abi: HUKUNFT_ABI, data: initializer })
  if (inner.functionName !== 'initializeV2') throw new Error('Unexpected initializer function')
  return {
    newImplementation: getAddress(newImplementation),
    metadataBaseURI: inner.args[0],
  }
}

export function calldataSha256(calldata) {
  if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(calldata)) throw new Error('Calldata must be non-empty hex bytes')
  return createHash('sha256').update(Buffer.from(calldata.slice(2), 'hex')).digest('hex')
}

export function implementationFromStorageValue(storageValue) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(storageValue)) throw new Error('Invalid ERC-1967 storage value')
  return `0x${storageValue.slice(-40).toLowerCase()}`
}

function assertAddressEqual(actual, expected, label) {
  if (!isAddress(actual) || getAddress(actual) !== getAddress(expected)) {
    throw new Error(`${label} mismatch: expected ${expected}, received ${actual}`)
  }
}

export function assertUpgradeConfirmations({ env, newImplementation, calldata }) {
  const expectedSha = calldataSha256(calldata)
  assertAddressEqual(env.CONFIRM_HUKUNFT_PROXY, HUKUNFT_PROXY, 'CONFIRM_HUKUNFT_PROXY')
  assertAddressEqual(env.CONFIRM_NEW_IMPLEMENTATION, newImplementation, 'CONFIRM_NEW_IMPLEMENTATION')
  if (env.CONFIRM_CALLDATA_SHA256 !== expectedSha) {
    throw new Error(`CONFIRM_CALLDATA_SHA256 mismatch: expected ${expectedSha}`)
  }
}

async function readOptionalMetadataBaseURI(client) {
  try {
    return await client.readContract({
      address: HUKUNFT_PROXY,
      abi: HUKUNFT_ABI,
      functionName: 'metadataBaseURI',
    })
  } catch {
    return null
  }
}

export async function readProxySnapshot(client) {
  const chainId = await client.getChainId()
  const proxyCode = await client.getCode({ address: HUKUNFT_PROXY })
  const implementationSlotValue = await client.getStorageAt({
    address: HUKUNFT_PROXY,
    slot: IMPLEMENTATION_SLOT,
  })
  if (!implementationSlotValue) throw new Error('Unable to read the ERC-1967 implementation slot')
  const implementation = implementationFromStorageValue(implementationSlotValue)
  const [
    implementationCode,
    proxiableUUID,
    owner,
    baseCID,
    metadataBaseURI,
    nextTokenId,
    hakuToken,
    mintPrice,
    referenceTokenOwner,
    referenceTokenURI,
    supportsERC4906,
  ] = await Promise.all([
    client.getCode({ address: implementation }),
    client.readContract({ address: implementation, abi: HUKUNFT_ABI, functionName: 'proxiableUUID' }),
    client.readContract({ address: HUKUNFT_PROXY, abi: HUKUNFT_ABI, functionName: 'owner' }),
    client.readContract({ address: HUKUNFT_PROXY, abi: HUKUNFT_ABI, functionName: 'baseCID' }),
    readOptionalMetadataBaseURI(client),
    client.readContract({ address: HUKUNFT_PROXY, abi: HUKUNFT_ABI, functionName: 'nextTokenId' }),
    client.readContract({ address: HUKUNFT_PROXY, abi: HUKUNFT_ABI, functionName: 'hakuToken' }),
    client.readContract({ address: HUKUNFT_PROXY, abi: HUKUNFT_ABI, functionName: 'mintPrice' }),
    client.readContract({ address: HUKUNFT_PROXY, abi: HUKUNFT_ABI, functionName: 'ownerOf', args: [REFERENCE_TOKEN_ID] }),
    client.readContract({ address: HUKUNFT_PROXY, abi: HUKUNFT_ABI, functionName: 'tokenURI', args: [REFERENCE_TOKEN_ID] }),
    client.readContract({ address: HUKUNFT_PROXY, abi: HUKUNFT_ABI, functionName: 'supportsInterface', args: ['0x49064906'] }),
  ])
  return {
    capturedAt: new Date().toISOString(),
    chainId,
    proxy: HUKUNFT_PROXY,
    proxyHasCode: Boolean(proxyCode && proxyCode !== '0x'),
    implementation,
    implementationHasCode: Boolean(implementationCode && implementationCode !== '0x'),
    proxiableUUID,
    owner,
    baseCID,
    metadataBaseURI,
    nextTokenId: nextTokenId.toString(),
    hakuToken,
    mintPrice: mintPrice.toString(),
    referenceTokenId: REFERENCE_TOKEN_ID.toString(),
    referenceTokenOwner,
    referenceTokenURI,
    supportsERC4906,
  }
}

export function assertBaselineSnapshot(snapshot, accountAddress) {
  if (snapshot.chainId !== ARC_CHAIN_ID) throw new Error(`Chain ID mismatch: ${snapshot.chainId}`)
  if (!snapshot.proxyHasCode || !snapshot.implementationHasCode) throw new Error('Proxy or implementation has no code')
  assertAddressEqual(snapshot.implementation, EXPECTED_OLD_IMPLEMENTATION, 'Current implementation')
  assertAddressEqual(snapshot.owner, EXPECTED_OWNER, 'Proxy owner')
  if (accountAddress) assertAddressEqual(accountAddress, EXPECTED_OWNER, 'Signer account')
  assertAddressEqual(snapshot.hakuToken, HAKUTOKEN_PROXY, 'HakuToken proxy')
  assertAddressEqual(snapshot.referenceTokenOwner, REFERENCE_TOKEN_OWNER, 'Token #38 owner')
  if (snapshot.proxiableUUID.toLowerCase() !== IMPLEMENTATION_SLOT) throw new Error('proxiableUUID mismatch')
  if (snapshot.baseCID !== EXPECTED_BASE_CID) throw new Error(`baseCID mismatch: ${snapshot.baseCID}`)
  if (snapshot.nextTokenId !== EXPECTED_NEXT_TOKEN_ID.toString()) throw new Error(`nextTokenId mismatch: ${snapshot.nextTokenId}`)
  if (snapshot.referenceTokenURI !== REFERENCE_IPFS_URI) throw new Error(`Token #38 URI mismatch: ${snapshot.referenceTokenURI}`)
  if (snapshot.metadataBaseURI !== null && snapshot.metadataBaseURI !== '') {
    throw new Error(`Unexpected metadataBaseURI before upgrade: ${snapshot.metadataBaseURI}`)
  }
}

export function assertUpgradedSnapshot(snapshot, newImplementation) {
  if (snapshot.chainId !== ARC_CHAIN_ID) throw new Error(`Chain ID mismatch: ${snapshot.chainId}`)
  if (!snapshot.proxyHasCode || !snapshot.implementationHasCode) throw new Error('Proxy or implementation has no code')
  assertAddressEqual(snapshot.implementation, newImplementation, 'Current implementation')
  assertAddressEqual(snapshot.owner, EXPECTED_OWNER, 'Proxy owner')
  assertAddressEqual(snapshot.hakuToken, HAKUTOKEN_PROXY, 'HakuToken proxy')
  assertAddressEqual(snapshot.referenceTokenOwner, REFERENCE_TOKEN_OWNER, 'Token #38 owner')
  if (snapshot.proxiableUUID.toLowerCase() !== IMPLEMENTATION_SLOT) throw new Error('proxiableUUID mismatch')
  if (snapshot.baseCID !== EXPECTED_BASE_CID) throw new Error(`baseCID mismatch: ${snapshot.baseCID}`)
  if (snapshot.nextTokenId !== EXPECTED_NEXT_TOKEN_ID.toString()) throw new Error(`nextTokenId mismatch: ${snapshot.nextTokenId}`)
  if (snapshot.metadataBaseURI !== METADATA_BASE_URI) throw new Error(`metadataBaseURI mismatch: ${snapshot.metadataBaseURI}`)
  if (snapshot.referenceTokenURI !== REFERENCE_HTTPS_URI) throw new Error(`Token #38 URI mismatch: ${snapshot.referenceTokenURI}`)
  if (!snapshot.supportsERC4906) throw new Error('ERC-4906 interface support is missing')
}
