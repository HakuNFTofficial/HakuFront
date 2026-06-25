# AGENTS.md

This document provides guidelines for AI agents working on this Uniswap V4 local development environment.

## Project Overview

This is a full-stack Uniswap V4 development environment with:
- **Smart Contracts**: Solidity contracts using Foundry (Solidity 0.8.26)
- **Frontend**: React + TypeScript + Vite + Wagmi
- **Deployed on**: Somnia Testnet

## Build Commands

### Foundry (Smart Contracts)

```bash
# Build all contracts
forge build

# Build with gas report
forge build --gas-report

# Run all tests
forge test

# Run single test file
forge test --match-path test/SimpleAirdrop.t.sol

# Run single test function
forge test --match-test testAirdrop

# Run with verbose output (vvv for more detail)
forge test -vvv

# Run with gas snapshots
forge snapshot

# Format Solidity code
forge fmt

# Start local blockchain (Anvil)
anvil
```

### Frontend (React)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npx tsc --noEmit
```

### Deployment Scripts

```bash
# Deploy contracts via Foundry script
forge script script/DeployV4.s.sol:DeployV4Script --rpc-url http://localhost:8545 --broadcast --private-key <KEY>

# Or use shell scripts in /scripts directory
./scripts/deploy_all.sh
./scripts/redeploy_swap_executor.sh
./scripts/upgrade_swap_executor.sh
```

## Code Style Guidelines

### Solidity Conventions

**Formatting:**
- Use 4 spaces for indentation (not tabs)
- Max line width: 120 characters
- Run `forge fmt` before committing

**Imports:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
```

**Naming:**
- Contracts: PascalCase (e.g., `FeeGrowthHook`, `SimpleAirdrop`)
- Functions: camelCase (e.g., `getHookPermissions`, `beforeSwap`)
- Variables: camelCase (e.g., `poolManager`, `feeAmount`)
- Constants: UPPER_SNAKE_CASE (e.g., `LPFEE_FOR_NO_CORE_FEE`)
- Private/internal functions: leading underscore (e.g., `_beforeSwap`)

**Visibility Order:**
1. Type declarations
2. Constant declarations
3. Events
4. Errors
5. External functions
6. Public functions
7. Internal functions
8. Private functions
9. External view/pure
10. Public view/pure

**Error Handling:**
- Use `require()` for validation with error messages
- Use custom errors for reverts (preferred):
```solidity
error InsufficientBalance(uint256 requested, uint256 available);
```
- Use `revert CustomError()` for custom error reverts

**Hook Pattern:**
```solidity
contract FeeGrowthHook is BaseHook {
    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return Hooks.Permissions({...});
    }

    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        // implementation
    }
}
```

### TypeScript/React Conventions

**Formatting:**
- Use Prettier (2 spaces for indentation)
- Single quotes for strings
- Trailing commas enabled
- Run `npx prettier --write .` before committing

**TypeScript Rules (strict mode enabled in tsconfig.json):**
- Always specify types for function parameters and return values
- No `any` types - use `unknown` or specific types
- Enable `noUnusedLocals` and `noUnusedParameters`

**Imports:**
```typescript
import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Swap } from './components/Swap'
import { CONTRACTS } from './config/contracts'
```

**Naming:**
- Components: PascalCase (e.g., `Swap.tsx`, `NFTSection.tsx`)
- Hooks: camelCase with "use" prefix (e.g., `useWalletChainId`)
- Variables/ Functions: camelCase (e.g., `isLoading`, `handleCopy`)
- Constants: UPPER_SNAKE_CASE (e.g., `REQUIRED_CHAIN_ID`)
- Files: kebab-case for non-component files (e.g., `chain-config.ts`)

**React Patterns:**
- Use functional components with hooks
- Use TypeScript interfaces for props:
```typescript
interface SwapProps {
    onSwapComplete: (txHash: string) => void
    disabled?: boolean
}
```
- Destructure props in component signature:
```typescript
function Swap({ onSwapComplete, disabled = false }: SwapProps) {
```
- Use console.log with context prefixes:
```typescript
console.log('[Swap] Processing swap request:', { amount, token })
```

**Error Handling:**
- Use try/catch with error logging:
```typescript
try {
    const result = await contract.function()
    console.log('[Component] Success:', result)
} catch (err) {
    console.error('[Component] Error:', err)
    setError(err instanceof Error ? err.message : 'Unknown error')
}
```

## Project Structure

```
uniswap-v4-local/
├── src/                    # Solidity contracts
│   ├── HakuToken.sol       # ERC20 token
│   ├── HukuNFT.sol         # NFT contract
│   ├── SwapExecutor.sol    # Swap router
│   └── ...
├── script/                 # Foundry deployment scripts
├── test/                   # Foundry tests (*.t.sol)
├── lib/                    # Git submodule dependencies
│   ├── v4-core/           # Uniswap V4 core
│   ├── v4-periphery/      # Uniswap V4 periphery
│   └── openzeppelin-contracts/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── config/        # Configuration
│   │   └── utils/         # Utilities
│   └── package.json
├── scripts/               # Shell deployment scripts
├── foundry.toml           # Foundry config
└── README.md
```

## Configuration Files

- `foundry.toml`: Solidity compiler settings (0.8.26, Cancun EVM)
- `frontend/tsconfig.json`: TypeScript strict mode, ES2020 target
- `lib/v4-core/.prettierrc`: Prettier config (4-space Solidity, 2-space JSON)

## Key Dependencies

**Smart Contracts:**
- `@uniswap/v4-core`: Pool manager, hooks, types
- `@uniswap/v4-periphery`: BaseHook, utilities
- `@openzeppelin/contracts`: ERC721, UUPS proxy, Ownable

**Frontend:**
- `wagmi`: React hooks for Ethereum
- `@tanstack/react-query`: Server state management
- `viem`: Ethereum client
- `lightweight-charts`: Trading charts

## Testing Guidelines

**Solidity Tests:**
- Place in `test/` directory with `.t.sol` suffix
- Use `vm.expectEmit()` for event testing
- Use `vm.prank()` for caller spoofing
- Use `vm.roll()` for block manipulation

**Test Isolation:**
```solidity
function setUp() public {
    // Deploy fresh contracts for each test file
    token = new TestToken("Test", "TEST", 18);
    // ...
}
```

## Security Considerations

- Never commit private keys or mnemonics
- Use environment variables for sensitive data
- Always verify signatures server-side
- Use `nonReentrant` modifiers on functions that transfer tokens
- Follow Checks-Effects-Interactions pattern

## Useful Commands

```bash
# Check token balance
./scripts/check_hakutoken_balance.sh <ADDRESS>

# Query pool details
./scripts/check_position_details.sh

# Verify contract on block explorer (if verified)
cast code <ADDRESS> --rpc-url <RPC_URL>

# Call read-only contract function
cast call <ADDRESS> "functionName(args)" --rpc-url <RPC_URL>
```

## Troubleshooting

- **Build fails**: Run `forge clean && forge build`
- **Frontend type errors**: Run `cd frontend && npx tsc --noEmit`
- **Contract tests fail**: Check `setUp()` function for proper initialization
- **Network mismatch**: Ensure `REQUIRED_CHAIN_ID` in `frontend/src/config/chain.ts` matches your deployment network
