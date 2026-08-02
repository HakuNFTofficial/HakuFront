import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EXPECTED_OLD_IMPLEMENTATION,
  EXPECTED_OWNER,
  HAKUTOKEN_PROXY,
  HUKUNFT_PROXY,
  IMPLEMENTATION_SLOT,
  METADATA_BASE_URI,
  assertUpgradeConfirmations,
  buildUpgradeCalldata,
  calldataSha256,
  decodeUpgradeCalldata,
  implementationFromStorageValue,
} from './hukunft-metadata-v2-lib.mjs'

const NEW_IMPLEMENTATION = '0x1111111111111111111111111111111111111111'

test('production HukuNFT upgrade constants are exact', () => {
  assert.equal(HUKUNFT_PROXY, '0x703CEB677e9fbB1f4c6E917195c3b63B7EFA4Fe8')
  assert.equal(EXPECTED_OLD_IMPLEMENTATION, '0x73a0c937228837b79c2364f14b660c8a7d8f1472')
  assert.equal(EXPECTED_OWNER, '0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510')
  assert.equal(HAKUTOKEN_PROXY, '0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12')
  assert.equal(METADATA_BASE_URI, 'https://www.hakupump.club/nft-metadata/v2/')
  assert.equal(IMPLEMENTATION_SLOT, '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc')
})

test('upgrade calldata decodes to the reviewed implementation and initializer URI', () => {
  const calldata = buildUpgradeCalldata(NEW_IMPLEMENTATION)
  assert.deepEqual(decodeUpgradeCalldata(calldata), {
    newImplementation: NEW_IMPLEMENTATION,
    metadataBaseURI: METADATA_BASE_URI,
  })
  assert.match(calldataSha256(calldata), /^[0-9a-f]{64}$/)
})

test('implementation address is decoded from the ERC-1967 slot', () => {
  assert.equal(
    implementationFromStorageValue(`0x${'0'.repeat(24)}${EXPECTED_OLD_IMPLEMENTATION.slice(2).toLowerCase()}`),
    EXPECTED_OLD_IMPLEMENTATION,
  )
})

test('all three upgrade confirmations must match exactly', () => {
  const calldata = buildUpgradeCalldata(NEW_IMPLEMENTATION)
  const sha = calldataSha256(calldata)
  assert.doesNotThrow(() => assertUpgradeConfirmations({
    env: {
      CONFIRM_HUKUNFT_PROXY: HUKUNFT_PROXY,
      CONFIRM_NEW_IMPLEMENTATION: NEW_IMPLEMENTATION,
      CONFIRM_CALLDATA_SHA256: sha,
    },
    newImplementation: NEW_IMPLEMENTATION,
    calldata,
  }))
  assert.throws(() => assertUpgradeConfirmations({
    env: {
      CONFIRM_HUKUNFT_PROXY: HUKUNFT_PROXY,
      CONFIRM_NEW_IMPLEMENTATION: NEW_IMPLEMENTATION,
      CONFIRM_CALLDATA_SHA256: '0'.repeat(64),
    },
    newImplementation: NEW_IMPLEMENTATION,
    calldata,
  }), /CONFIRM_CALLDATA_SHA256/)
})
