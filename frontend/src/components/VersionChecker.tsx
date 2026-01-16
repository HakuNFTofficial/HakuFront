/**
 * Version checker component (optional)
 * Periodically check for new versions and prompt user to refresh
 */

import { useEffect, useState } from 'react'
import { checkForUpdate, getVersionInfo } from '../utils/version'

interface VersionCheckerProps {
    /** Check interval (milliseconds), default 5 minutes */
    checkInterval?: number
    /** Whether to automatically show update prompt */
    autoShow?: boolean
}

const STORAGE_KEY = 'version_checker_dismissed'


function getDismissedVersions(): string[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

function dismissVersion(version: string) {
    try {
        const dismissed = getDismissedVersions()
        if (!dismissed.includes(version)) {
            dismissed.push(version)
            // Only keep the last 10 dismissed versions
            const recent = dismissed.slice(-10)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
        }
    } catch (error) {
        console.warn('[VersionChecker] Failed to save dismissed version:', error)
    }
}


function isVersionDismissed(version: string): boolean {
    return getDismissedVersions().includes(version)
}

export function VersionChecker({ 
    checkInterval = 5 * 60 * 1000, // Default 5 minutes
    autoShow = true 
}: VersionCheckerProps) {
    const [hasUpdate, setHasUpdate] = useState(false)
    const [showPrompt, setShowPrompt] = useState(false)
    const [serverVersion, setServerVersion] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true

        const checkUpdate = async () => {
            const updateAvailable = await checkForUpdate()
            
            if (!mounted) return

            if (updateAvailable) {
                // Get server version number
                try {
                    const response = await fetch('/index.html', { cache: 'no-store' })
                    const html = await response.text()
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(html, 'text/html')
                    const sv = doc.querySelector('meta[name="app-version"]')?.getAttribute('content')
                    
                    if (sv && !isVersionDismissed(sv)) {
                        setServerVersion(sv)
                        setHasUpdate(true)
                        if (autoShow) {
                            setShowPrompt(true)
                        }
                    } else if (sv && isVersionDismissed(sv)) {
                        // Version dismissed by user, don't show prompt
                        setHasUpdate(false)
                        setShowPrompt(false)
                    }
                } catch (error) {
                    console.warn('[VersionChecker] Failed to get server version:', error)
                }
            } else {
                setHasUpdate(false)
                setShowPrompt(false)
            }
        }

        // Initial check
        checkUpdate()

        // Periodically check for updates
        const interval = setInterval(checkUpdate, checkInterval)

        return () => {
            mounted = false
            clearInterval(interval)
        }
    }, [checkInterval, autoShow])

    const handleRefresh = () => {
        // Clear locally stored dismissed versions as page is about to refresh
        if (serverVersion) {
            localStorage.removeItem(STORAGE_KEY)
        }
        // Force refresh page
        window.location.reload()
    }

    const handleDismiss = () => {
        if (serverVersion) {
            dismissVersion(serverVersion)
        }
        setShowPrompt(false)
    }

    if (!showPrompt || !hasUpdate || !serverVersion) {
        return null
    }

    const versionInfo = getVersionInfo()

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-[#20212d] border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
                {/* Top gradient decoration bar */}
                <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"></div>
                
                <div className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                       
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-2xl animate-bounce">
                            ✨
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-bold text-white text-lg bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                    New version available!
                                </h3>
                    </div>
                            <p className="text-sm text-gray-300 mb-3 leading-relaxed">
                                New features are available. Refresh the page to update.
                            </p>
                            <div className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded inline-block">
                                <span className="text-gray-500">Installed:</span> <span className="text-gray-300">{versionInfo.version}</span>
                                <span className="mx-2 text-purple-400">→</span>
                                <span className="text-gray-500">Available:</span> <span className="text-pink-400 font-medium">{serverVersion}</span>
                    </div>
                </div>
                        
                <button
                    onClick={handleDismiss}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-700/50"
                    aria-label="Close"
                >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                </button>
            </div>
                    
                    {/* Button group */}
                    <div className="flex gap-3">
                <button
                    onClick={handleRefresh}
                            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2.5 rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                >
                            <span>🚀</span>
                            <span>Refresh Now</span>
                </button>
                <button
                    onClick={handleDismiss}
                            className="px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500 transition-all duration-200 hover:text-white"
                >
                    Later
                </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

