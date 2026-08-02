import type { Connector } from 'wagmi'

export interface WalletOption {
    connector: Connector
    label: string
    description: string
    isDetected: boolean
}

function isGenericInjected(connector: Connector) {
    return connector.type === 'injected' && connector.id === 'injected'
}

export function normalizeWalletOptions(
    connectors: readonly Connector[],
): WalletOption[] {
    const unique = new Map<string, Connector>()

    for (const connector of connectors) {
        const key = `${connector.type}:${connector.id}`.toLowerCase()
        if (!unique.has(key)) unique.set(key, connector)
    }

    const values = [...unique.values()]
    const hasNamedInjected = values.some(
        (connector) =>
            connector.type === 'injected' && !isGenericInjected(connector),
    )

    return values
        .filter(
            (connector) =>
                !(hasNamedInjected && isGenericInjected(connector)),
        )
        .sort(
            (left, right) =>
                Number(left.type === 'walletConnect') -
                Number(right.type === 'walletConnect'),
        )
        .map((connector) => ({
            connector,
            label: isGenericInjected(connector)
                ? 'Browser Wallet'
                : connector.name,
            description:
                connector.type === 'walletConnect'
                    ? 'Scan with a mobile wallet'
                    : isGenericInjected(connector)
                      ? 'Connect an installed browser wallet'
                      : 'Browser extension',
            isDetected:
                connector.type === 'injected' &&
                !isGenericInjected(connector),
        }))
}

export function getWalletConnectionErrorMessage(error: unknown) {
    const value = error as {
        code?: number
        message?: string
        name?: string
    }
    const message = value?.message ?? ''

    if (
        value?.name === 'UserRejectedRequestError' ||
        value?.code === 4001 ||
        value?.code === 5000 ||
        /user rejected|request rejected|connection request reset/i.test(
            message,
        )
    ) {
        return 'Connection request was cancelled.'
    }

    if (value?.name === 'ProviderNotFoundError') {
        return 'This wallet is not available. Check the extension and try again.'
    }

    if (
        value?.name === 'ResourceUnavailableRpcError' ||
        /already pending|request already/i.test(message)
    ) {
        return 'A wallet request is already open. Complete or close it, then try again.'
    }

    return 'Could not connect to this wallet. Please try again.'
}
