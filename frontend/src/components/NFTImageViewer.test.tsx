import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { NFTImageViewer } from './NFTImageViewer'

const minted = { nft_id: 7081, file_name: '7081.png', is_mint: 2 }

describe('NFTImageViewer', () => {
    it('exposes accessible dialog and close controls', () => {
        render(<NFTImageViewer nft={minted} isOpen onClose={vi.fn()} />)

        expect(screen.getByRole('dialog', { name: 'NFT #7081' }))
            .toHaveAttribute('aria-modal', 'true')
        expect(screen.getByRole('button', { name: 'Close original NFT #7081' }))
            .toBeInTheDocument()
    })

    it('closes on Escape', () => {
        const onClose = vi.fn()
        render(<NFTImageViewer nft={minted} isOpen onClose={onClose} />)

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(onClose).toHaveBeenCalledOnce()
    })

    it('closes on a backdrop click', () => {
        const onClose = vi.fn()
        render(<NFTImageViewer nft={minted} isOpen onClose={onClose} />)

        fireEvent.click(screen.getByTestId('nft-image-viewer-backdrop'))

        expect(onClose).toHaveBeenCalledOnce()
    })

    it('restores the previous page overflow when it closes', () => {
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'clip'

        const { unmount } = render(
            <NFTImageViewer nft={minted} isOpen onClose={vi.fn()} />,
        )
        expect(document.body.style.overflow).toBe('hidden')

        unmount()
        expect(document.body.style.overflow).toBe('clip')
        document.body.style.overflow = previousOverflow
    })

    it.each([0, 1])('opens the original for Profile lifecycle state is_mint=%i', (is_mint) => {
        render(
            <NFTImageViewer
                nft={{ ...minted, is_mint }}
                isOpen
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByRole('dialog', { name: 'NFT #7081' })).toBeInTheDocument()
    })
})
