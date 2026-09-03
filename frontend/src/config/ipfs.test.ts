import { afterEach, describe, expect, it, vi } from 'vitest'

describe('IPFS configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('uses the Pinata gateway for image URLs by default', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', '')
    const { getIPFSImageUrl } = await import('./ipfs')

    expect(getIPFSImageUrl('572.png')).toBe(
      'https://gateway.pinata.cloud/ipfs/QmWALFJVacNc1EpMKdxMuCedDVcNwmWoc3L2jqX8erAb6L/572.png',
    )
  })

  it('uses the current collection CID for metadata URLs', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', '')
    const { getIPFSMetadataUrl } = await import('./ipfs')

    expect(getIPFSMetadataUrl('572.json')).toBe(
      'https://gateway.pinata.cloud/ipfs/Qmeub98s5ZPPANZVksF8Vs6CbPT3Xe5PEmkFEhgMP9ovzK/572.json',
    )
  })

  it('exports the current collection root CID', async () => {
    const { IPFS_CONFIG } = await import('./ipfs')

    expect(IPFS_CONFIG.ROOT_CID).toBe(
      'QmUCmfy48PsvUQBEHxeqPZTzQabFDY8U1CkT4ZFQN1pSQH',
    )
  })

  it('uses the selected gateway when converting an IPFS URI', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', '')
    const { convertIPFSToHttp } = await import('./ipfs')

    expect(convertIPFSToHttp('ipfs://bafy-image')).toBe(
      'https://gateway.pinata.cloud/ipfs/bafy-image',
    )
  })

  it('rewrites a legacy HTTP IPFS gateway through the selected gateway', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', '')
    const { convertIPFSToHttp } = await import('./ipfs')

    expect(
      convertIPFSToHttp(
        'https://nftstorage.link/ipfs/QmImage/2828.png?download=1',
      ),
    ).toBe(
      'https://gateway.pinata.cloud/ipfs/QmImage/2828.png?download=1',
    )
  })

  it('preserves a non-IPFS HTTP image URL', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', '')
    const { convertIPFSToHttp } = await import('./ipfs')

    expect(convertIPFSToHttp('https://cdn.example.com/2828.png')).toBe(
      'https://cdn.example.com/2828.png',
    )
  })

  it('normalizes a gateway override without a trailing slash', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', 'https://images.example/ipfs')
    const { getIPFSImageUrl } = await import('./ipfs')

    expect(getIPFSImageUrl('572.png')).toBe(
      'https://images.example/ipfs/QmWALFJVacNc1EpMKdxMuCedDVcNwmWoc3L2jqX8erAb6L/572.png',
    )
  })

  it('builds preview URLs from the configured immutable preview CID', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', 'https://images.example/ipfs')
    vi.stubEnv('VITE_IPFS_PREVIEW_CID', 'bafy-preview')
    const { getIPFSPreviewUrl } = await import('./ipfs')

    expect(getIPFSPreviewUrl('3995.webp')).toBe(
      'https://images.example/ipfs/bafy-preview/3995.webp',
    )
  })

  it('fails explicitly when the preview CID is missing', async () => {
    vi.stubEnv('VITE_IPFS_PREVIEW_CID', '')
    const { getIPFSPreviewUrl } = await import('./ipfs')

    expect(() => getIPFSPreviewUrl('3995.webp')).toThrowError(
      'Missing required VITE_IPFS_PREVIEW_CID',
    )
  })
})
