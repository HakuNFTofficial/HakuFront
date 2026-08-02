import type { Connector } from 'wagmi'
import { describe, expect, test } from 'vitest'
import {
    getWalletConnectionErrorMessage,
    normalizeWalletOptions,
} from './walletOptions'

function connector(
    values: Partial<Connector> & Pick<Connector, 'id' | 'name' | 'type'>,
): Connector {
    return {
        uid: values.uid ?? `${values.id}-uid`,
        icon: values.icon,
        ...values,
    } as Connector
}

describe('normalizeWalletOptions', () => {
    test('prefers named EIP-6963 wallets over the generic injected fallback', () => {
        const options = normalizeWalletOptions([
            connector({ id: 'injected', name: 'Injected', type: 'injected' }),
            connector({ id: 'io.metamask', name: 'MetaMask', type: 'injected' }),
            connector({ id: 'io.rabby', name: 'Rabby Wallet', type: 'injected' }),
        ])

        expect(options.map((option) => option.connector.id)).toEqual([
            'io.metamask',
            'io.rabby',
        ])
        expect(options.every((option) => option.isDetected)).toBe(true)
    })

    test('keeps Browser Wallet when no named injected provider is discovered', () => {
        const options = normalizeWalletOptions([
            connector({ id: 'injected', name: 'Injected', type: 'injected' }),
        ])

        expect(options.map((option) => option.label)).toEqual(['Browser Wallet'])
        expect(options[0]?.isDetected).toBe(false)
    })

    test('deduplicates providers and places WalletConnect last', () => {
        const options = normalizeWalletOptions([
            connector({
                id: 'walletConnect',
                name: 'WalletConnect',
                type: 'walletConnect',
            }),
            connector({
                id: 'io.metamask',
                name: 'MetaMask',
                type: 'injected',
                uid: 'first',
            }),
            connector({
                id: 'io.metamask',
                name: 'MetaMask',
                type: 'injected',
                uid: 'second',
            }),
        ])

        expect(options.map((option) => option.connector.uid)).toEqual([
            'first',
            'walletConnect-uid',
        ])
        expect(options[1]?.description).toBe('Scan with a mobile wallet')
    })
})

describe('getWalletConnectionErrorMessage', () => {
    test('recognizes user rejection', () => {
        expect(
            getWalletConnectionErrorMessage({ name: 'UserRejectedRequestError' }),
        ).toBe('Connection request was cancelled.')
    })

    test('recognizes a missing provider', () => {
        expect(
            getWalletConnectionErrorMessage({ name: 'ProviderNotFoundError' }),
        ).toBe('This wallet is not available. Check the extension and try again.')
    })

    test('recognizes an already-open wallet request', () => {
        expect(
            getWalletConnectionErrorMessage({ name: 'ResourceUnavailableRpcError' }),
        ).toBe('A wallet request is already open. Complete or close it, then try again.')
    })

    test('uses a recoverable fallback message', () => {
        expect(getWalletConnectionErrorMessage(new Error('relay failed'))).toBe(
            'Could not connect to this wallet. Please try again.',
        )
    })
})
