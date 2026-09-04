import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NFTImageReveal } from './NFTImageReveal'

vi.mock('wagmi', () => ({
    useAccount: () => ({ address: '0x1234' }),
}))

vi.mock('./NFTChipOverlay', () => ({
    NFTChipOverlay: ({
        onSnapshotReady,
        onSnapshotPending,
    }: {
        onSnapshotReady?: (blob: Blob) => void
        onSnapshotPending?: () => void
    }) => (
        <div>
            <button
                type="button"
                data-testid="nft-chip-overlay"
                onClick={() => onSnapshotReady?.(
                    new Blob(['fragment'], { type: 'image/png' }),
                )}
            />
            <button
                type="button"
                data-testid="nft-chip-overlay-pending"
                onClick={() => onSnapshotPending?.()}
            />
        </div>
    ),
}))

const ownedChips = Array.from({ length: 23 }, (_, index) => ({
    x: (index % 10) * 30,
    y: Math.floor(index / 10) * 30,
    w: 30,
    h: 30,
}))

const nft = {
    nft_id: 3995,
    file_name: '3995.png',
    all_chips_owned: false,
    owned_chips_count: 23,
    total_chips_count: 10_000,
    owned_chips: ownedChips,
}

function expectSquareMediaRoot(container: HTMLElement) {
    expect(container.firstElementChild).toHaveClass(
        'relative',
        'aspect-square',
        'w-full',
    )
}

describe('NFTImageReveal', () => {
    beforeEach(() => {
        vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fragment-png')
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    })

    afterEach(() => {
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it.each([0, 1])('renders only the silhouette for is_mint=%i', (is_mint) => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        const { container } = render(<NFTImageReveal nft={{ ...nft, is_mint }} />)

        expectSquareMediaRoot(container)
        const preview = screen.getByRole('img', { name: 'NFT #3995 silhouette' })
        expect(preview)
            .toHaveAttribute('src', expect.stringContaining('/bafy-preview/3995.webp'))
        expect(preview).toHaveClass('nft-preview-shadow')
        fireEvent.load(preview)
        expect(screen.getByTestId('nft-chip-overlay')).toBeInTheDocument()
        expect(screen.getByRole('img').getAttribute('src')).not.toContain(
            '/QmWALFJVacNc1EpMKdxMuCedDVcNwmWoc3L2jqX8erAb6L/',
        )
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('renders the original only for is_mint=2 and exposes the viewer action', () => {
        const onViewOriginal = vi.fn()
        const { container } = render(
            <NFTImageReveal
                nft={{ ...nft, is_mint: 2 }}
                onViewOriginal={onViewOriginal}
            />,
        )

        expectSquareMediaRoot(container)
        expect(screen.getByRole('img', { name: 'NFT #3995' }))
            .toHaveAttribute('src', expect.stringContaining('/3995.png'))
        fireEvent.click(screen.getByRole('button', { name: 'View original NFT #3995' }))
        expect(onViewOriginal).toHaveBeenCalledOnce()
    })

    it('does not fall back to the original when preview configuration is missing', () => {
        vi.stubEnv('VITE_IPFS_PREVIEW_CID', '')
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        const { container } = render(<NFTImageReveal nft={{ ...nft, is_mint: 0 }} />)

        expectSquareMediaRoot(container)
        expect(screen.getByText('Preview unavailable')).toBeInTheDocument()
        expect(screen.queryByRole('img')).not.toBeInTheDocument()
        expect(log).toHaveBeenCalledWith(expect.objectContaining({
            event: 'nft_image_source_error',
            nftId: 3995,
            missingFields: ['VITE_IPFS_PREVIEW_CID'],
        }))
    })

    it('targets a composed PNG for native Save Image As and releases its blob URL', () => {
        const { unmount } = render(<NFTImageReveal nft={{ ...nft, is_mint: 0 }} />)
        const preview = screen.getByRole('img', { name: 'NFT #3995 silhouette' })

        expect(preview).toHaveAttribute('crossorigin', 'anonymous')
        fireEvent.load(preview)
        fireEvent.click(screen.getByTestId('nft-chip-overlay'))

        expect(screen.getByTestId('nft-fragment-save-image')).toHaveAttribute(
            'src',
            'blob:fragment-png',
        )
        fireEvent.click(screen.getByTestId('nft-chip-overlay-pending'))
        expect(screen.queryByTestId('nft-fragment-save-image')).not.toBeInTheDocument()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fragment-png')

        fireEvent.click(screen.getByTestId('nft-chip-overlay'))
        unmount()
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fragment-png')
    })
})
