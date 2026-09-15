import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { logVersionInfo } from './utils/version'
import { RootView } from './RootView'
import { isMaintenanceMode } from './config/maintenance'

// Display version information in development environment or when debugging is needed
if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
    logVersionInfo()
}

const root = createRoot(document.getElementById('root')!)
const maintenanceMode = isMaintenanceMode(import.meta.env.VITE_MAINTENANCE_MODE)

if (maintenanceMode) {
    root.render(
        <StrictMode>
            <RootView maintenanceMode />
        </StrictMode>,
    )
} else {
    void import('./DappRoot').then(({ DappRoot }) => {
        root.render(
            <StrictMode>
                <RootView maintenanceMode={false}>
                    <DappRoot />
                </RootView>
            </StrictMode>,
        )
    })
}
