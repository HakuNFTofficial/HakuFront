import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
    SharedWebSocketManager,
    type WebSocketLike,
    type WebSocketManagerOptions,
} from './sharedWebSocket'

class FakeSocket implements WebSocketLike {
    readyState = 0
    onopen: ((event: Event) => void) | null = null
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: Event) => void) | null = null
    onclose: ((event: CloseEvent) => void) | null = null
    close = vi.fn(() => {
        this.readyState = 3
    })
    send = vi.fn()

    emitOpen() {
        this.readyState = 1
        this.onopen?.(new Event('open'))
    }

    emitMessage(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent)
    }

    emitClose() {
        this.readyState = 3
        this.onclose?.({} as CloseEvent)
    }
}

function createHarness() {
    const sockets: FakeSocket[] = []
    const options: WebSocketManagerOptions = {
        socketFactory: () => {
            const socket = new FakeSocket()
            sockets.push(socket)
            return socket
        },
        reconnectBaseMs: 1_000,
        reconnectMaxMs: 30_000,
        random: () => 0,
        setTimeoutFn: (callback, delay) => setTimeout(callback, delay),
        clearTimeoutFn: (timer) => clearTimeout(timer),
    }
    return {
        manager: new SharedWebSocketManager('wss://example.test/ws', options),
        sockets,
    }
}

describe('SharedWebSocketManager', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('creates only one socket when start is called repeatedly', () => {
        const { manager, sockets } = createHarness()

        manager.start()
        manager.start()

        expect(sockets).toHaveLength(1)
    })

    it('dispatches a message only to subscribers for its event type', () => {
        const { manager, sockets } = createHarness()
        const latestMinted = vi.fn()
        const kline = vi.fn()
        manager.subscribe('LatestMintedNFTs', latestMinted)
        manager.subscribe('KlineUpdate', kline)
        manager.start()

        sockets[0].emitMessage({ type: 'LatestMintedNFTs', data: { total: 1 } })

        expect(latestMinted).toHaveBeenCalledOnce()
        expect(latestMinted).toHaveBeenCalledWith({ total: 1 })
        expect(kline).not.toHaveBeenCalled()
    })

    it('stop cancels retry and a stale close cannot reconnect', () => {
        const { manager, sockets } = createHarness()
        manager.start()
        const staleClose = sockets[0].onclose

        manager.stop()
        staleClose?.({} as CloseEvent)
        vi.runAllTimers()

        expect(sockets).toHaveLength(1)
        expect(manager.getStatus()).toBe('disconnected')
    })

    it('a previous generation close cannot replace the current socket', () => {
        const { manager, sockets } = createHarness()
        manager.start()
        const staleClose = sockets[0].onclose

        manager.reconnect()
        staleClose?.({} as CloseEvent)
        vi.runAllTimers()

        expect(sockets).toHaveLength(2)
    })

    it('reconnects once after an unexpected close', () => {
        const { manager, sockets } = createHarness()
        manager.start()
        sockets[0].emitOpen()

        sockets[0].emitClose()
        expect(sockets).toHaveLength(1)
        vi.advanceTimersByTime(1_000)

        expect(sockets).toHaveLength(2)
    })
})
