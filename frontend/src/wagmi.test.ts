// @vitest-environment node

import { readFileSync } from 'node:fs'

import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    createConfig: vi.fn((parameters: unknown) => parameters),
    defineChain: vi.fn((chain: unknown) => chain),
    http: vi.fn((url: string) => `http:${url}`),
    injected: vi.fn(() => 'injected-connector'),
    walletConnect: vi.fn(() => 'wallet-connect-connector'),
}))

vi.mock('wagmi', () => ({
    createConfig: mocks.createConfig,
    http: mocks.http,
}))

vi.mock('wagmi/connectors', () => ({
    injected: mocks.injected,
    walletConnect: mocks.walletConnect,
}))

vi.mock('viem', () => ({
    defineChain: mocks.defineChain,
}))

describe('wagmi wallet configuration', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.clearAllMocks()
        vi.unstubAllEnvs()
    })

    test('enables EIP-6963 and WalletConnect when a Project ID exists', async () => {
        vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', ' test-project-id ')

        await import('./wagmi')

        expect(mocks.createConfig).toHaveBeenCalledWith(
            expect.objectContaining({
                multiInjectedProviderDiscovery: true,
                connectors: [
                    'injected-connector',
                    'wallet-connect-connector',
                ],
            }),
        )
        expect(mocks.injected).toHaveBeenCalledTimes(1)
        expect(mocks.injected).toHaveBeenCalledWith({ shimDisconnect: true })
        expect(mocks.walletConnect).toHaveBeenCalledWith(
            expect.objectContaining({
                projectId: 'test-project-id',
                showQrModal: true,
                metadata: expect.objectContaining({ name: 'Haku' }),
            }),
        )
    })

    test('omits WalletConnect when the Project ID is empty', async () => {
        vi.stubEnv('VITE_WALLETCONNECT_PROJECT_ID', '   ')

        await import('./wagmi')

        expect(mocks.createConfig).toHaveBeenCalledWith(
            expect.objectContaining({
                multiInjectedProviderDiscovery: true,
                connectors: ['injected-connector'],
            }),
        )
        expect(mocks.injected).toHaveBeenCalledTimes(1)
        expect(mocks.walletConnect).not.toHaveBeenCalled()
    })
})

describe('wagmi transport', () => {
    test('uses the same-origin RPC gateway for browser reads', () => {
        const source = readFileSync(new URL('./wagmi.ts', import.meta.url), 'utf8')

        expect(source).toContain("export const RPC_PROXY_URL = '/api/rpc'")
        expect(source).toContain('http(RPC_PROXY_URL')
        expect(source).toContain('retryCount: 0')
        expect(source).toContain('timeout: 40_000')
        expect(source).not.toContain("http('https://rpc.testnet.arc.network')")
    })
})
