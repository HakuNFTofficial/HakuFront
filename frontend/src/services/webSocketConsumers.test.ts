import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const componentPaths = [
    '../components/Banner.tsx',
    '../components/KLineChart.tsx',
    '../components/NFTSection.tsx',
]

describe('realtime components', () => {
    it.each(componentPaths)('%s uses the shared WebSocket provider', (componentPath) => {
        const source = readFileSync(new URL(componentPath, import.meta.url), 'utf8')

        expect(source).toContain('useWebSocketEvent')
        expect(source).not.toContain("from '../hooks/useWebSocket'")
        expect(source).not.toContain('/ws`')
    })
})
