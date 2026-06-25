/**
 * Version Management Utility
 * Used to get and check application version
 */

// Get version information from environment variables (injected by Vite)
export const APP_VERSION = (import.meta.env?.APP_VERSION as string) || '0.0.0'
export const BUILD_TIME = (import.meta.env?.BUILD_TIME as string) || ''

/**
 * Get version information
 */
export function getVersionInfo() {
    return {
        version: APP_VERSION,
        buildTime: BUILD_TIME,
        timestamp: BUILD_TIME ? new Date(BUILD_TIME).getTime() : 0
    }
}

/**
 * Compare version numbers (supports semantic versioning, e.g. 1.0.1, 1.0.2)
 * Returns true if newVersion > currentVersion
 */
function compareVersions(currentVersion: string, newVersion: string): boolean {
    const current = currentVersion.split('.').map(Number)
    const newer = newVersion.split('.').map(Number)
    
    for (let i = 0; i < Math.max(current.length, newer.length); i++) {
        const currentPart = current[i] || 0
        const newerPart = newer[i] || 0
        
        if (newerPart > currentPart) return true
        if (newerPart < currentPart) return false
    }
    
    return false
}

/**
 * Check for new version (by reading meta tags in index.html)
 */
export async function checkForUpdate(): Promise<boolean> {
    try {
        // Fetch index.html to get server-side version number
        const response = await fetch('/index.html', { 
            cache: 'no-store', // Ensure no cache is used
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        })
        
        if (!response.ok) {
            return false
        }
        
        const html = await response.text()
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        
        // Get server version from meta tag
        const serverVersion = doc.querySelector('meta[name="app-version"]')?.getAttribute('content')
        
        if (!serverVersion) {
            console.warn('[Version] No version found in index.html')
            return false
        }
        
        // Compare versions: only prompt when server version is actually newer
        if (serverVersion !== APP_VERSION) {
            const hasNewerVersion = compareVersions(APP_VERSION, serverVersion)
            if (hasNewerVersion) {
                console.log(`[Version] New version detected: ${serverVersion} (current: ${APP_VERSION})`)
                return true
            } else {
                // Server version is older, do not prompt for update
                console.log(`[Version] Server version is older: ${serverVersion} < ${APP_VERSION}`)
                return false
            }
        }
        
        // Same version, do not prompt for update
        // Note: No longer comparing build time because development environment generates new build time on each restart
        // This causes false positives. If you need to detect different builds of the same version, use version numbers to distinguish
        console.log(`[Version] Same version: ${APP_VERSION}`)
        return false
    } catch (error) {
        console.warn('[Version] Failed to check for update:', error)
        return false
    }
}

/**
 * Display version information in console (for development debugging)
 */
export function logVersionInfo() {
    const info = getVersionInfo()
    console.log('%cApp Version Info', 'color: #4ade80; font-weight: bold; font-size: 14px;')
    console.log('Version:', info.version)
    console.log('Build Time:', info.buildTime || 'Unknown')
    if (info.timestamp) {
        console.log('Build Timestamp:', new Date(info.timestamp).toLocaleString())
    }
}

