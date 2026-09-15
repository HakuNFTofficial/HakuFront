import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RootView } from './RootView'

describe('RootView', () => {
    it('shows maintenance and does not mount the dApp content when enabled', () => {
        render(
            <RootView maintenanceMode>
                <div>Live dApp</div>
            </RootView>,
        )

        expect(screen.getByRole('heading', { name: 'Sealing the next chapter.' })).toBeInTheDocument()
        expect(screen.queryByText('Live dApp')).not.toBeInTheDocument()
    })

    it('shows the dApp content when maintenance is disabled', () => {
        render(
            <RootView maintenanceMode={false}>
                <div>Live dApp</div>
            </RootView>,
        )

        expect(screen.getByText('Live dApp')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Sealing the next chapter.' })).not.toBeInTheDocument()
    })
})
