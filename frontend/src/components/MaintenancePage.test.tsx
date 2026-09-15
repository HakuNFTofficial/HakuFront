import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MaintenancePage } from './MaintenancePage'

describe('MaintenancePage', () => {
    it('shows the Haku Sealed announcement and community links', () => {
        render(<MaintenancePage />)

        expect(screen.getByRole('heading', { name: 'Sealing the next chapter.' })).toBeInTheDocument()
        expect(screen.getByText(
            'Our dApp will be paused during the “Haku Sealed” mint and will return to the Arc mainnet soon.',
        )).toBeInTheDocument()
        expect(screen.getByText('Upgrade in progress')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Follow Haku on X' })).toHaveAttribute(
            'href',
            'https://x.com/HakuNFTofficial',
        )
        expect(screen.getByRole('link', { name: 'Join Haku on Discord' })).toHaveAttribute(
            'href',
            'https://discord.com/invite/zURfGaNf6p',
        )
    })

    it('disables decorative motion when reduced motion is requested', () => {
        const stylesheetPath = resolve(process.cwd(), 'src/components/MaintenancePage.css')
        const stylesheet = readFileSync(stylesheetPath, 'utf8')

        expect(stylesheet).toContain('@media (prefers-reduced-motion: reduce)')
        expect(stylesheet).toContain('animation: none')
    })
})
