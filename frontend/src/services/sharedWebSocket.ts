export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface WebSocketLike {
    readyState: number
    onopen: ((event: Event) => void) | null
    onmessage: ((event: MessageEvent) => void) | null
    onerror: ((event: Event) => void) | null
    onclose: ((event: CloseEvent) => void) | null
    close(): void
    send(data: string): void
}

type TimerHandle = ReturnType<typeof setTimeout>
type EventSubscriber = (data: unknown) => void
type StatusSubscriber = () => void

export interface WebSocketManagerOptions {
    socketFactory?: (url: string) => WebSocketLike
    reconnectBaseMs?: number
    reconnectMaxMs?: number
    random?: () => number
    setTimeoutFn?: (callback: () => void, delay: number) => TimerHandle
    clearTimeoutFn?: (timer: TimerHandle) => void
    isVisible?: () => boolean
    subscribeVisibility?: (listener: () => void) => () => void
}

const defaultOptions: Required<WebSocketManagerOptions> = {
    socketFactory: (url) => new WebSocket(url),
    reconnectBaseMs: 1_000,
    reconnectMaxMs: 30_000,
    random: Math.random,
    setTimeoutFn: (callback, delay) => setTimeout(callback, delay),
    clearTimeoutFn: (timer) => clearTimeout(timer),
    isVisible: () => typeof document === 'undefined' || document.visibilityState === 'visible',
    subscribeVisibility: (listener) => {
        if (typeof document === 'undefined') return () => undefined
        document.addEventListener('visibilitychange', listener)
        return () => document.removeEventListener('visibilitychange', listener)
    },
}

export class SharedWebSocketManager {
    private readonly options: Required<WebSocketManagerOptions>
    private readonly subscribers = new Map<string, Set<EventSubscriber>>()
    private readonly statusSubscribers = new Set<StatusSubscriber>()
    private socket: WebSocketLike | null = null
    private retryTimer: TimerHandle | null = null
    private retryAttempt = 0
    private generation = 0
    private running = false
    private status: WebSocketStatus = 'disconnected'
    private removeVisibilityListener: (() => void) | null = null

    constructor(
        private readonly url: string,
        options: WebSocketManagerOptions = {},
    ) {
        this.options = { ...defaultOptions, ...options }
    }

    getStatus = () => this.status

    subscribeStatus = (subscriber: StatusSubscriber) => {
        this.statusSubscribers.add(subscriber)
        return () => this.statusSubscribers.delete(subscriber)
    }

    subscribe<T>(type: string, subscriber: (data: T) => void) {
        const subscribers = this.subscribers.get(type) ?? new Set<EventSubscriber>()
        const typedSubscriber = subscriber as EventSubscriber
        subscribers.add(typedSubscriber)
        this.subscribers.set(type, subscribers)

        return () => {
            subscribers.delete(typedSubscriber)
            if (subscribers.size === 0) {
                this.subscribers.delete(type)
            }
        }
    }

    start() {
        if (this.running) return
        this.running = true
        this.retryAttempt = 0
        this.removeVisibilityListener = this.options.subscribeVisibility(this.onVisibilityChange)
        if (this.options.isVisible()) {
            this.connect()
        }
    }

    stop() {
        if (!this.running && !this.socket && !this.retryTimer) return
        this.running = false
        this.generation += 1
        this.clearRetryTimer()
        this.disposeSocket()
        this.removeVisibilityListener?.()
        this.removeVisibilityListener = null
        this.retryAttempt = 0
        this.setStatus('disconnected')
    }

    reconnect() {
        if (!this.running) {
            this.start()
            return
        }

        this.generation += 1
        this.clearRetryTimer()
        this.disposeSocket()
        if (this.options.isVisible()) {
            this.connect()
        } else {
            this.setStatus('disconnected')
        }
    }

    send(data: unknown) {
        if (!this.socket || this.socket.readyState !== 1) return false
        this.socket.send(typeof data === 'string' ? data : JSON.stringify(data))
        return true
    }

    private connect() {
        if (!this.running || !this.options.isVisible()) return

        this.clearRetryTimer()
        const generation = ++this.generation
        this.setStatus('connecting')

        let socket: WebSocketLike
        try {
            socket = this.options.socketFactory(this.url)
        } catch {
            this.setStatus('error')
            this.scheduleReconnect(generation)
            return
        }

        this.socket = socket
        socket.onopen = () => {
            if (!this.isCurrent(generation, socket)) return
            this.retryAttempt = 0
            this.setStatus('connected')
        }
        socket.onmessage = (event) => {
            if (!this.isCurrent(generation, socket)) return
            this.dispatch(event.data)
        }
        socket.onerror = () => {
            if (!this.isCurrent(generation, socket)) return
            this.setStatus('error')
        }
        socket.onclose = () => {
            if (!this.isCurrent(generation, socket)) return
            this.socket = null
            this.setStatus('disconnected')
            this.scheduleReconnect(generation)
        }
    }

    private dispatch(rawData: unknown) {
        try {
            const message = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
            if (!message || typeof message !== 'object') return
            const typedMessage = message as { type?: unknown; data?: unknown }
            if (typeof typedMessage.type !== 'string') return

            const subscribers = this.subscribers.get(typedMessage.type)
            subscribers?.forEach((subscriber) => subscriber(typedMessage.data))
        } catch {
            // Ignore malformed messages; the connection remains usable.
        }
    }

    private scheduleReconnect(generation: number) {
        if (
            !this.running
            || generation !== this.generation
            || this.retryTimer
            || !this.options.isVisible()
        ) return

        const exponentialDelay = Math.min(
            this.options.reconnectBaseMs * 2 ** Math.min(this.retryAttempt, 10),
            this.options.reconnectMaxMs,
        )
        const jitteredDelay = Math.min(
            Math.round(exponentialDelay * (1 + this.options.random() * 0.25)),
            this.options.reconnectMaxMs,
        )
        this.retryAttempt += 1
        this.retryTimer = this.options.setTimeoutFn(() => {
            this.retryTimer = null
            if (
                !this.running
                || generation !== this.generation
                || !this.options.isVisible()
            ) return
            this.connect()
        }, jitteredDelay)
    }

    private onVisibilityChange = () => {
        if (
            this.running
            && this.options.isVisible()
            && !this.socket
            && !this.retryTimer
        ) {
            this.connect()
        }
    }

    private clearRetryTimer() {
        if (!this.retryTimer) return
        this.options.clearTimeoutFn(this.retryTimer)
        this.retryTimer = null
    }

    private disposeSocket() {
        if (!this.socket) return
        const socket = this.socket
        this.socket = null
        socket.onopen = null
        socket.onmessage = null
        socket.onerror = null
        socket.onclose = null
        socket.close()
    }

    private isCurrent(generation: number, socket: WebSocketLike) {
        return this.running && generation === this.generation && socket === this.socket
    }

    private setStatus(status: WebSocketStatus) {
        if (status === this.status) return
        this.status = status
        this.statusSubscribers.forEach((subscriber) => subscriber())
    }
}
