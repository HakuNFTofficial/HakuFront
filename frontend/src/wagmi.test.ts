import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('wagmi transport', () => {
    it('uses the same-origin RPC gateway for browser reads', () => {
        const source = readFileSync(new URL('./wagmi.ts', import.meta.url), 'utf8')

        expect(source).toContain("export const RPC_PROXY_URL = '/api/rpc'")
        expect(source).toContain('http(RPC_PROXY_URL')
        expect(source).not.toContain("http('https://rpc.testnet.arc.network')")
    })
})
