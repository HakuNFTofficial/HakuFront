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
