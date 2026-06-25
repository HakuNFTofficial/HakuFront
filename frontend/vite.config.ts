import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 读取package.json获取版本号
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const version = packageJson.version || '0.0.0'
const buildTime = new Date().toISOString()

export default defineConfig({
    plugins: [
        react(),
        // 自定义插件：注入版本信息到HTML
        {
            name: 'inject-version',
            transformIndexHtml(html) {
                return html.replace(
                    '<head>',
                    `<head>
    <meta name="app-version" content="${version}" />
    <meta name="build-time" content="${buildTime}" />`
                )
            }
        }
    ],
    define: {
        // 在代码中可以使用 import.meta.env.APP_VERSION
        'import.meta.env.APP_VERSION': JSON.stringify(version),
        'import.meta.env.BUILD_TIME': JSON.stringify(buildTime),
    },
    server: {
        port: 3000,
        host: true, // Listen on all addresses (0.0.0.0)
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://127.0.0.1:8686',
                changeOrigin: true,
                secure: false,
            },
            '/ws': {
                target: 'ws://127.0.0.1:8686',
                changeOrigin: true,
                ws: true,
                rewrite: (path) => path.replace(/^\/ws/, '/ws'),
                // Optimize WebSocket proxy config, reduce error logs
                configure: (proxy, _options) => {
                    proxy.on('error', (err, _req, _res) => {
                        // Silently handle common WebSocket proxy errors (EPIPE, ECONNRESET, etc.)
                        if (err.message.includes('EPIPE') || err.message.includes('ECONNRESET') || err.message.includes('ECONNREFUSED')) {
                            // These errors are usually normal connection closures, no need to display
                            return
                        }
                        console.error('[Vite WS Proxy] Error:', err.message)
                    })
                    proxy.on('close', () => {
                        // Connection closure is normal, no logs needed
                    })
                }
            },
            // IPFS proxy for ipfs.io - adds CORS headers for Canvas access
            '/ipfs-proxy': {
                target: 'https://ipfs.io',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/ipfs-proxy/, '/ipfs'),
                configure: (proxy, _options) => {
                    proxy.on('proxyRes', (proxyRes, _req, _res) => {
                        // Add CORS headers to allow Canvas access
                        proxyRes.headers['Access-Control-Allow-Origin'] = '*'
                        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
                        proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept'
                    })
                }
            }
        }
    }
})
