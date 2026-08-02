import { useEffect, useMemo, useRef, useState } from 'react'
import type { Connector } from 'wagmi'
import {
    getWalletConnectionErrorMessage,
    normalizeWalletOptions,
} from '../wallet/walletOptions'

interface WalletConnectModalProps {
    isOpen: boolean
    connectors: readonly Connector[]
    onClose: () => void
    onConnect: (connector: Connector) => Promise<unknown>
}

export function WalletConnectModal({
    isOpen,
    connectors,
    onClose,
    onConnect,
}: WalletConnectModalProps) {
    const [pendingConnectorUid, setPendingConnectorUid] = useState<
        string | null
    >(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const dialogRef = useRef<HTMLElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const firstWalletRef = useRef<HTMLButtonElement>(null)
    const pendingConnectorUidRef = useRef<string | null>(null)
    const isOpenRef = useRef(isOpen)
    isOpenRef.current = isOpen
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose
    const options = useMemo(
        () => normalizeWalletOptions(connectors),
        [connectors],
    )

    useEffect(() => {
        if (!isOpen) {
            setErrorMessage(null)
            return
        }

        const previousFocus = document.activeElement as HTMLElement | null
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const focusFrame = window.requestAnimationFrame(() => {
            ;(firstWalletRef.current ?? closeButtonRef.current)?.focus()
        })
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (pendingConnectorUidRef.current === null) {
                    onCloseRef.current()
                }
                return
            }

            if (event.key !== 'Tab') return

            const focusableElements = Array.from(
                dialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ) ?? [],
            )
            const firstFocusable = focusableElements[0]
            const lastFocusable = focusableElements[focusableElements.length - 1]

            if (!firstFocusable || !lastFocusable) {
                event.preventDefault()
                dialogRef.current?.focus()
                return
            }

            const activeElement = document.activeElement
            const focusIsOutside = !dialogRef.current?.contains(activeElement)

            if (event.shiftKey && (activeElement === firstFocusable || focusIsOutside)) {
                event.preventDefault()
                lastFocusable.focus()
            } else if (
                !event.shiftKey &&
                (activeElement === lastFocusable || focusIsOutside)
            ) {
                event.preventDefault()
                firstFocusable.focus()
            }
        }
        window.addEventListener('keydown', handleKeyDown)

        return () => {
            window.cancelAnimationFrame(focusFrame)
            window.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = previousOverflow
            previousFocus?.focus()
        }
    }, [isOpen])

    if (!isOpen) return null

    const isConnecting = pendingConnectorUid !== null

    function requestClose() {
        if (pendingConnectorUidRef.current !== null) return
        onCloseRef.current()
    }

    async function handleConnect(connector: Connector) {
        if (pendingConnectorUidRef.current !== null) return

        pendingConnectorUidRef.current = connector.uid
        setPendingConnectorUid(connector.uid)
        setErrorMessage(null)

        try {
            await onConnect(connector)
            onCloseRef.current()
        } catch (error) {
            if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
                console.error('[WalletConnectModal] Connection failed:', error)
            }
            if (isOpenRef.current) {
                setErrorMessage(getWalletConnectionErrorMessage(error))
            }
        } finally {
            pendingConnectorUidRef.current = null
            setPendingConnectorUid(null)
        }
    }

    return (
        <div
            data-testid="wallet-modal-backdrop"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) requestClose()
            }}
        >
            <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="wallet-connect-title"
                aria-describedby="wallet-connect-description"
                tabIndex={-1}
                className="relative w-full max-w-md overflow-hidden rounded-2xl border border-indigo-500/40 bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-2xl"
                style={{
                    boxShadow:
                        '0 0 50px rgba(99, 102, 241, 0.22), 0 20px 40px rgba(0, 0, 0, 0.5)',
                }}
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-7">
                    <div>
                        <h2
                            id="wallet-connect-title"
                            className="text-xl font-bold text-white"
                        >
                            Connect Wallet
                        </h2>
                        <p
                            id="wallet-connect-description"
                            className="mt-1 text-sm text-gray-400"
                        >
                            Choose a wallet to continue
                        </p>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        aria-label="Close wallet picker"
                        disabled={isConnecting}
                        onClick={requestClose}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-gray-400 transition-colors hover:bg-gray-700 hover:text-white focus:ring-2 focus:ring-indigo-500 disabled:cursor-wait disabled:opacity-50"
                    >
                        <span aria-hidden="true">×</span>
                    </button>
                </div>

                <div className="max-h-[min(60vh,32rem)] space-y-2 overflow-y-auto px-4 pb-4">
                    {options.map((option, index) => {
                        const isPending =
                            option.connector.uid === pendingConnectorUid
                        const initial =
                            option.label.trim().charAt(0).toUpperCase() || '?'

                        return (
                            <button
                                key={option.connector.uid}
                                ref={index === 0 ? firstWalletRef : undefined}
                                type="button"
                                disabled={isConnecting}
                                onClick={() => handleConnect(option.connector)}
                                className="group flex w-full items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/80 px-4 py-3 text-left transition-all hover:border-indigo-500/70 hover:bg-gray-700/80 focus:ring-2 focus:ring-indigo-500 disabled:cursor-wait disabled:opacity-60"
                            >
                                {option.connector.icon ? (
                                    <img
                                        src={option.connector.icon}
                                        alt=""
                                        className="h-10 w-10 shrink-0 rounded-xl object-cover"
                                    />
                                ) : (
                                    <span
                                        aria-hidden="true"
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-bold text-white"
                                    >
                                        {initial}
                                    </span>
                                )}

                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-white">
                                        {option.label}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-gray-400">
                                        {option.description}
                                    </span>
                                </span>

                                {isPending ? (
                                    <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-indigo-300">
                                        <span
                                            aria-hidden="true"
                                            className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300 border-t-transparent"
                                        />
                                        Connecting...
                                    </span>
                                ) : option.isDetected ? (
                                    <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-1 text-[10px] font-medium text-green-300">
                                        Detected
                                    </span>
                                ) : (
                                    <span
                                        aria-hidden="true"
                                        className="shrink-0 text-lg text-gray-500 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-300"
                                    >
                                        ›
                                    </span>
                                )}
                            </button>
                        )
                    })}

                    {options.length === 0 && (
                        <div className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-6 text-center text-sm text-gray-400">
                            No compatible wallets are available.
                        </div>
                    )}
                </div>

                {errorMessage && (
                    <div className="px-4 pb-4">
                        <div
                            role="alert"
                            className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                        >
                            {errorMessage}
                        </div>
                    </div>
                )}

                <div className="border-t border-gray-700/70 px-6 py-4 text-center text-xs text-gray-500">
                    Only connect wallets you trust.
                </div>
            </section>
        </div>
    )
}
