# Haku Pump Development Environment

A complete local development environment for Uniswap V4 with NFT minting, token swapping, and liquidity management features.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Development](#development)
- [Testing](#testing)
- [NFT Preview Assets](#nft-preview-assets)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## 🎯 Overview

This project provides a full-stack development environment for building on Uniswap V4, including:

- **Smart Contracts**: Uniswap V4 core contracts with custom hooks
- **NFT System**: ERC721 NFT minting with chip-based reveal mechanism
- **Swap Interface**: Token swapping with slippage protection
- **Liquidity Management**: Add/remove liquidity operations
- **Frontend**: React + TypeScript + Wagmi web application
- **Mobile Support**: Optimized for mobile wallet integration

## ✨ Features

### Smart Contracts (Foundry)
- ✅ Uniswap V4 Pool Manager integration
- ✅ Custom Swap Executor
- ✅ NFT Minting Contract (HukuNFT)
- ✅ ERC20 Token (HakuToken)
- ✅ Liquidity management hooks
- ✅ Upgradeable contracts (UUPS pattern)

### Frontend (React + Vite)
- ✅ Wallet connection (MetaMask, WalletConnect, etc.)
- ✅ NFT minting and viewing
- ✅ Chip-based NFT reveal system
- ✅ Token swapping interface
- ✅ Real-time price charts (K-Line)
- ✅ Liquidity pool management
- ✅ Mobile-responsive design
- ✅ Dark theme UI

### NFT System
- ✅ Chip collection mechanism
- ✅ Progressive image reveal
- ✅ Grayscale to color transition
- ✅ Animated chip reveal effects
- ✅ IPFS image storage

## 📁 Project Structure

```
uniswap-v4-local/
├── src/                    # Solidity smart contracts
│   ├── HukuNFT.sol        # NFT minting contract
│   ├── HakuToken.sol      # ERC20 token
│   ├── SwapExecutor.sol   # Swap execution contract
│   └── ...
├── script/                 # Deployment scripts
├── test/                   # Foundry tests
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── config/         # Configuration files
│   │   └── utils/          # Utility functions
│   └── package.json
├── lib/                    # Foundry dependencies
│   └── v4-core/           # Uniswap V4 core contracts
│   └── v4-periphery/      # Uniswap V4 periphery contracts
├── scripts/                # Shell scripts for deployment
├── foundry.toml            # Foundry configuration
└── README.md
```

## 🔧 Prerequisites

- **Node.js** >= 18.0.0
- **Foundry** >= 0.2.0
- **Rust** (for Foundry)
- **Git**

### Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd uniswap-v4-local
```

### 2. Install Foundry dependencies

```bash
forge install
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Install root dependencies (optional)

```bash
npm install
```

## 🏃 Quick Start

### Start Local Blockchain

```bash
# Terminal 1: Start Anvil
anvil

# Note the private keys and RPC URL (usually http://localhost:8545)
```

### Deploy Contracts

```bash
# Deploy all contracts
forge script script/DeployV4.s.sol:DeployV4Script --rpc-url http://localhost:8545 --broadcast --private-key <your_private_key>

# Or use deployment scripts
./scripts/deploy_all.sh
```

### Start Frontend

```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser.

## 💻 Development

### Smart Contracts

#### Build

```bash
forge build
```

#### Test

```bash
forge test
forge test -vvv  # Verbose output
```

#### Format

```bash
forge fmt
```

#### Gas Snapshots

```bash
forge snapshot
```

### Frontend

#### Development Server

```bash
cd frontend
npm run dev
```

#### Build for Production

```bash
cd frontend
npm run build
```

#### Preview Production Build

```bash
cd frontend
npm run preview
```

### Common Development Tasks

#### Check Contract Balance

```bash
cast balance <address> --rpc-url http://localhost:8545
```

#### Send Transaction

```bash
cast send <contract_address> "<function_signature>" <args> --rpc-url http://localhost:8545 --private-key <key>
```

#### Query Contract State

```bash
cast call <contract_address> "<function_signature>" <args> --rpc-url http://localhost:8545
```

## 🧪 Testing

### Smart Contract Tests

```bash
# Run all tests
forge test

# Run specific test file
forge test --match-path test/HukuNFT.t.sol

# Run with gas reporting
forge test --gas-report
```

### Frontend Tests

```bash
cd frontend
npm test
```

## NFT Preview Assets

Before minting completes, the frontend loads a dedicated 512×512 WebP silhouette
instead of the 3000×3000 original PNG. Generate the complete preview collection from
the repository root with Node.js 20.9 or newer:

```bash
npm run preview:generate -- --input "/Users/martin/Documents/我的文档/NFT/haku-final-10000/build/images" --output /private/tmp/haku-nft-silhouettes --expected-count 10000 --concurrency 4
npm run preview:validate -- --input "/Users/martin/Documents/我的文档/NFT/haku-final-10000/build/images" --output /private/tmp/haku-nft-silhouettes --expected-count 10000
```

The generator requires an empty output directory and writes `manifest.json` alongside
exactly 10,000 WebP files. Pin the validated output directory as a separate IPFS
directory, then set its returned root CID as `VITE_IPFS_PREVIEW_CID` in the frontend
build environment. A frontend deployment must not proceed while this value is empty.

Before deploying the frontend, verify that the configured gateway returns HTTP 200 and
`Content-Type: image/webp` for representative `1.webp`, `3995.webp`, and `10000.webp`
URLs.

## 📦 Deployment

### Deploy to Testnet

```bash
# Set environment variables
export RPC_URL=<your_testnet_rpc>
export PRIVATE_KEY=<your_private_key>

# Deploy
forge script script/DeployV4.s.sol:DeployV4Script \
  --rpc-url $RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY \
  --verify
```

### Deploy Frontend

```bash
cd frontend
npm run build

# Deploy dist/ to your hosting service
# (Vercel, Netlify, GitHub Pages, etc.)
```

## ⚙️ Configuration

### Foundry Configuration

Edit `foundry.toml`:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.26"
evm_version = "cancun"
optimizer = true
optimizer_runs = 200
```

### Frontend Configuration

Edit `frontend/src/config/`:

- `chain.ts` - Chain configuration
- `contracts.ts` - Contract addresses and ABIs
- `ipfs.ts` - IPFS gateway configuration

### Pool Configuration (Single Source of Truth)

**All pool parameters are centralized in `src/PoolConfig.sol`:**

```solidity
// src/PoolConfig.sol
library PoolConfig {
    address public constant POOL_MANAGER = 0xaD...;
    address public constant TOKEN_A = 0x0000...;
    address public constant TOKEN_B = 0x4116...;
    
    uint24 public constant FEE = LPFeeLibrary.DYNAMIC_FEE_FLAG;
    int24 public constant TICK_SPACING = 59;
    
    int24 public constant TICK_LOWER = -887183;  // Aligned with tickSpacing
    int24 public constant TICK_UPPER = 887183;
    bytes32 public constant SALT = 0x00...;
}
```

**Access configuration in scripts:**

```bash
# Shell scripts
source scripts/load_pool_config.sh
echo $POOL_CONFIG_TICK_LOWER

# Node.js scripts
import { loadPoolConfig } from './loadPoolConfig.mjs';
const config = loadPoolConfig();
```

📚 See `POOL_CONFIG_CENTRALIZATION.md` for details.

### Environment Variables

Create `frontend/.env.local`:

```env
VITE_RPC_URL=http://localhost:8545
VITE_CHAIN_ID=31337
VITE_CONTRACT_ADDRESSES=<contract_addresses>
VITE_WALLETCONNECT_PROJECT_ID=replace_with_reown_project_id
```

`VITE_WALLETCONNECT_PROJECT_ID` enables the WalletConnect QR option in the
wallet picker. Create the ID in the Reown Dashboard and configure it as a
build-time environment variable. Do not commit the real value to Git.

For the production frontend at `https://www.hakupump.club`, set the same
variable in the production build environment before running `npm run build`.
Add `https://www.hakupump.club` to the Reown project's Allowed Domains. Also
add `https://hakupump.club` when the bare domain serves or redirects into the
application.

## 🔍 Troubleshooting

### Common Issues

#### Contract Deployment Fails

- Check Anvil is running
- Verify private key has sufficient balance
- Check contract compilation: `forge build`

#### Frontend Can't Connect to Wallet

- Ensure MetaMask is installed
- Check network configuration matches
- Verify RPC URL is correct

#### NFT Images Not Loading

- Check IPFS gateway configuration
- Verify CORS settings
- Check image URLs in contract metadata

### Mobile Development

See [MOBILE_QUICK_START.md](./MOBILE_QUICK_START.md) for mobile debugging guide.

**Quick Tips:**
- Use MetaMask mobile browser (not Safari/Chrome)
- Add `?test=1` to URL for debug mode
- Check network connection settings

## 📚 Documentation

### Project Documentation

- [`POOL_CONFIG_CENTRALIZATION.md`](POOL_CONFIG_CENTRALIZATION.md) - Configuration management guide
- [`TICK_ALIGNMENT_FIX.md`](TICK_ALIGNMENT_FIX.md) - Tick alignment troubleshooting
- [`AGENTS.md`](AGENTS.md) - Guidelines for AI agents

### External Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Uniswap V4 Core](https://github.com/Uniswap/v4-core)
- [Wagmi Documentation](https://wagmi.sh/)
- [Vite Documentation](https://vitejs.dev/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **Solidity**: Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- **TypeScript**: Use ESLint and Prettier
- **Commits**: Use conventional commit messages

## 📝 Scripts Reference

### Deployment Scripts

```bash
# Deploy Swap Executor
./scripts/redeploy_swap_executor.sh

# Add Liquidity
./scripts/add_liquidity_to_new_pool.sh

# Check Pool Status
./scripts/check_pool_fee.sh
```

### Utility Scripts

```bash
# Check Token Balance
./scripts/check_hakutoken_balance.sh <address>

# Query Pool Details
./scripts/check_position_details.sh
```

## 🛠️ Available Commands

### Foundry

```bash
forge build          # Build contracts
forge test           # Run tests
forge fmt            # Format code
forge snapshot       # Gas snapshots
anvil                # Start local node
cast <command>       # CLI tool for interactions
```

### Frontend

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
```

## 📄 License

[Add your license here]

## 🙏 Acknowledgments

- [Uniswap](https://uniswap.org/) for the V4 protocol
- [Foundry](https://getfoundry.sh/) for the development toolkit
- [Wagmi](https://wagmi.sh/) for React hooks
- [Vite](https://vitejs.dev/) for the build tool

---

**Happy Building! 🚀**
