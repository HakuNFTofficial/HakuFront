import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useRef,
    useSyncExternalStore,
} from 'react'

import {
    SharedWebSocketManager,
    type WebSocketStatus,
} from '../services/sharedWebSocket'

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const sharedManager = new SharedWebSocketManager(
    `${protocol}//${window.location.host}/ws`,
)

const WebSocketContext = createContext<SharedWebSocketManager | null>(null)

export function WebSocketProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        sharedManager.start()
        return () => sharedManager.stop()
    }, [])

    return (
        <WebSocketContext.Provider value={sharedManager}>
            {children}
        </WebSocketContext.Provider>
    )
}

function useSharedManager() {
    const manager = useContext(WebSocketContext)
    if (!manager) {
        throw new Error('WebSocket hooks must be used inside WebSocketProvider')
    }
    return manager
}

export function useWebSocketStatus(): WebSocketStatus {
    const manager = useSharedManager()
    return useSyncExternalStore(
        manager.subscribeStatus,
        manager.getStatus,
        manager.getStatus,
    )
}

export function useWebSocketEvent<T>(
    type: string,
    handler: (data: T) => void,
    enabled = true,
) {
    const manager = useSharedManager()
    const handlerRef = useRef(handler)

    useEffect(() => {
        handlerRef.current = handler
    }, [handler])

    useEffect(() => {
        if (!enabled) return
        return manager.subscribe<T>(type, (data) => handlerRef.current(data))
    }, [enabled, manager, type])
}

export function useWebSocketReconnect(handler: () => void) {
    const status = useWebSocketStatus()
    const handlerRef = useRef(handler)
    const hasConnectedRef = useRef(false)

    useEffect(() => {
        handlerRef.current = handler
    }, [handler])

    useEffect(() => {
        if (status !== 'connected') return
        if (!hasConnectedRef.current) {
            hasConnectedRef.current = true
            return
        }
        handlerRef.current()
    }, [status])
}
