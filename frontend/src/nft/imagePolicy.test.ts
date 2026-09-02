import { describe, expect, it } from 'vitest'

import { resolveNftImageSource } from './imagePolicy'

describe('NFT image policy', () => {
    it.each([0, 1])('uses a WebP silhouette for is_mint=%i', (is_mint) => {
        expect(resolveNftImageSource({ nft_id: 3995, file_name: '3995.png', is_mint }))
            .toEqual({ ok: true, kind: 'preview', fileName: '3995.webp' })
    })

    it('uses the exact original filename only after mint completion', () => {
        expect(resolveNftImageSource({ nft_id: 3995, file_name: '3995.png', is_mint: 2 }))
            .toEqual({ ok: true, kind: 'original', fileName: '3995.png' })
    })

    it('replaces only the final extension in nested canonical filenames', () => {
        expect(resolveNftImageSource({ nft_id: 7, file_name: 'set.v2/7.final.png', is_mint: 0 }))
            .toEqual({ ok: true, kind: 'preview', fileName: 'set.v2/7.final.webp' })
    })

    it('reports required business data instead of guessing a filename', () => {
        expect(resolveNftImageSource({ nft_id: 3995, file_name: null, is_mint: 0 }))
            .toEqual({
                ok: false,
                code: 'NFT_IMAGE_SOURCE_MISSING',
                nftId: 3995,
                status: 0,
                missingFields: ['file_name'],
            })
    })
})
