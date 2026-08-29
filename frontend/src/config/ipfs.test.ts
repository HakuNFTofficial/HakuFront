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
      'https://gateway.pinata.cloud/ipfs/QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb/572.png',
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
      'https://images.example/ipfs/QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb/572.png',
    )
  })
})
