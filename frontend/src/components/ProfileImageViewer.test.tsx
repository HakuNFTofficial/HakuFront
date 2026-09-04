import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { Profile } from './Profile'

vi.mock('wagmi', () => ({
    useAccount: () => ({ address: '0x1234' }),
    useWriteContract: () => ({
        writeContract: vi.fn(),
        data: undefined,
        error: undefined,
        isPending: false,
    }),
    useWaitForTransactionReceipt: () => ({
        isLoading: false,
        isSuccess: false,
    }),
    useReadContract: () => ({
        data: 0n,
        refetch: vi.fn().mockResolvedValue({ data: 0n }),
    }),
}))
vi.mock('../providers/WebSocketProvider', () => ({
    useWebSocketEvent: () => undefined,
    useWebSocketReconnect: () => undefined,
}))
vi.mock('../hooks/useEventAssociation', () => ({
    useEventAssociation: () => ({ associatedTransfer: undefined }),
}))

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

it('uses static thumbnails and opens originals for complete Profile NFTs', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
        total: 2,
        page: 1,
        page_size: 20,
        total_pages: 1,
        counts: {
            in_progress: 0,
            mintable: 1,
            minting: 0,
            burnable: 1,
            profile: 2,
        },
        nfts: [
            {
                nft_id: 3995,
                file_name: '3995.png',
                all_chips_owned: true,
                owned_chips_count: 10_000,
                total_chips_count: 10_000,
                is_mint: 0,
            },
            {
                nft_id: 7081,
                file_name: '7081.png',
                all_chips_owned: true,
                owned_chips_count: 10_000,
                total_chips_count: 10_000,
                is_mint: 2,
                token_id: '40',
            },
        ],
    }), { status: 200 }))

    render(<Profile />)

    expect(await screen.findByRole('img', { name: 'NFT #3995 thumbnail' }))
        .toBeInTheDocument()
    expect(screen.getByTestId('profile-nft-grid')).toHaveClass(
        'grid-cols-[repeat(auto-fill,minmax(min(200px,100%),200px))]',
    )
    await user.click(screen.getByRole('button', { name: 'View original NFT #3995' }))
    expect(screen.getByRole('dialog', { name: 'NFT #3995' })).toBeInTheDocument()
})
