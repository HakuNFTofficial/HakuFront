import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'

import { Profile } from './Profile'

vi.mock('wagmi', () => ({ useAccount: () => ({ address: '0x1234' }) }))
vi.mock('../providers/WebSocketProvider', () => ({
    useWebSocketEvent: () => undefined,
    useWebSocketReconnect: () => undefined,
}))

afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
})

it('opens the original viewer only from a minted Profile image', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
        total: 2,
        page: 1,
        page_size: 20,
        total_pages: 1,
        nfts: [
            {
                nft_id: 3995,
                file_name: '3995.png',
                all_chips_owned: false,
                owned_chips_count: 23,
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

    expect(await screen.findByRole('img', { name: 'NFT #3995 silhouette' }))
        .toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View original NFT #3995' }))
        .not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View original NFT #7081' }))
    expect(screen.getByRole('dialog', { name: 'NFT #7081' })).toBeInTheDocument()
})
