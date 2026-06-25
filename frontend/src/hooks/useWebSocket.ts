import { useEffect, useRef, useState, useCallback } from 'react'

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseWebSocketOptions {
    url: string
    onMessage?: (data: any) => void
    onError?: (error: Event) => void
    reconnectInterval?: number
    maxRetries?: number
    enabled?: boolean
}

export function useWebSocket({
    url,
    onMessage,
    onError,
    reconnectInterval = 3000,
    maxRetries = 5,
    enabled = true
}: UseWebSocketOptions) {
    const [status, setStatus] = useState<WebSocketStatus>('disconnected')
    const wsRef = useRef<WebSocket | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
    const retryCountRef = useRef(0)

    // Use refs for callbacks to prevent unnecessary re-connections
    const onMessageRef = useRef(onMessage)
    const onErrorRef = useRef(onError)

    useEffect(() => {
        onMessageRef.current = onMessage
        onErrorRef.current = onError
    }, [onMessage, onError])

    const connect = useCallback(() => {
        if (!enabled) return

        try {
            // clear any existing connection attempts
            if (wsRef.current) {
                wsRef.current.close()
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }

            setStatus('connecting')
            const ws = new WebSocket(url)

            ws.onopen = () => {
                setStatus('connected')
                console.log('[WebSocket] Connected to', url)
                retryCountRef.current = 0 // Reset retries on successful connection
            }

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    onMessageRef.current?.(data)
                } catch (err) {
                    console.error('[WebSocket] Failed to parse message:', err)
                }
            }

            ws.onerror = (error) => {
                // Only log error in development mode on first attempt to reduce console noise
                if (import.meta.env.DEV && retryCountRef.current === 0) {
                    console.warn('[WebSocket] Connection error (backend may be offline)')
                }
                setStatus('error')
                onErrorRef.current?.(error)
            }

            ws.onclose = () => {
                if (import.meta.env.DEV && retryCountRef.current === 0) {
                    console.log('[WebSocket] Disconnected from', url)
                }
                setStatus('disconnected')
                wsRef.current = null

                // Auto-reconnect with exponential backoff
                if (enabled && retryCountRef.current < maxRetries) {
                    const baseDelay = reconnectInterval > 0 ? reconnectInterval : 1000
                    const backoffTime = Math.min(baseDelay * Math.pow(2, retryCountRef.current), 30000)
                    retryCountRef.current += 1

                    // Only log retry attempts in development, and only the first few
                    if (import.meta.env.DEV && retryCountRef.current <= 2) {
                        console.log(`[WebSocket] Will retry in ${backoffTime}ms (Attempt ${retryCountRef.current}/${maxRetries})...`)
                    }

                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect()
                    }, backoffTime)
                } else if (retryCountRef.current >= maxRetries && import.meta.env.DEV) {
                    console.log('[WebSocket] Max retries reached, giving up')
                }
            }

            wsRef.current = ws
        } catch (err) {
            console.error('[WebSocket] Connection failed:', err)
            setStatus('error')
        }
    }, [url, enabled, maxRetries])

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
        }
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        setStatus('disconnected')
        retryCountRef.current = 0
    }, [])

    const sendMessage = useCallback((data: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
        } else {
            console.warn('[WebSocket] Cannot send message, not connected')
        }
    }, [])

    useEffect(() => {
        if (enabled) {
            connect()
        }

        return () => {
            disconnect()
        }
    }, [enabled, connect, disconnect])

    return {
        status,
        sendMessage,
        disconnect,
        reconnect: () => {
            retryCountRef.current = 0
            connect()
        }
    }
}
