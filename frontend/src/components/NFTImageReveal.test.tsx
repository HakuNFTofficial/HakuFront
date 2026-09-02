import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NFTImageReveal } from './NFTImageReveal'

vi.mock('wagmi', () => ({
    useAccount: () => ({ address: '0x1234' }),
}))

const nft = {
    nft_id: 3995,
    file_name: '3995.png',
    all_chips_owned: false,
    owned_chips_count: 23,
    total_chips_count: 10_000,
}

describe('NFTImageReveal', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it.each([0, 1])('renders only the silhouette for is_mint=%i', (is_mint) => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        render(<NFTImageReveal nft={{ ...nft, is_mint }} />)

        expect(screen.getByRole('img', { name: 'NFT #3995 silhouette' }))
            .toHaveAttribute('src', expect.stringContaining('/bafy-preview/3995.webp'))
        expect(screen.getByRole('img').getAttribute('src')).not.toContain(
            '/QmWALFJVacNc1EpMKdxMuCedDVcNwmWoc3L2jqX8erAb6L/',
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('renders the original only for is_mint=2 and exposes the viewer action', () => {
        const onViewOriginal = vi.fn()
        render(<NFTImageReveal nft={{ ...nft, is_mint: 2 }} onViewOriginal={onViewOriginal} />)

        expect(screen.getByRole('img', { name: 'NFT #3995' }))
            .toHaveAttribute('src', expect.stringContaining('/3995.png'))
        fireEvent.click(screen.getByRole('button', { name: 'View original NFT #3995' }))
        expect(onViewOriginal).toHaveBeenCalledOnce()
    })

    it('does not fall back to the original when preview configuration is missing', () => {
        vi.stubEnv('VITE_IPFS_PREVIEW_CID', '')
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        render(<NFTImageReveal nft={{ ...nft, is_mint: 0 }} />)

        expect(screen.getByText('Preview unavailable')).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
        expect(log).toHaveBeenCalledWith(expect.objectContaining({
            event: 'nft_image_source_error',
            nftId: 3995,
            missingFields: ['VITE_IPFS_PREVIEW_CID'],
        }))
    })
})
