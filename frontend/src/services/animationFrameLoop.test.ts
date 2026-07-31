import { describe, expect, it, vi } from 'vitest'

import { startAnimationFrameLoop } from './animationFrameLoop'

describe('startAnimationFrameLoop', () => {
    it('cancels the currently scheduled frame during cleanup', () => {
        const callbacks = new Map<number, FrameRequestCallback>()
        let nextId = 1
        const requestFrame = vi.fn((callback: FrameRequestCallback) => {
            const id = nextId++
            callbacks.set(id, callback)
            return id
        })
        const cancelFrame = vi.fn((id: number) => callbacks.delete(id))

        const stop = startAnimationFrameLoop(() => true, requestFrame, cancelFrame)
        callbacks.get(1)?.(0)

        stop()

        expect(requestFrame).toHaveBeenCalledTimes(2)
        expect(cancelFrame).toHaveBeenCalledWith(2)
        callbacks.get(2)?.(16)
        expect(requestFrame).toHaveBeenCalledTimes(2)
    })

    it('stops scheduling when the callback reports completion', () => {
        const callbacks: FrameRequestCallback[] = []
        const requestFrame = vi.fn((callback: FrameRequestCallback) => {
            callbacks.push(callback)
            return callbacks.length
        })

        startAnimationFrameLoop(() => false, requestFrame, vi.fn())
        callbacks[0](0)

        expect(requestFrame).toHaveBeenCalledTimes(1)
    })
})
