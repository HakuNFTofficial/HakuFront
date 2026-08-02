import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildMetadata, buildRelease, tokenUrlFromFileName } from './release-lib.mjs'

const CID = 'bafybeido5yvptbcf5vgmtth52byp6pdj2q6g3kpy45nppd6nifqoa76qzi'

test('token URL is the numeric PNG stem', () => {
  assert.equal(tokenUrlFromFileName('740.png'), '740')
  assert.throws(() => tokenUrlFromFileName('../740.png'), /numeric PNG/)
  assert.throws(() => tokenUrlFromFileName('740.jpg'), /numeric PNG/)
})

test('metadata keeps traits and replaces wallet-facing fields', () => {
  const output = buildMetadata({
    source: {
      name: 'Haku #740',
      description: 'old',
      attributes: [{ trait_type: 'eyes', value: 'Angry' }],
      edition: 740,
    },
    tokenUrl: '740',
    imageCidV1: CID,
  })
  assert.equal(output.description, 'HakuNFT collectible from the Haku ecosystem.')
  assert.equal(output.image, 'https://www.hakupump.club/nft-media/v2/740.png')
  assert.equal(output.properties.image_ipfs, `ipfs://${CID}`)
  assert.deepEqual(output.attributes, [{ trait_type: 'eyes', value: 'Angry' }])
})

test('release output is byte-identical for identical explicit inputs', async () => {
  const root = mkdtempSync(join(tmpdir(), 'haku-metadata-'))
  const sourceJson = join(root, 'source-json')
  const sourceImages = join(root, 'source-images')
  const outA = join(root, 'out-a')
  const outB = join(root, 'out-b')
  mkdirSync(sourceJson)
  mkdirSync(sourceImages)
  writeFileSync(join(sourceImages, '740.png'), Buffer.from('png-fixture'))
  writeFileSync(join(sourceJson, '740.json'), JSON.stringify({ name: 'Haku #740', attributes: [] }))
  const options = {
    sourceMap: [{ nftId: 1551, fileName: '740.png', tokenId: '38', tokenUrl: '740', isMint: 2 }],
    sourceJsonDir: sourceJson,
    sourceImageDir: sourceImages,
    generatedAt: '2026-08-02T16:00:00.000Z',
    gitCommit: '163707d',
    cidForFile: async () => CID,
  }
  await buildRelease({ ...options, outputDir: outA })
  await buildRelease({ ...options, outputDir: outB })
  assert.deepEqual(readFileSync(join(outA, 'json', '740.json')), readFileSync(join(outB, 'json', '740.json')))
  assert.deepEqual(readFileSync(join(outA, 'manifest.json')), readFileSync(join(outB, 'manifest.json')))
})
