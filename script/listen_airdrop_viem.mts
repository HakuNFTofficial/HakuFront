import { createPublicClient, webSocket, parseAbi } from "viem";
import { defineChain } from "viem";

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

import { formatUnits } from "ethers";

// 1️⃣ 创建 WebSocket 客户端（新版 Viem）
const client = createPublicClient({
    chain: somnia,
    transport: webSocket("wss://dream-rpc.somnia.network/ws")
});

// 2️⃣ ABI 定义
const abi = parseAbi([
    "event Airdropped(address indexed to, uint256 amount, uint256 totalAirdropped)"
]);

// 3️⃣ 监听事件
console.log("Listening for Airdrop events...");
client.watchContractEvent({
    address: "0x9622Adff52511079B59077EAFe0F57aB7C0Aa32E",
    abi: abi,
    eventName: "Airdropped",
    onLogs: logs => {
        for (const log of logs) {
            const { to, amount, totalAirdropped } = log.args;
            console.log("🎉 New Airdrop Event!");
            console.log("To:", to);
            // @ts-ignore
            console.log("Amount:", formatUnits(amount, 18));
            // @ts-ignore
            console.log("TotalAirdropped:", totalAirdropped.toString());
            console.log("Block Number:", log.blockNumber);
        }
    }
});