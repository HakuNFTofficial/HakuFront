# RPC CORS、429 与 WebSocket 稳定性修复设计

## 背景

Haku Pump 生产页面目前直接从浏览器向 `https://rpc.testnet.arc.network` 发送 JSON-RPC POST 请求。现场控制台已经确认两种失败：

- Arc 公共 RPC 对来自 `https://www.hakupump.club` 的预检请求未返回允许跨域的响应头，浏览器以 CORS 错误阻断请求。
- 同一页面存在多组高频链上轮询，并发请求触发上游 HTTP 429（Too Many Requests）。429 响应如果没有 CORS 头，浏览器也可能只展示为 CORS 错误。

同时，`Banner`、`KLineChart` 和 `NFTSection` 分别调用 `useWebSocket`，因此一个页面会建立多个相同的 `/ws` 连接。当前 Hook 在组件清理时主动关闭连接，但异步 `onclose` 仍可按照旧的 `enabled=true` 闭包安排下一次重连；`connect()` 关闭旧连接时也可能触发同样的竞态。现场控制台已出现被折叠 10 至 15 次的重复连接日志。

`NFTImageReveal` 还会在每个动画帧打印星光绘制日志。多个 NFT 卡片同时渲染时会产生大量日志和额外浏览器开销。

这些问题属于读取与连接层，不涉及 NFT 合约、Token ID、mint/burn 规则或数据库历史数据。

## 目标

1. 浏览器不再直接调用 Arc 公共 RPC，消除页面端 CORS 失败。
2. 降低 Arc 上游请求量，并在上游 429 或短暂故障时有边界地退避。
3. 每个浏览器标签页只维持一个 Haku `/ws` 连接。
4. 组件卸载、页面切换或连接替换后不得遗留重连定时器或旧连接。
5. 移除生产环境高频调试日志。
6. 保持 mint、transfer、burn、钱包签名和现有业务 API 行为不变。

## 非目标

- 不升级或重新部署任何智能合约。
- 不修改 NFT metadata、Token ID 或链上事件。
- 不清理或迁移数据库记录。
- 不把私钥、数据库连接串或上游凭据放入前端或 Git。
- 不允许同源 RPC 端点成为无限制的公开通用代理。

## 方案选择

### 方案 A：仅更换支持 CORS 的公共 RPC

改动最小，但仍受第三方 CORS、公共配额和服务稳定性约束，也不能控制请求方法与缓存。它不能解决页面的请求风暴，因此不采用。

### 方案 B：Nginx 直接反向代理 Arc RPC

能够消除浏览器 CORS，但会把站点变成没有方法限制的公共 RPC 转发器，容易被滥用并耗尽共享上游额度，因此不采用。

### 方案 C：受限后端 RPC 网关 + 前端请求治理 + 单例 WebSocket

后端验证 JSON-RPC 请求、限制批量大小和方法、执行有边界的重试；前端访问同源端点并降低轮询；WebSocket 由全局 Provider 统一管理。这是本次采用的方案。

## 架构与数据流

### 同源 RPC 网关

```text
React/Wagmi
  -> POST /api/rpc
  -> haku-webmatch RpcProxy
  -> https://rpc.testnet.arc.network
```

前端 `wagmi` 的公共读取 transport 改为 `/api/rpc`。钱包连接、签名和发送交易仍由注入钱包 Provider 处理；钱包网络配置仍使用 Arc 官方 RPC，因为该请求由钱包扩展发出而不是页面跨域 `fetch`。

后端 RPC 网关接受单个或批量 JSON-RPC 2.0 请求，规则如下：

- 请求体上限 256 KiB。
- 批量最多 20 个调用。
- 只允许前端读取和交易确认所需的方法，例如 `eth_chainId`、`eth_blockNumber`、`eth_call`、`eth_getBalance`、`eth_getBlockByNumber`、`eth_getTransactionByHash`、`eth_getTransactionReceipt`、`eth_getLogs`、`eth_estimateGas`、`eth_gasPrice`、`eth_maxPriorityFeePerGas` 和 `eth_feeHistory`。
- 明确拒绝 `eth_sendRawTransaction`、管理类、调试类、钱包类和未知方法。
- 保留调用方 JSON-RPC `id`，并原样返回上游成功或 JSON-RPC 错误响应。
- 上游 URL 从后端环境变量读取，默认使用 Arc Testnet 官方 RPC；不返回给前端任何秘密。
- 上游连接与总请求设置超时。
- 仅对 HTTP 429、502、503、504 和网络错误最多重试 2 次，使用带抖动的指数退避；其他 4xx 和 JSON-RPC 业务错误不重试。
- 日志只记录方法、批量数量、耗时和状态，不记录完整参数。

第一版不做跨用户长期 RPC 响应缓存，避免缓存区块高度、receipt 和 `eth_call` 状态造成陈旧数据。请求降载主要通过前端批处理、查询复用和轮询治理完成。

### 前端 RPC 治理

- Wagmi HTTP transport 指向同源 `/api/rpc`，启用小窗口批处理和有限重试。
- 全局 QueryClient 为稳定读取设置合理 `staleTime`，关闭窗口聚焦时的无条件重复获取。
- 钱包链 ID 通过钱包事件更新，不再每 2 秒主动轮询。
- 余额、池状态等高频读取统一到至少 15 秒；稳定配置和价格读取至少 30 秒。
- `document.visibilityState !== 'visible'` 时暂停非交易关键轮询。
- 交易发出后，通过显式失效相关查询立即刷新，而不是依赖高频常驻轮询。

### 单例 WebSocket

在应用根部新增 `WebSocketProvider`：

- 一个标签页只创建一个 `wss://www.hakupump.club/ws` 连接。
- Provider 维护连接状态、重连次数、定时器和订阅者集合。
- `Banner` 订阅 `LatestMintedNFTs`，`KLineChart` 订阅 `KlineUpdate`，`NFTSection` 订阅 `NFTUpdate`。
- 订阅回调通过 ref 更新，不因组件重渲染重建底层连接。
- 连接使用 generation 标识；旧连接的 `onclose` 不能为新 generation 安排重连。
- 主动停止时先禁止重连、清除回调与定时器，再关闭 socket。
- 异常断开使用带抖动指数退避，最大 30 秒；连接成功后重置失败计数。
- 页面隐藏时保持已有连接但不主动制造新连接；页面恢复可触发一次健康检查或重连。

旧的按组件 `useWebSocket` 实现不再用于这三个生产组件，避免多连接并存。

### 图片与日志

- `NFTImageReveal` 保存动画帧 ID，并在 effect 清理时调用 `cancelAnimationFrame`。
- 删除动画帧内的星光绘制日志和星点初始化日志。
- “版本相同”不再在生产控制台输出；仅记录发现新版本和真实错误。
- 保留图片错误日志，但不在每次绘制或成功加载时重复输出。

IPFS 图片同源缓存作为第二阶段独立改动：本次已经被截图直接确认的问题是 RPC CORS/429 与 WebSocket 重复连接。为控制上线风险，本 PR 不同时引入新的图片服务；部署后若仍观察到 IPFS 429，再按独立 PR 增加服务器图片缓存。

## 错误处理

- 后端输入校验失败返回 HTTP 400 和 JSON-RPC 兼容错误体。
- 不允许的方法返回 HTTP 403，并指出方法不受支持但不泄露内部配置。
- 上游最终不可用时返回 HTTP 502 或 503；前端保留上次成功数据并显示可重试状态。
- 前端不得把网络错误解释为 NFT 不存在或余额为零。
- WebSocket 不可用时保留现有 HTTP 初始数据获取作为降级路径。

## 测试策略

### haku-webmatch

- 单请求和批量请求解析。
- 方法白名单允许/拒绝行为。
- 批量上限与请求体上限。
- 429/5xx 重试次数、退避和最终状态映射。
- JSON-RPC `id` 与上游错误透传。
- 日志辅助函数不包含参数正文。

### HakuFront

- Transport 使用同源 `/api/rpc`，不再引用页面端 Arc RPC。
- 单例连接在三个订阅者存在时仍只创建一个 WebSocket。
- 卸载订阅者不关闭仍被其他订阅者使用的连接。
- Provider 卸载后不再重连。
- 旧 generation 的 `onclose` 不影响当前连接。
- NFT 动画卸载会取消 animation frame。
- 生产构建通过。

### 现场验收

1. 在 Chrome 清空控制台后打开生产页面并连接 Arc Testnet 钱包。
2. 进入 Swap 和 Profile 页面，观察至少两分钟。
3. Network 中页面 JSON-RPC 只访问同源 `/api/rpc`，没有 Arc RPC CORS 错误。
4. 同一标签页只有一个 `/ws` 连接，不再重复打印 Connected。
5. 控制台没有逐帧星光日志和重复 Same version 日志。
6. 完成一次余额读取、报价、mint、transfer、burn，并确认链上交易成功。
7. 检查后端与 Nginx 日志没有持续 429、5xx 或异常重连。

## 部署与回滚

两个仓库分别使用独立修复分支和 PR：

- `HakuNFTofficial/haku-webmatch`: 后端受限 RPC 网关。
- `HakuNFTofficial/HakuFront`: 同源 transport、轮询治理、单例 WebSocket 和日志清理。

上线前备份后端二进制、systemd 配置、Nginx 配置、前端 `dist` 与当前 commit。先部署后端并用受限测试请求验证 `/api/rpc`，再部署前端。若前端异常，可只回滚前端；若代理异常，可同时回滚前端和后端。整个过程不执行数据库迁移和合约部署。

## 成功标准

- 页面不再直接请求 `rpc.testnet.arc.network`。
- 页面没有 Arc RPC CORS 错误或成批 429。
- 每个标签页只有一个 `/ws` 连接。
- 组件卸载后没有残留 WebSocket 重连或动画帧。
- mint、transfer、burn 与现有 NFT 数据保持原行为。
- 任何敏感环境变量都不进入 Git、构建产物或浏览器。
