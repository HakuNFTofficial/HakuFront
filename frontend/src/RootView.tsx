import type { PropsWithChildren } from 'react'

import { MaintenancePage } from './components/MaintenancePage'

interface RootViewProps {
    maintenanceMode: boolean
}

export function RootView({ maintenanceMode, children }: PropsWithChildren<RootViewProps>) {
    return maintenanceMode ? <MaintenancePage /> : <>{children}</>
}
