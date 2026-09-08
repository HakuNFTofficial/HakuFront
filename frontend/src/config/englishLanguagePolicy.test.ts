// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const frontendRoot = fileURLToPath(new URL('../../', import.meta.url))
const excludedDirectories = new Set(['coverage', 'dist', 'node_modules'])
const sourceExtensions = new Set([
    '.cjs',
    '.css',
    '.html',
    '.js',
    '.jsx',
    '.mjs',
    '.sh',
    '.svg',
    '.ts',
    '.tsx',
])
const hanCharacter = /\p{Script=Han}/u

function collectSourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = join(directory, entry.name)

        if (entry.isDirectory()) {
            return excludedDirectories.has(entry.name)
                ? []
                : collectSourceFiles(entryPath)
        }

        return sourceExtensions.has(extname(entry.name)) ? [entryPath] : []
    })
}

describe('frontend language policy', () => {
    it('keeps first-party source, comments, and script messages in English', () => {
        const violations = collectSourceFiles(frontendRoot).flatMap((filePath) => {
            const displayPath = relative(frontendRoot, filePath).split('\\').join('/')

            return readFileSync(filePath, 'utf8')
                .split('\n')
                .flatMap((line, index) => hanCharacter.test(line)
                    ? [`${displayPath}:${index + 1}: ${line.trim()}`]
                    : [])
        })

        expect(violations).toEqual([])
    })
})
