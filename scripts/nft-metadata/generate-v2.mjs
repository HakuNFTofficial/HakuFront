#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRelease, validateRelease } from './release-lib.mjs'

const ARGUMENTS = new Map([
  ['--source-map', 'sourceMap'],
  ['--source-json', 'sourceJson'],
  ['--source-images', 'sourceImages'],
  ['--output', 'output'],
  ['--generated-at', 'generatedAt'],
  ['--git-commit', 'gitCommit'],
])

export function parseGenerateArgs(argv) {
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
  for (const [flag, key] of ARGUMENTS) {
    if (parsed[key] === undefined) throw new Error(`Missing required argument: ${flag}`)
  }
  return parsed
}

export function kuboOnlyHashArgs(filePath) {
  return ['add', '--only-hash', '--cid-version=1', '--raw-leaves=false', '--quiet', filePath]
}

function cidForFile(filePath) {
  return execFileSync('ipfs', kuboOnlyHashArgs(filePath), {
    encoding: 'utf8',
  }).trim()
}

function cidForDirectory(directoryPath) {
  const output = execFileSync('ipfs', [
    'add', '--only-hash', '--cid-version=1', '--raw-leaves=false', '--recursive', '--quiet', directoryPath,
  ], { encoding: 'utf8' }).trim()
  return output.split(/\r?\n/).at(-1)
}

function loadSourceMap(filePath) {
  const sourceMap = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!Array.isArray(sourceMap)) throw new Error('Source map JSON must be an array')
  return sourceMap
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseGenerateArgs(argv)
  const releaseDir = resolve(args.output)
  const sourceMap = loadSourceMap(resolve(args.sourceMap))
  const manifest = await buildRelease({
    sourceMap,
    sourceJsonDir: resolve(args.sourceJson),
    sourceImageDir: resolve(args.sourceImages),
    outputDir: releaseDir,
    generatedAt: args.generatedAt,
    gitCommit: args.gitCommit,
    cidForFile,
  })
  validateRelease({ releaseDir, sourceMap })

  const summary = {
    release: manifest.release,
    entryCount: manifest.entries.length,
    releaseDir,
    manifestCidV1: cidForFile(resolve(releaseDir, 'manifest.json')),
    metadataRootCidV1: cidForDirectory(resolve(releaseDir, 'json')),
    mediaRootCidV1: cidForDirectory(resolve(releaseDir, 'images')),
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  return summary
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`Metadata generation failed: ${error.message}\n`)
    process.exitCode = 1
  })
}
