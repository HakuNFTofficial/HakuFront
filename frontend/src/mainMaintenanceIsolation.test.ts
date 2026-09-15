// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('maintenance entry isolation', () => {
    it('loads the dApp provider tree only after maintenance mode is disabled', () => {
        const mainSource = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8')

        expect(mainSource).toContain("import('./DappRoot')")
        expect(mainSource).not.toMatch(/from ['"]\.\/wagmi['"]/)
        expect(mainSource).not.toMatch(/from ['"]wagmi['"]/)
        expect(mainSource).not.toMatch(/from ['"]@tanstack\/react-query['"]/)
        expect(mainSource).not.toMatch(/from ['"]\.\/providers\/WebSocketProvider['"]/)
        expect(mainSource).not.toMatch(/from ['"]\.\/App['"]/)
    })
})
