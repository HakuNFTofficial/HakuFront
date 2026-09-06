// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolve } from 'node:path'
import { build } from 'vite'

describe('production frontend build', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('fails with an actionable error when the preview CID is missing', async () => {
        vi.stubEnv('VITE_IPFS_PREVIEW_CID', '')

        await expect(
            build({
                configFile: resolve(process.cwd(), 'vite.config.ts'),
                logLevel: 'silent',
                build: { write: false },
            }),
        ).rejects.toThrow(
            /"code":"FRONTEND_BUILD_ENV_MISSING".*"missingFields":\["VITE_IPFS_PREVIEW_CID"\]/,
        )
    })
})
