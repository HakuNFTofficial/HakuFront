/**
 * 后端监听脚本：监听并关联 HakuNFTMint 和 UserTransfer 事件
 * 
 * 使用方法：
 *   npx tsx script/listen_nft_mint_events.mts
 * 
 * 功能：
 *   1. 监听 HakuNFTMint 事件（来自 HukuNFT 合约）
 *   2. 监听 UserTransfer 事件（来自 HakuToken 合约）
 *   3. 通过交易哈希关联这两个事件
 *   4. 输出关联结果，包含备注信息
 */

import { createPublicClient, webSocket, parseAbi, decodeEventLog, getEventSelector } from "viem"
import { defineChain } from "viem"

// 合约地址
const HUKU_NFT_ADDRESS = "0x8557aFC94164F53a0828EB4ca16afE7dE280BE34" as `0x${string}`
const HAKU_TOKEN_ADDRESS = "0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3" as `0x${string}`

// 定义链
const somnia = defineChain({
    id: 50312,
    name: 'Somnia',
    nativeCurrency: {
        decimals: 18,
        name: 'STT',
        symbol: 'STT',
    },
    rpcUrls: {
        default: {
            http: ['https://dream-rpc.somnia.network'],
            webSocket: ['wss://dream-rpc.somnia.network/ws'],
        },
    },
    blockExplorers: {
        default: { name: 'Explorer', url: 'https://somnia-testnet.socialscan.io' },
    },
})

// 创建 WebSocket 客户端
const client = createPublicClient({
    chain: somnia,
    transport: webSocket("wss://dream-rpc.somnia.network/ws")
})

// 事件 ABI
const HAKU_NFT_MINT_ABI = parseAbi([
    "event HakuNFTMint(address indexed from, address indexed to, uint256 value, uint256 indexed tokenId, string remark)"
])

const USER_TRANSFER_ABI = parseAbi([
    "event UserTransfer(address indexed from, address indexed to, uint256 value, uint256 timestamp, uint256 blockNumber, string remark)"
])

// 计算事件签名
const HAKU_NFT_MINT_EVENT_SELECTOR = getEventSelector(HAKU_NFT_MINT_ABI[0])
const USER_TRANSFER_EVENT_SELECTOR = getEventSelector(USER_TRANSFER_ABI[0])

// 存储待关联的事件（按交易哈希分组）
interface PendingEvent {
    txHash: `0x${string}`
    blockNumber: bigint
    type: 'HakuNFTMint' | 'UserTransfer'
    data: any
    timestamp: number
}

const pendingEvents = new Map<`0x${string}`, PendingEvent[]>()

/**
 * 尝试关联同一交易中的两个事件
 */
async function tryAssociateEvents(txHash: `0x${string}`) {
    const events = pendingEvents.get(txHash)
    if (!events || events.length < 2) {
        return // 还没有收到两个事件
    }

    const mintEvent = events.find(e => e.type === 'HakuNFTMint')
    const transferEvent = events.find(e => e.type === 'UserTransfer')

    if (!mintEvent || !transferEvent) {
        return // 缺少某个事件
    }

    // 验证参数匹配
    if (
        mintEvent.data.from.toLowerCase() === transferEvent.data.from.toLowerCase() &&
        mintEvent.data.to.toLowerCase() === transferEvent.data.to.toLowerCase() &&
        mintEvent.data.value === transferEvent.data.value
    ) {
        console.log("\n" + "=".repeat(80))
        console.log("✅ 事件关联成功！")
        console.log("=".repeat(80))
        console.log(`交易哈希: ${txHash}`)
        console.log(`区块号: ${mintEvent.blockNumber}`)
        console.log(`\n📝 转账信息:`)
        console.log(`  From: ${mintEvent.data.from}`)
        console.log(`  To: ${mintEvent.data.to}`)
        console.log(`  Value: ${mintEvent.data.value.toString()}`)
        console.log(`\n🎫 NFT 信息:`)
        console.log(`  Token ID: ${mintEvent.data.tokenId.toString()}`)
        console.log(`  备注: ${mintEvent.data.remark}`)
        console.log(`\n⏰ 时间信息:`)
        console.log(`  时间戳: ${transferEvent.data.timestamp.toString()}`)
        console.log(`  区块号: ${transferEvent.data.blockNumber.toString()}`)
        console.log("=".repeat(80) + "\n")

        // 清除已处理的事件
        pendingEvents.delete(txHash)
    } else {
        console.warn(`⚠️ 参数不匹配，无法关联事件 (txHash: ${txHash})`)
        console.warn(`  Mint: from=${mintEvent.data.from}, to=${mintEvent.data.to}, value=${mintEvent.data.value}`)
        console.warn(`  Transfer: from=${transferEvent.data.from}, to=${transferEvent.data.to}, value=${transferEvent.data.value}`)
        pendingEvents.delete(txHash)
    }
}

/**
 * 通过交易哈希获取并关联事件（备用方法）
 */
async function associateEventsByTxHash(txHash: `0x${string}`) {
    try {
        const receipt = await client.getTransactionReceipt({ hash: txHash })
        
        if (!receipt || !receipt.logs || receipt.logs.length === 0) {
            return null
        }

        // 查找 HakuNFTMint 事件
        const mintLog = receipt.logs.find(log => 
            log.address?.toLowerCase() === HUKU_NFT_ADDRESS.toLowerCase() &&
            log.topics[0] === HAKU_NFT_MINT_EVENT_SELECTOR
        )

        // 查找 UserTransfer 事件
        const transferLog = receipt.logs.find(log =>
            log.address?.toLowerCase() === HAKU_TOKEN_ADDRESS.toLowerCase() &&
            log.topics[0] === USER_TRANSFER_EVENT_SELECTOR
        )

        if (mintLog && transferLog) {
            const mintDecoded = decodeEventLog({
                abi: HAKU_NFT_MINT_ABI,
                data: mintLog.data,
                topics: mintLog.topics,
            }) as any

            const transferDecoded = decodeEventLog({
                abi: USER_TRANSFER_ABI,
                data: transferLog.data,
                topics: transferLog.topics,
            }) as any

            // 验证参数匹配
            if (
                mintDecoded.from.toLowerCase() === transferDecoded.from.toLowerCase() &&
                mintDecoded.to.toLowerCase() === transferDecoded.to.toLowerCase() &&
                mintDecoded.value === transferDecoded.value
            ) {
                console.log("\n" + "=".repeat(80))
                console.log("✅ 通过交易收据关联成功！")
                console.log("=".repeat(80))
                console.log(`交易哈希: ${txHash}`)
                console.log(`区块号: ${receipt.blockNumber}`)
                console.log(`\n📝 转账信息:`)
                console.log(`  From: ${mintDecoded.from}`)
                console.log(`  To: ${mintDecoded.to}`)
                console.log(`  Value: ${mintDecoded.value.toString()}`)
                console.log(`\n🎫 NFT 信息:`)
                console.log(`  Token ID: ${mintDecoded.tokenId.toString()}`)
                console.log(`  备注: ${mintDecoded.remark}`)
                console.log(`\n⏰ 时间信息:`)
                console.log(`  时间戳: ${transferDecoded.timestamp.toString()}`)
                console.log(`  区块号: ${transferDecoded.blockNumber.toString()}`)
                console.log("=".repeat(80) + "\n")
            }
        }
    } catch (error) {
        console.error(`❌ 关联事件失败 (txHash: ${txHash}):`, error)
    }
}

// 监听 HakuNFTMint 事件
console.log("🔍 开始监听 HakuNFTMint 事件...")
client.watchContractEvent({
    address: HUKU_NFT_ADDRESS,
    abi: HAKU_NFT_MINT_ABI,
    eventName: "HakuNFTMint",
    onLogs: logs => {
        for (const log of logs) {
            const { from, to, value, tokenId, remark } = log.args as any
            const txHash = log.transactionHash as `0x${string}`
            
            console.log("\n📨 收到 HakuNFTMint 事件:")
            console.log(`  交易哈希: ${txHash}`)
            console.log(`  区块号: ${log.blockNumber}`)
            console.log(`  From: ${from}`)
            console.log(`  To: ${to}`)
            console.log(`  Value: ${value.toString()}`)
            console.log(`  Token ID: ${tokenId.toString()}`)
            console.log(`  备注: ${remark}`)

            // 存储事件
            if (!pendingEvents.has(txHash)) {
                pendingEvents.set(txHash, [])
            }
            pendingEvents.get(txHash)!.push({
                txHash,
                blockNumber: log.blockNumber || 0n,
                type: 'HakuNFTMint',
                data: { from, to, value, tokenId, remark },
                timestamp: Date.now(),
            })

            // 尝试关联事件
            setTimeout(() => tryAssociateEvents(txHash), 100)
            
            // 如果 5 秒内没有关联成功，使用备用方法（通过交易收据）
            setTimeout(() => {
                if (pendingEvents.has(txHash)) {
                    console.log(`⏳ 使用备用方法关联事件 (txHash: ${txHash})...`)
                    associateEventsByTxHash(txHash)
                }
            }, 5000)
        }
    }
})

// 监听 UserTransfer 事件
console.log("🔍 开始监听 UserTransfer 事件...")
client.watchContractEvent({
    address: HAKU_TOKEN_ADDRESS,
    abi: USER_TRANSFER_ABI,
    eventName: "UserTransfer",
    onLogs: logs => {
        for (const log of logs) {
            const { from, to, value, timestamp, blockNumber, remark } = log.args as any
            const txHash = log.transactionHash as `0x${string}`
            
            console.log("\n📨 收到 UserTransfer 事件:")
            console.log(`  交易哈希: ${txHash}`)
            console.log(`  区块号: ${log.blockNumber}`)
            console.log(`  From: ${from}`)
            console.log(`  To: ${to}`)
            console.log(`  Value: ${value.toString()}`)
            console.log(`  时间戳: ${timestamp.toString()}`)
            console.log(`  备注: ${remark}`)

            // 存储事件
            if (!pendingEvents.has(txHash)) {
                pendingEvents.set(txHash, [])
            }
            pendingEvents.get(txHash)!.push({
                txHash,
                blockNumber: log.blockNumber || 0n,
                type: 'UserTransfer',
                data: { from, to, value, timestamp, blockNumber, remark },
                timestamp: Date.now(),
            })

            // 尝试关联事件
            setTimeout(() => tryAssociateEvents(txHash), 100)
            
            // 如果 5 秒内没有关联成功，使用备用方法（通过交易收据）
            setTimeout(() => {
                if (pendingEvents.has(txHash)) {
                    console.log(`⏳ 使用备用方法关联事件 (txHash: ${txHash})...`)
                    associateEventsByTxHash(txHash)
                }
            }, 5000)
        }
    }
})

console.log("\n" + "=".repeat(80))
console.log("✅ 监听器已启动，等待事件...")
console.log("=".repeat(80))
console.log(`HukuNFT 合约: ${HUKU_NFT_ADDRESS}`)
console.log(`HakuToken 合约: ${HAKU_TOKEN_ADDRESS}`)
console.log("=".repeat(80) + "\n")

