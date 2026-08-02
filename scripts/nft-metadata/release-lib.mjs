import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'

const DESCRIPTION = 'HakuNFT collectible from the Haku ecosystem.'
const METADATA_BASE_URL = 'https://www.hakupump.club/nft-metadata/v2/'
const MEDIA_BASE_URL = 'https://www.hakupump.club/nft-media/v2/'

export function tokenUrlFromFileName(fileName) {
  if (typeof fileName !== 'string' || basename(fileName) !== fileName || !/^(0|[1-9]\d*)\.png$/.test(fileName)) {
    throw new Error(`Expected a numeric PNG filename, received: ${String(fileName)}`)
  }
  return fileName.slice(0, -4)
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function buildMetadata({ source, tokenUrl, imageCidV1 }) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Source metadata must be an object')
  }
  if (!/^\d+$/.test(String(tokenUrl))) {
    throw new Error(`Invalid token URL: ${String(tokenUrl)}`)
  }
  if (typeof imageCidV1 !== 'string' || !imageCidV1.startsWith('b')) {
    throw new Error(`Invalid CIDv1 image identifier: ${String(imageCidV1)}`)
  }

  return {
    ...source,
    description: DESCRIPTION,
    image: `${MEDIA_BASE_URL}${tokenUrl}.png`,
    external_url: 'https://www.hakupump.club/',
    properties: {
      ...(source.properties ?? {}),
      metadata_version: 'v2',
      image_ipfs: `ipfs://${imageCidV1}`,
    },
  }
}

function assertUnique(sourceMap, key, label) {
  const seen = new Set()
  for (const row of sourceMap) {
    const value = String(row[key])
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`)
    }
    seen.add(value)
  }
}

function readSourceJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read source metadata ${filePath}: ${error.message}`)
  }
}

export async function buildRelease({
  sourceMap,
  sourceJsonDir,
  sourceImageDir,
  outputDir,
  generatedAt,
  gitCommit,
  cidForFile,
}) {
  if (!Array.isArray(sourceMap) || sourceMap.length === 0) {
    throw new Error('Source map must contain at least one NFT')
  }
  if (typeof cidForFile !== 'function') {
    throw new Error('cidForFile must be a function')
  }
  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error(`Invalid generatedAt timestamp: ${String(generatedAt)}`)
  }
  if (typeof gitCommit !== 'string' || gitCommit.length === 0) {
    throw new Error('gitCommit is required')
  }

  assertUnique(sourceMap, 'nftId', 'NFT ID')
  assertUnique(sourceMap, 'fileName', 'source filename')

  const rows = sourceMap.map((row) => {
    const derivedTokenUrl = tokenUrlFromFileName(row.fileName)
    if (Number(row.isMint) === 2) {
      const mappedTokenUrl = String(row.tokenUrl)
      if (row.tokenId == null || mappedTokenUrl !== derivedTokenUrl) {
        throw new Error(`Minted NFT ${row.nftId} has an invalid token mapping`)
      }
    }
    return { ...row, tokenUrl: derivedTokenUrl }
  })
  assertUnique(rows, 'tokenUrl', 'token URL')
  rows.sort((left, right) => {
    const a = BigInt(left.tokenUrl)
    const b = BigInt(right.tokenUrl)
    return a < b ? -1 : a > b ? 1 : 0
  })

  const jsonDir = join(outputDir, 'json')
  const imageDir = join(outputDir, 'images')
  mkdirSync(jsonDir, { recursive: true })
  mkdirSync(imageDir, { recursive: true })

  const entries = []
  for (const row of rows) {
    const sourceJsonPath = join(sourceJsonDir, `${row.tokenUrl}.json`)
    const sourceImagePath = join(sourceImageDir, row.fileName)
    if (!existsSync(sourceJsonPath) || !statSync(sourceJsonPath).isFile()) {
      throw new Error(`Missing source metadata: ${sourceJsonPath}`)
    }
    if (!existsSync(sourceImagePath) || !statSync(sourceImagePath).isFile()) {
      throw new Error(`Missing source image: ${sourceImagePath}`)
    }

    const outputImagePath = join(imageDir, row.fileName)
    copyFileSync(sourceImagePath, outputImagePath)
    const imageBytes = readFileSync(outputImagePath)
    const imageCidV1 = await cidForFile(outputImagePath)
    const metadata = buildMetadata({
      source: readSourceJson(sourceJsonPath),
      tokenUrl: row.tokenUrl,
      imageCidV1,
    })
    const metadataPath = join(jsonDir, `${row.tokenUrl}.json`)
    const metadataBytes = Buffer.from(`${JSON.stringify(metadata, null, 2)}\n`)
    writeFileSync(metadataPath, metadataBytes)
    const metadataCidV1 = await cidForFile(metadataPath)

    entries.push({
      nftId: row.nftId,
      tokenId: row.tokenId == null ? null : String(row.tokenId),
      tokenUrl: row.tokenUrl,
      sourceFileName: row.fileName,
      metadata: {
        fileName: `${row.tokenUrl}.json`,
        byteSize: metadataBytes.length,
        sha256: sha256(metadataBytes),
        cidv1: metadataCidV1,
      },
      image: {
        fileName: row.fileName,
        mediaType: 'image/png',
        byteSize: imageBytes.length,
        sha256: sha256(imageBytes),
        cidv1: imageCidV1,
      },
    })
  }

  const manifest = {
    schemaVersion: 1,
    release: 'v2',
    generatedAt,
    generatorGitCommit: gitCommit,
    metadataBaseUrl: METADATA_BASE_URL,
    mediaBaseUrl: MEDIA_BASE_URL,
    entries,
  }
  writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

export function validateRelease({ releaseDir, sourceMap }) {
  const manifestPath = join(releaseDir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.schemaVersion !== 1 || manifest.release !== 'v2') {
    throw new Error('Unsupported release manifest')
  }
  if (!Array.isArray(sourceMap) || manifest.entries.length !== sourceMap.length) {
    throw new Error('Release entry count does not match the source map')
  }

  const expectedTokenUrls = new Set(sourceMap.map((row) => String(row.tokenUrl)))
  const manifestTokenUrls = new Set()
  for (const entry of manifest.entries) {
    if (!expectedTokenUrls.has(entry.tokenUrl) || manifestTokenUrls.has(entry.tokenUrl)) {
      throw new Error(`Unexpected or duplicate release token URL: ${entry.tokenUrl}`)
    }
    manifestTokenUrls.add(entry.tokenUrl)
    const metadataPath = join(releaseDir, 'json', entry.metadata.fileName)
    const imagePath = join(releaseDir, 'images', entry.image.fileName)
    for (const [label, filePath, expected] of [
      ['metadata', metadataPath, entry.metadata],
      ['image', imagePath, entry.image],
    ]) {
      const bytes = readFileSync(filePath)
      if (bytes.length !== expected.byteSize || sha256(bytes) !== expected.sha256) {
        throw new Error(`${label} integrity mismatch for token URL ${entry.tokenUrl}`)
      }
    }
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
    if (metadata.image !== `${MEDIA_BASE_URL}${entry.tokenUrl}.png`) {
      throw new Error(`Metadata image URL mismatch for token URL ${entry.tokenUrl}`)
    }
    if (metadata.properties?.image_ipfs !== `ipfs://${entry.image.cidv1}`) {
      throw new Error(`Metadata image CID mismatch for token URL ${entry.tokenUrl}`)
    }
  }

  const jsonFiles = readdirSync(join(releaseDir, 'json')).filter((name) => name.endsWith('.json'))
  const imageFiles = readdirSync(join(releaseDir, 'images')).filter((name) => name.endsWith('.png'))
  if (jsonFiles.length !== manifest.entries.length || imageFiles.length !== manifest.entries.length) {
    throw new Error('Release contains unexpected metadata or image files')
  }
  return manifest
}
