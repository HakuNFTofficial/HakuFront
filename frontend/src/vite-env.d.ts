/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly APP_VERSION: string
    readonly BUILD_TIME: string
    readonly MODE: string
    readonly DEV: boolean
    readonly PROD: boolean
    readonly VITE_WALLETCONNECT_PROJECT_ID?: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
