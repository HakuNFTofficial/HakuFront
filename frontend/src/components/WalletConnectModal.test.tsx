import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Connector } from 'wagmi'
import { describe, expect, test, vi } from 'vitest'
import { WalletConnectModal } from './WalletConnectModal'

function connector(
    values: Partial<Connector> & Pick<Connector, 'id' | 'name' | 'type'>,
): Connector {
    return {
        uid: values.uid ?? `${values.id}-uid`,
        icon: values.icon,
        ...values,
    } as Connector
}

const generic = connector({
    id: 'injected',
    name: 'Injected',
    type: 'injected',
})
const metaMask = connector({
    id: 'io.metamask',
    name: 'MetaMask',
    type: 'injected',
})
const rabby = connector({
    id: 'io.rabby',
    name: 'Rabby Wallet',
    type: 'injected',
})
const walletConnect = connector({
    id: 'walletConnect',
    name: 'WalletConnect',
    type: 'walletConnect',
})

const connectors = [generic, metaMask, rabby, walletConnect]

describe('WalletConnectModal', () => {
    test('renders discovered wallets without the duplicate generic fallback', () => {
        render(
            <WalletConnectModal
                isOpen
                connectors={connectors}
                onClose={vi.fn()}
                onConnect={vi.fn()}
            />,
        )

        expect(
            screen.getByRole('dialog', { name: 'Connect Wallet' }),
        ).toBeInTheDocument()
        expect(
            screen.queryByRole('button', { name: /Browser Wallet/i }),
        ).not.toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /MetaMask/i }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /Rabby Wallet/i }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /WalletConnect/i }),
        ).toBeInTheDocument()
        expect(screen.getAllByText('Detected')).toHaveLength(2)
    })

    test('connects only the selected wallet and closes after success', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const onConnect = vi.fn().mockResolvedValue(undefined)
        render(
            <WalletConnectModal
                isOpen
                connectors={connectors}
                onClose={onClose}
                onConnect={onConnect}
            />,
        )

        await user.click(screen.getByRole('button', { name: /Rabby Wallet/i }))

        expect(onConnect).toHaveBeenCalledTimes(1)
        expect(onConnect).toHaveBeenCalledWith(rabby)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    test('disables wallet choices while the selected connection is pending', async () => {
        const user = userEvent.setup()
        let resolveConnection: (() => void) | undefined
        const onConnect = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveConnection = resolve
                }),
        )
        render(
            <WalletConnectModal
                isOpen
                connectors={connectors}
                onClose={vi.fn()}
                onConnect={onConnect}
            />,
        )

        await user.click(screen.getByRole('button', { name: /MetaMask/i }))

        expect(
            screen.getByRole('button', { name: /MetaMask.*Connecting/i }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: /Rabby Wallet/i }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: /WalletConnect/i }),
        ).toBeDisabled()

        await act(async () => resolveConnection?.())
    })

    test('keeps the modal open and shows a recoverable connection error', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        render(
            <WalletConnectModal
                isOpen
                connectors={connectors}
                onClose={onClose}
                onConnect={vi
                    .fn()
                    .mockRejectedValue({ name: 'UserRejectedRequestError' })}
            />,
        )

        await user.click(screen.getByRole('button', { name: /MetaMask/i }))

        expect(
            await screen.findByRole('alert'),
        ).toHaveTextContent('Connection request was cancelled.')
        expect(onClose).not.toHaveBeenCalled()
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: /MetaMask/i }),
            ).toBeEnabled(),
        )
    })

    test('closes from the close button, backdrop, and Escape key', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        render(
            <WalletConnectModal
                isOpen
                connectors={connectors}
                onClose={onClose}
                onConnect={vi.fn()}
            />,
        )

        await user.click(screen.getByRole('button', { name: 'Close wallet picker' }))
        await user.click(screen.getByTestId('wallet-modal-backdrop'))
        await user.keyboard('{Escape}')

        expect(onClose).toHaveBeenCalledTimes(3)
    })

    test('does not render when closed', () => {
        render(
            <WalletConnectModal
                isOpen={false}
                connectors={connectors}
                onClose={vi.fn()}
                onConnect={vi.fn()}
            />,
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
