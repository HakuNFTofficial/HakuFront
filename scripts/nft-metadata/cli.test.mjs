import test from 'node:test'
import assert from 'node:assert/strict'
import { kuboOnlyHashArgs, parseGenerateArgs } from './generate-v2.mjs'
import { parseValidateArgs, validatePublicRelease } from './validate-v2.mjs'
import { sha256 } from './release-lib.mjs'

test('generation CLI requires every reproducibility input', () => {
  assert.throws(() => parseGenerateArgs(['--source-map', 'map.json']), /--source-json/)
  assert.deepEqual(parseGenerateArgs([
    '--source-map', 'map.json',
    '--source-json', 'json',
    '--source-images', 'images',
    '--output', 'release',
    '--generated-at', '2026-08-02T16:00:00.000Z',
    '--git-commit', 'abc123',
  ]), {
    sourceMap: 'map.json',
    sourceJson: 'json',
    sourceImages: 'images',
    output: 'release',
    generatedAt: '2026-08-02T16:00:00.000Z',
    gitCommit: 'abc123',
  })
})

test('Kubo hashing preserves the existing dag-pb CID as CIDv1', () => {
  assert.deepEqual(kuboOnlyHashArgs('/tmp/740.png'), [
    'add',
    '--only-hash',
    '--cid-version=1',
    '--raw-leaves=false',
    '--quiet',
    '/tmp/740.png',
  ])
})

test('validation CLI accepts an optional public origin only', () => {
  assert.throws(() => parseValidateArgs(['--release', 'release']), /--source-map/)
  assert.deepEqual(parseValidateArgs([
    '--release', 'release',
    '--source-map', 'map.json',
    '--public-origin', 'https://www.hakupump.club',
  ]), {
    release: 'release',
    sourceMap: 'map.json',
    publicOrigin: 'https://www.hakupump.club',
  })
})

test('public validation checks headers, bytes, and disables redirects', async () => {
  const metadataBytes = Buffer.from('{"name":"Haku #740"}\n')
  const imageBytes = Buffer.from('png-fixture')
  const manifest = {
    entries: [{
      tokenUrl: '740',
      metadata: { fileName: '740.json', sha256: sha256(metadataBytes) },
      image: { fileName: '740.png', sha256: sha256(imageBytes) },
    }],
  }
  const requests = []
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options })
    const isMetadata = String(url).includes('/nft-metadata/')
    return new Response(isMetadata ? metadataBytes : imageBytes, {
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': isMetadata ? 'application/json; charset=utf-8' : 'image/png',
      },
    })
  }

  const result = await validatePublicRelease({
    manifest,
    publicOrigin: 'https://www.hakupump.club/',
    fetchImpl,
  })
  assert.equal(result.checkedFiles, 2)
  assert.equal(requests[0].options.redirect, 'manual')
  assert.equal(requests[0].url, 'https://www.hakupump.club/nft-metadata/v2/740.json')
  assert.equal(requests[1].url, 'https://www.hakupump.club/nft-media/v2/740.png')
})

test('public validation rejects a redirected response', async () => {
  const bytes = Buffer.from('{}')
  const manifest = {
    entries: [{
      tokenUrl: '1',
      metadata: { fileName: '1.json', sha256: sha256(bytes) },
      image: { fileName: '1.png', sha256: sha256(bytes) },
    }],
  }
  await assert.rejects(validatePublicRelease({
    manifest,
    publicOrigin: 'https://www.hakupump.club',
    fetchImpl: async () => new Response(null, { status: 301 }),
  }), /status 200/)
})

test('public validation identifies the URL when fetch terminates', async () => {
  const manifest = {
    entries: [{
      tokenUrl: '740',
      metadata: { fileName: '740.json', sha256: '0'.repeat(64) },
      image: { fileName: '740.png', sha256: '0'.repeat(64) },
    }],
  }
  await assert.rejects(validatePublicRelease({
    manifest,
    publicOrigin: 'https://www.hakupump.club',
    fetchImpl: async () => { throw new Error('terminated') },
    concurrency: 1,
    maxFetchAttempts: 1,
    retryDelayMs: 0,
  }), /nft-metadata\/v2\/740[.]json.*terminated/)
})

test('public validation retries a transport failure before receiving HTTP', async () => {
  const bytes = Buffer.from('{}')
  const manifest = {
    entries: [{
      tokenUrl: '740',
      metadata: { fileName: '740.json', sha256: sha256(bytes) },
      image: { fileName: '740.png', sha256: sha256(bytes) },
    }],
  }
  let attempts = 0
  const fetchImpl = async (url) => {
    attempts += 1
    if (attempts === 1) throw new Error('terminated')
    const isMetadata = String(url).endsWith('.json')
    return new Response(bytes, {
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': isMetadata ? 'application/json' : 'image/png',
      },
    })
  }
  const result = await validatePublicRelease({
    manifest,
    publicOrigin: 'https://www.hakupump.club',
    fetchImpl,
    concurrency: 1,
    maxFetchAttempts: 2,
    retryDelayMs: 0,
  })
  assert.equal(result.checkedFiles, 2)
  assert.equal(attempts, 3)
})

test('public validation uses bounded concurrency', async () => {
  const bytes = Buffer.from('{}')
  const entries = Array.from({ length: 3 }, (_, index) => ({
    tokenUrl: String(index + 1),
    metadata: { fileName: `${index + 1}.json`, sha256: sha256(bytes) },
    image: { fileName: `${index + 1}.png`, sha256: sha256(bytes) },
  }))
  let active = 0
  let maxActive = 0
  const fetchImpl = async (url) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    const isMetadata = String(url).endsWith('.json')
    return new Response(bytes, {
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': isMetadata ? 'application/json' : 'image/png',
      },
    })
  }
  const result = await validatePublicRelease({
    manifest: { entries },
    publicOrigin: 'https://www.hakupump.club',
    fetchImpl,
    concurrency: 2,
  })
  assert.equal(result.checkedFiles, 6)
  assert.equal(maxActive, 2)
})
