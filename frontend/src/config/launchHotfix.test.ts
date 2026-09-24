// @vitest-environment node

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('production launch hotfixes', () => {
    it('keeps unfinished NFT silhouettes visible against the dark Swap card', () => {
        const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
        const brightness = css.match(/\.nft-preview-shadow\s*\{[^}]*brightness\(([^)]+)\)/)?.[1]

        expect(brightness).toBeDefined()
        expect(Number(brightness)).toBeGreaterThanOrEqual(0.45)
    })

    it('uses the Pino version required by WalletConnect logger', () => {
        const packageJson = JSON.parse(readFileSync(
            new URL('../../package.json', import.meta.url),
            'utf8',
        ))
        const packageLock = JSON.parse(readFileSync(
            new URL('../../package-lock.json', import.meta.url),
            'utf8',
        ))

        expect(packageJson.overrides?.['@walletconnect/logger']).toBeUndefined()
        expect(packageLock.packages['node_modules/@walletconnect/logger'].dependencies.pino)
            .toBe('7.11.0')
        expect(packageLock.packages['node_modules/@walletconnect/logger/node_modules/pino'].version)
            .toBe('7.11.0')
    })
})
