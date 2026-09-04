import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NFTProfileThumbnail } from './NFTProfileThumbnail'

const nft = {
    nft_id: 3995,
    file_name: '3995.png',
    is_mint: 0,
}

describe('NFTProfileThumbnail', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it.each([0, 1, 2])('renders a static color preview for is_mint=%i', (is_mint) => {
        const onViewOriginal = vi.fn()
        render(
            <NFTProfileThumbnail
                nft={{ ...nft, is_mint }}
                onViewOriginal={onViewOriginal}
            />,
        )

        const image = screen.getByRole('img', { name: 'NFT #3995 thumbnail' })
        expect(image).toHaveAttribute('src', expect.stringContaining('/bafy-preview/3995.webp'))
        expect(image).not.toHaveClass('nft-preview-shadow')
        expect(screen.queryByTestId('nft-chip-overlay')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'View original NFT #3995' }))
        expect(onViewOriginal).toHaveBeenCalledOnce()
    })

    it('reports a missing canonical filename without guessing a preview path', () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        render(
            <NFTProfileThumbnail
                nft={{ ...nft, file_name: null }}
                onViewOriginal={vi.fn()}
            />,
        )

        expect(screen.getByText('Preview unavailable')).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
        expect(log).toHaveBeenCalledWith(expect.objectContaining({
            event: 'nft_profile_thumbnail_source_error',
            nftId: 3995,
            missingFields: ['file_name'],
        }))
    })
})
