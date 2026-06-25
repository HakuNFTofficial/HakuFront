import { useEffect, useState } from 'react'

interface NetworkMismatchModalProps {
    isOpen: boolean
    currentChainName: string
    currentChainId: number
    requiredChainName: string
    requiredChainId: number
    onSwitchNetwork: () => void
    isSwitching: boolean
}

export function NetworkMismatchModal({
    isOpen,
    currentChainName,
    currentChainId,
    requiredChainName,
    requiredChainId,
    onSwitchNetwork,
    isSwitching
}: NetworkMismatchModalProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (isOpen) {
            // Delay display to trigger animation
            setTimeout(() => setIsVisible(true), 10)
        } else {
            setIsVisible(false)
        }
    }, [isOpen])

    if (!isOpen) return null

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'
                }`}
        >
            {/* Overlay background */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                style={{
                    animation: isVisible ? 'fadeIn 0.3s ease-out' : 'fadeOut 0.3s ease-out'
                }}
            />

            {/* Modal content */}
            <div
                className={`relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl border border-yellow-500/30 max-w-md w-full transform transition-all duration-300 ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
                    }`}
                style={{
                    boxShadow: '0 0 50px rgba(234, 179, 8, 0.3), 0 20px 40px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* Top decoration bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-t-2xl" />

                {/* Warning icon */}
                <div className="flex justify-center pt-8 pb-4">
                    <div className="relative">
                        {/* Outer glow */}
                        <div className="absolute inset-0 rounded-full bg-yellow-500/20 blur-xl animate-pulse" />
                        {/* Icon container */}
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center shadow-lg">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-10 w-10 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="px-8 pb-6 text-center">
                    <h2 className="text-2xl font-bold text-white mb-3">Network Mismatch</h2>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        Your wallet is connected to the wrong network. Please switch to the correct network to continue
                    </p>
                </div>

                {/* Network Information Comparison */}
                <div className="px-8 pb-6 space-y-4">
                    {/* Current Network */}
                    <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <div>
                                    <div className="text-xs text-red-400 font-medium">Current Network</div>
                                    <div className="text-white font-semibold mt-1">{currentChainName}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">Chain ID: {currentChainId}</div>
                                </div>
                            </div>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-red-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="flex justify-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 text-yellow-500 animate-bounce"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>

                    {/* Required Network */}
                    <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <div>
                                    <div className="text-xs text-green-400 font-medium">Required Network</div>
                                    <div className="text-white font-semibold mt-1">{requiredChainName}</div>
                                    <div className="text-xs text-gray-400 mt-0.5">Chain ID: {requiredChainId}</div>
                                </div>
                            </div>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5 text-green-500"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Button */}
                <div className="px-8 pb-8">
                    <button
                        onClick={onSwitchNetwork}
                        disabled={isSwitching}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSwitching ? (
                            <>
                                <svg
                                    className="animate-spin h-5 w-5 text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                <span>Switching...</span>
                            </>
                        ) : (
                            <>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                                <span>Switch Network</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Bottom hint */}
                <div className="px-8 pb-6 text-center">
                    <p className="text-xs text-gray-500">
                    After clicking the button, your wallet will pop up a confirmation request.
                    </p>
                </div>
            </div>
        </div>
    )
}
