import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import sharp from 'sharp'

import {
    generatePreviewCollection,
    validatePreviewCollection,
} from './preview-lib.mjs'

let taskDir
let inputDir
let outputDir
let invalidInputDir

before(async () => {
    taskDir = await mkdtemp(join(tmpdir(), 'haku-preview-test-'))
    inputDir = join(taskDir, 'input')
    outputDir = join(taskDir, 'output')
    invalidInputDir = join(taskDir, 'invalid-input')
    await mkdir(inputDir)
    await mkdir(invalidInputDir)

    for (const [name, colour] of [['1.png', '#ff0088'], ['2.png', '#0088ff']]) {
        await sharp({
            create: {
                width: 3000,
                height: 3000,
                channels: 3,
                background: colour,
            },
        }).png().toFile(join(inputDir, name))
    }

    await sharp({
        create: {
            width: 2999,
            height: 3000,
            channels: 3,
            background: '#ff0088',
        },
    }).png().toFile(join(invalidInputDir, '3.png'))
})

after(async () => {
    await rm(taskDir, { recursive: true, force: true })
})

test('generates deterministic 512px WebP previews and a manifest', async () => {
    const result = await generatePreviewCollection({
        inputDir,
        outputDir,
        expectedCount: 2,
        concurrency: 2,
    })

    assert.equal(result.sourceCount, 2)
    assert.equal(result.outputCount, 2)

    const metadata = await sharp(join(outputDir, '1.webp')).metadata()
    assert.equal(metadata.format, 'webp')
    assert.equal(metadata.width, 512)
    assert.equal(metadata.height, 512)

    const stats = await sharp(join(outputDir, '1.webp')).stats()
    assert.notEqual(stats.channels[0].mean, stats.channels[1].mean)

    const manifest = JSON.parse(
        await readFile(join(outputDir, 'manifest.json'), 'utf8'),
    )
    assert.equal(manifest.settings.version, 2)
    assert.equal(manifest.settings.sourceWidth, 3000)
    assert.equal(manifest.settings.sourceHeight, 3000)
    assert.equal(manifest.settings.width, 512)
    assert.equal(manifest.settings.height, 512)
    assert.equal(manifest.settings.quality, 50)
    assert.equal(manifest.sourceCount, 2)
    assert.equal(manifest.outputCount, 2)
})

test('rejects source artwork with unexpected dimensions', async () => {
    await assert.rejects(
        generatePreviewCollection({
            inputDir: invalidInputDir,
            outputDir: join(taskDir, 'invalid-dimensions'),
            expectedCount: 1,
        }),
        /Invalid source dimensions: 3\.png \(2999x3000\), expected 3000x3000/,
    )
})

test('rejects a preview manifest from a different artifact version', async () => {
    const manifestPath = join(outputDir, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const currentSettings = manifest.settings
    manifest.settings = { ...currentSettings, version: 1 }
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    try {
        await assert.rejects(
            validatePreviewCollection({ inputDir, outputDir, expectedCount: 2 }),
            /Manifest settings mismatch.*expected version=2.*received version=1/,
        )
    } finally {
        manifest.settings = currentSettings
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    }
})

test('rejects the wrong required source count before writing', async () => {
    await assert.rejects(
        generatePreviewCollection({
            inputDir,
            outputDir: join(taskDir, 'wrong-count'),
            expectedCount: 3,
        }),
        /Expected 3 PNG originals, found 2/,
    )
})

test('reports the exact missing preview during validation', async () => {
    await rm(join(outputDir, '2.webp'))

    await assert.rejects(
        validatePreviewCollection({ inputDir, outputDir, expectedCount: 2 }),
        /Missing preview files: 2\.webp/,
    )
})
