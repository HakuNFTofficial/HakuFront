import {
    generatePreviewCollection,
    parsePreviewCliArgs,
} from './preview-lib.mjs'

try {
    const options = parsePreviewCliArgs(
        process.argv.slice(2),
        { allowConcurrency: true },
    )
    console.log(JSON.stringify(await generatePreviewCollection(options), null, 2))
} catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
}
