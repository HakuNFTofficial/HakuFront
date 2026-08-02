#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const baselinePath = 'deployments/arc-testnet/HukuNFT-v1-storage-layout.json'
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const current = JSON.parse(execFileSync(
  'forge',
  ['inspect', 'HukuNFT', 'storageLayout', '--json'],
  { encoding: 'utf8' },
))

const baselineGapIndex = baseline.storage.findIndex((entry) => entry.label === '__gap')
assert.notEqual(baselineGapIndex, -1, 'v1 storage layout is missing __gap')
assert.equal(
  baseline.types[baseline.storage[baselineGapIndex].type]?.label,
  'uint256[47]',
  'v1 storage gap must contain 47 slots',
)

for (let index = 0; index < baselineGapIndex; index += 1) {
  const previous = baseline.storage[index]
  const next = current.storage[index]
  assert.ok(next, `current storage is missing ${previous.label}`)
  assert.deepEqual(
    {
      label: next.label,
      slot: next.slot,
      offset: next.offset,
      type: next.type,
    },
    {
      label: previous.label,
      slot: previous.slot,
      offset: previous.offset,
      type: previous.type,
    },
    `storage layout changed for ${previous.label}`,
  )
}

const oldGap = baseline.storage[baselineGapIndex]
const metadataBaseURI = current.storage[baselineGapIndex]
assert.deepEqual(
  {
    label: metadataBaseURI?.label,
    slot: metadataBaseURI?.slot,
    offset: metadataBaseURI?.offset,
    typeLabel: current.types[metadataBaseURI?.type]?.label,
  },
  {
    label: 'metadataBaseURI',
    slot: oldGap.slot,
    offset: oldGap.offset,
    typeLabel: 'string',
  },
  'metadataBaseURI must consume the first v1 gap slot',
)

const currentGap = current.storage[baselineGapIndex + 1]
assert.deepEqual(
  {
    label: currentGap?.label,
    slot: currentGap?.slot,
    offset: currentGap?.offset,
    typeLabel: current.types[currentGap?.type]?.label,
  },
  {
    label: '__gap',
    slot: String(BigInt(oldGap.slot) + 1n),
    offset: 0,
    typeLabel: 'uint256[46]',
  },
  'v2 must retain the remaining 46 reserved slots',
)
assert.equal(
  current.storage.length,
  baseline.storage.length + 1,
  'v2 contains unexpected application storage entries',
)

process.stdout.write('HukuNFT storage layout compatible: metadataBaseURI consumes one reserved slot\n')
