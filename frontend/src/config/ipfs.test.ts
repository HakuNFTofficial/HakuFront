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

  it('normalizes a gateway override without a trailing slash', async () => {
    vi.stubEnv('VITE_IPFS_GATEWAY', 'https://images.example/ipfs')
    const { getIPFSImageUrl } = await import('./ipfs')

    expect(getIPFSImageUrl('572.png')).toBe(
      'https://images.example/ipfs/QmWALFJVacNc1EpMKdxMuCedDVcNwmWoc3L2jqX8erAb6L/572.png',
    )
  })
})
