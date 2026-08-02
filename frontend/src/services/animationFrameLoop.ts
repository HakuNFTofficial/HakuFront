type RequestFrame = (callback: FrameRequestCallback) => number
type CancelFrame = (handle: number) => void

export function startAnimationFrameLoop(
    callback: (timestamp: number) => boolean,
    requestFrame: RequestFrame = requestAnimationFrame,
    cancelFrame: CancelFrame = cancelAnimationFrame,
): () => void {
    let stopped = false
    let frameId: number | null = null

    const tick: FrameRequestCallback = (timestamp) => {
        if (stopped) return
        if (callback(timestamp)) {
            frameId = requestFrame(tick)
        } else {
            frameId = null
        }
    }

    frameId = requestFrame(tick)

    return () => {
        stopped = true
        if (frameId !== null) {
            cancelFrame(frameId)
            frameId = null
        }
    }
}
