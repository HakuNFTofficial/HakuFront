import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NFTSection } from './NFTSection'

vi.mock('wagmi', () => ({
    useAccount: () => ({ address: '0xabc' }),
}))

vi.mock('../providers/WebSocketProvider', () => ({
    useWebSocketEvent: () => undefined,
    useWebSocketReconnect: () => undefined,
}))

vi.mock('./NFTImageReveal', () => ({
    NFTImageReveal: () => <div data-testid="nft-image" />,
}))

function apiResponse(overrides: Record<string, unknown> = {}) {
    return {
        total: 0,
        page: 1,
        page_size: 6,
        total_pages: 0,
        counts: {
            in_progress: 0,
            mintable: 0,
            minting: 0,
            burnable: 0,
            profile: 0,
        },
        chip_balance: {
            authoritative_chip_count: 0,
            materialized_chip_count: 0,
            pending_chip_count: 0,
            sync_status: 'ready',
            updated_at: '2026-09-25T01:00:00Z',
        },
        nfts: [],
        ...overrides,
    }
}

function mockFetch(payload: ReturnType<typeof apiResponse>) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
        text: async () => '',
    }))
}

describe('NFTSection chip balance states', () => {
    beforeEach(() => {
        vi.useRealTimers()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('shows the authoritative total while chip rows are materializing', async () => {
        mockFetch(apiResponse({
            chip_balance: {
                authoritative_chip_count: 90_852,
                materialized_chip_count: 30_000,
                pending_chip_count: 60_852,
                sync_status: 'ready',
                updated_at: '2026-09-25T01:00:00Z',
            },
        }))

        render(<NFTSection />)

        expect(await screen.findByText('90,852 chips')).toBeInTheDocument()
        expect(screen.getByText('Allocating fragments: 30,000 / 90,852')).toBeInTheDocument()
    })

    it('shows completed NFTs instead of an empty-state lie', async () => {
        mockFetch(apiResponse({
            counts: {
                in_progress: 0,
                mintable: 3,
                minting: 0,
                burnable: 0,
                profile: 3,
            },
            chip_balance: {
                authoritative_chip_count: 30_000,
                materialized_chip_count: 30_000,
                pending_chip_count: 0,
                sync_status: 'ready',
                updated_at: '2026-09-25T01:00:00Z',
            },
        }))

        render(<NFTSection />)

        expect(await screen.findByText('3 NFTs are complete')).toBeInTheDocument()
        expect(screen.queryByText('No incomplete NFT fragments')).not.toBeInTheDocument()
    })

    it('shows an explicit syncing state instead of zero', async () => {
        mockFetch(apiResponse({
            chip_balance: {
                authoritative_chip_count: null,
                materialized_chip_count: null,
                pending_chip_count: null,
                sync_status: 'pending',
                updated_at: null,
            },
        }))

        render(<NFTSection />)

        expect(await screen.findByText('Syncing chips…')).toBeInTheDocument()
        await waitFor(() => expect(fetch).toHaveBeenCalled())
    })

    it('shows a retrying state after an authoritative sync failure', async () => {
        mockFetch(apiResponse({
            chip_balance: {
                authoritative_chip_count: null,
                materialized_chip_count: 12_345,
                pending_chip_count: null,
                sync_status: 'failed',
                updated_at: '2026-09-25T01:00:00Z',
            },
        }))

        render(<NFTSection />)

        expect(await screen.findByText('Chip balance sync failed. Retrying…')).toBeInTheDocument()
        expect(screen.queryByText('0 chips')).not.toBeInTheDocument()
    })

    it('shows the true empty state only after an authoritative zero', async () => {
        mockFetch(apiResponse())

        render(<NFTSection />)

        expect(await screen.findByText('No NFT fragments yet')).toBeInTheDocument()
        expect(screen.getByText('0 chips')).toBeInTheDocument()
    })

    it('does not poll or invent a balance for excluded wallets', async () => {
        vi.useFakeTimers()
        mockFetch(apiResponse({
            chip_balance: {
                authoritative_chip_count: null,
                materialized_chip_count: null,
                pending_chip_count: null,
                sync_status: 'unavailable',
                updated_at: null,
            },
        }))

        render(<NFTSection />)

        await act(async () => {
            await Promise.resolve()
        })
        expect(screen.getByText('Chip balance is not tracked for this wallet.')).toBeInTheDocument()
        expect(screen.queryByText('0 chips')).not.toBeInTheDocument()
        await act(async () => {
            await vi.advanceTimersByTimeAsync(3_100)
        })
        expect(fetch).toHaveBeenCalledTimes(1)
    })
})
