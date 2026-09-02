import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
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

before(async () => {
    taskDir = await mkdtemp(join(tmpdir(), 'haku-preview-test-'))
    inputDir = join(taskDir, 'input')
    outputDir = join(taskDir, 'output')
    await mkdir(inputDir)

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

    const manifest = JSON.parse(
        await readFile(join(outputDir, 'manifest.json'), 'utf8'),
    )
    assert.equal(manifest.settings.width, 512)
    assert.equal(manifest.settings.height, 512)
    assert.equal(manifest.settings.quality, 50)
    assert.equal(manifest.sourceCount, 2)
    assert.equal(manifest.outputCount, 2)
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
