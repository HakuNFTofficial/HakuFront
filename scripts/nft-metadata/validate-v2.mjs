#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sha256, validateRelease } from './release-lib.mjs'

const ARGUMENTS = new Map([
  ['--release', 'release'],
  ['--source-map', 'sourceMap'],
  ['--public-origin', 'publicOrigin'],
])

export function parseValidateArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const key = ARGUMENTS.get(flag)
    const value = argv[index + 1]
    if (!key) throw new Error(`Unknown argument: ${String(flag)}`)
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`)
    if (parsed[key] !== undefined) throw new Error(`Duplicate argument: ${flag}`)
    parsed[key] = value
  }
  for (const flag of ['--release', '--source-map']) {
    const key = ARGUMENTS.get(flag)
    if (parsed[key] === undefined) throw new Error(`Missing required argument: ${flag}`)
  }
  return parsed
}

function publicUrl(origin, pathname) {
  const base = new URL(origin)
  base.pathname = '/'
  base.search = ''
  base.hash = ''
  return new URL(pathname, base).toString()
}

async function validatePublicFile({ url, expectedSha256, expectedContentType, fetchImpl }) {
  const response = await fetchImpl(url, { redirect: 'manual' })
  if (response.status !== 200) throw new Error(`${url} returned status ${response.status}, expected status 200`)
  if (response.headers.get('access-control-allow-origin') !== '*') {
    throw new Error(`${url} is missing Access-Control-Allow-Origin: *`)
  }
  if (!response.headers.get('cache-control')?.toLowerCase().includes('immutable')) {
    throw new Error(`${url} is missing immutable caching`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  const typeMatches = expectedContentType === 'application/json'
    ? contentType.toLowerCase().startsWith('application/json')
    : contentType.toLowerCase() === expectedContentType
  if (!typeMatches) throw new Error(`${url} has unexpected content type ${contentType}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (sha256(bytes) !== expectedSha256) throw new Error(`${url} failed SHA-256 validation`)
}

export async function validatePublicRelease({
  manifest,
  publicOrigin,
  fetchImpl = fetch,
  concurrency = 12,
}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`Invalid public validation concurrency: ${concurrency}`)
  }
  const files = manifest.entries.flatMap((entry) => [
    {
      url: publicUrl(publicOrigin, `/nft-metadata/v2/${entry.metadata.fileName}`),
      expectedSha256: entry.metadata.sha256,
      expectedContentType: 'application/json',
    },
    {
      url: publicUrl(publicOrigin, `/nft-media/v2/${entry.image.fileName}`),
      expectedSha256: entry.image.sha256,
      expectedContentType: 'image/png',
    },
  ])
  let cursor = 0
  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor]
      cursor += 1
      await validatePublicFile({ ...file, fetchImpl })
    }
  }
  const workerCount = Math.min(concurrency, files.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return { checkedFiles: files.length }
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseValidateArgs(argv)
  const releaseDir = resolve(args.release)
  const sourceMap = JSON.parse(readFileSync(resolve(args.sourceMap), 'utf8'))
  const manifest = validateRelease({ releaseDir, sourceMap })
  const publicResult = args.publicOrigin
    ? await validatePublicRelease({ manifest, publicOrigin: args.publicOrigin })
    : { checkedFiles: 0 }
  const summary = {
    release: manifest.release,
    entryCount: manifest.entries.length,
    releaseDir,
    publicOrigin: args.publicOrigin ?? null,
    publicFilesChecked: publicResult.checkedFiles,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  return summary
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`Metadata validation failed: ${error.message}\n`)
    process.exitCode = 1
  })
}
