import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join, parse } from 'node:path'

import sharp from 'sharp'

export const PREVIEW_SETTINGS = Object.freeze({
    version: 1,
    width: 512,
    height: 512,
    blurSigma: 12,
    brightness: 0.35,
    quality: 50,
})

function requireDirectory(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`Missing required ${field}`)
    }
    return value
}

function requirePositiveInteger(value, field) {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${field} must be a positive integer, received ${value}`)
    }
    return parsed
}

async function listFilesWithExtension(directory, extension) {
    return (await readdir(directory, { withFileTypes: true }))
        .filter((entry) => (
            entry.isFile()
            && extname(entry.name).toLowerCase() === extension
        ))
        .map((entry) => entry.name)
        .sort((left, right) => (
            left.localeCompare(right, undefined, { numeric: true })
        ))
}

function outputName(sourceName) {
    return `${parse(sourceName).name}.webp`
}

function requireExactCount(files, expectedCount, label) {
    if (files.length !== expectedCount) {
        throw new Error(`Expected ${expectedCount} ${label}, found ${files.length}`)
    }
}

async function runBounded(items, concurrency, operation) {
    let nextIndex = 0
    const workers = Array.from(
        { length: Math.min(concurrency, items.length) },
        async () => {
            while (nextIndex < items.length) {
                const index = nextIndex++
                await operation(items[index], index)
            }
        },
    )
    await Promise.all(workers)
}

export async function generatePreviewCollection({
    inputDir,
    outputDir,
    expectedCount,
    concurrency = 4,
}) {
    const sourceDirectory = requireDirectory(inputDir, 'inputDir')
    const previewDirectory = requireDirectory(outputDir, 'outputDir')
    const requiredCount = requirePositiveInteger(expectedCount, 'expectedCount')
    const workerCount = requirePositiveInteger(concurrency, 'concurrency')
    const sources = await listFilesWithExtension(sourceDirectory, '.png')
    requireExactCount(sources, requiredCount, 'PNG originals')

    await mkdir(previewDirectory, { recursive: true })
    const existing = await readdir(previewDirectory)
    if (existing.length > 0) {
        throw new Error(`Output directory must be empty: ${previewDirectory}`)
    }

    const files = new Array(sources.length)
    await runBounded(sources, workerCount, async (sourceName, index) => {
        const previewName = outputName(sourceName)
        const sourcePath = join(sourceDirectory, sourceName)
        const previewPath = join(previewDirectory, previewName)

        await sharp(sourcePath)
            .resize(PREVIEW_SETTINGS.width, PREVIEW_SETTINGS.height, { fit: 'fill' })
            .grayscale()
            .blur(PREVIEW_SETTINGS.blurSigma)
            .modulate({ brightness: PREVIEW_SETTINGS.brightness })
            .webp({ quality: PREVIEW_SETTINGS.quality })
            .toFile(previewPath)

        const [sourceInfo, previewInfo] = await Promise.all([
            stat(sourcePath),
            stat(previewPath),
        ])
        files[index] = {
            source: sourceName,
            preview: previewName,
            sourceBytes: sourceInfo.size,
            previewBytes: previewInfo.size,
        }
    })

    const manifest = {
        settings: PREVIEW_SETTINGS,
        sourceCount: sources.length,
        outputCount: files.length,
        totalOutputBytes: files.reduce(
            (sum, file) => sum + file.previewBytes,
            0,
        ),
        files,
    }
    await writeFile(
        join(previewDirectory, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
    )

    return validatePreviewCollection({
        inputDir: sourceDirectory,
        outputDir: previewDirectory,
        expectedCount: requiredCount,
        concurrency: workerCount,
    })
}

export async function validatePreviewCollection({
    inputDir,
    outputDir,
    expectedCount,
    concurrency = 4,
}) {
    const sourceDirectory = requireDirectory(inputDir, 'inputDir')
    const previewDirectory = requireDirectory(outputDir, 'outputDir')
    const requiredCount = requirePositiveInteger(expectedCount, 'expectedCount')
    const workerCount = requirePositiveInteger(concurrency, 'concurrency')
    const [sources, previews] = await Promise.all([
        listFilesWithExtension(sourceDirectory, '.png'),
        listFilesWithExtension(previewDirectory, '.webp'),
    ])
    requireExactCount(sources, requiredCount, 'PNG originals')

    const requiredPreviews = sources.map(outputName)
    const previewSet = new Set(previews)
    const missing = requiredPreviews.filter((name) => !previewSet.has(name))
    const requiredSet = new Set(requiredPreviews)
    const extras = previews.filter((name) => !requiredSet.has(name))
    if (missing.length > 0) {
        throw new Error(`Missing preview files: ${missing.join(', ')}`)
    }
    if (extras.length > 0) {
        throw new Error(`Unexpected preview files: ${extras.join(', ')}`)
    }
    requireExactCount(previews, requiredCount, 'WebP previews')

    const manifestPath = join(previewDirectory, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    if (
        manifest.sourceCount !== requiredCount
        || manifest.outputCount !== requiredCount
    ) {
        throw new Error(`Manifest count mismatch in ${manifestPath}`)
    }
    const manifestFiles = new Map(
        manifest.files.map((file) => [file.preview, file]),
    )
    let totalOutputBytes = 0
    await runBounded(previews, workerCount, async (previewName) => {
        const previewPath = join(previewDirectory, previewName)
        const [metadata, previewInfo] = await Promise.all([
            sharp(previewPath).metadata(),
            stat(previewPath),
        ])
        if (
            metadata.format !== 'webp'
            || metadata.width !== PREVIEW_SETTINGS.width
            || metadata.height !== PREVIEW_SETTINGS.height
        ) {
            throw new Error(`Invalid preview format or dimensions: ${previewName}`)
        }
        const entry = manifestFiles.get(previewName)
        if (!entry || entry.previewBytes !== previewInfo.size) {
            throw new Error(`Manifest entry mismatch: ${previewName}`)
        }
        totalOutputBytes += previewInfo.size
    })

    if (manifestFiles.size !== previews.length) {
        throw new Error(`Manifest file set mismatch in ${manifestPath}`)
    }

    return {
        sourceCount: sources.length,
        outputCount: previews.length,
        totalOutputBytes,
    }
}

export function parsePreviewCliArgs(argv, { allowConcurrency }) {
    const allowed = new Set(['--input', '--output', '--expected-count'])
    if (allowConcurrency) allowed.add('--concurrency')
    const values = {}

    for (let index = 0; index < argv.length; index += 2) {
        const flag = argv[index]
        const value = argv[index + 1]
        if (!allowed.has(flag) || value === undefined) {
            throw new Error(`Invalid preview CLI argument: ${flag ?? '(missing)'}`)
        }
        values[flag] = value
    }

    return {
        inputDir: requireDirectory(values['--input'], '--input'),
        outputDir: requireDirectory(values['--output'], '--output'),
        expectedCount: requirePositiveInteger(
            values['--expected-count'],
            '--expected-count',
        ),
        ...(allowConcurrency
            ? {
                concurrency: values['--concurrency'] === undefined
                    ? 4
                    : requirePositiveInteger(
                        values['--concurrency'],
                        '--concurrency',
                    ),
            }
            : {}),
    }
}
