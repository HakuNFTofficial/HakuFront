# Configuration Management Guide

## 📋 Single Source of Truth

**Primary Configuration**: `src/PoolConfig.sol`

This Solidity library contains all pool configuration parameters. Scripts read directly from this file at runtime - **no manual synchronization required!**

## 🎯 Direct Reading (Zero Sync!)

### How It Works
```bash
# Just run the script - it reads PoolConfig.sol automatically!
node scripts/remove_liquidity.mjs

# ✅ Configuration loaded directly from src/PoolConfig.sol
```

**No intermediate files, no sync scripts, no manual steps!**

## 🔄 Configuration Files

### 1. **src/PoolConfig.sol** (Primary Source)
```solidity
library PoolConfig {
    address public constant POOL_MANAGER = 0xaD05f7c50825374aE2dE3F29d36346FB98512182;
    address public constant TOKEN_A = 0x0000000000000000000000000000000000000000;
    address public constant TOKEN_B = 0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3;
    
    uint24 public constant FEE = 0x800000; // DYNAMIC_FEE_FLAG
    uint24 public constant HOOK_FEE = 3000;
    int24 public constant TICK_SPACING = 60;
    address public constant HOOKS = 0xe944714Cdd3db46821D54a4B07e5f32faaFF0088;
    
    bytes32 public constant POOL_ID = 0x53355d416cc700d400fbca59da38fe01d18546b45c7cddb85c19a9bfd9c328f8;
}
```

### 2. **frontend/src/config/contracts.ts** (Frontend Config)
```typescript
export const CONTRACTS = {
    POOL_MANAGER: '0xaD05f7c50825374aE2dE3F29d36346FB98512182',
    TOKEN_A: '0x0000000000000000000000000000000000000000',
    TOKEN_B: '0x41166CCe5C4C6673e7eF4c59169896d7e29c89f3',
    // ...
}

export const POOL_CONFIG = {
    FEE: DYNAMIC_FEE_FLAG,  // 0x800000
    HOOK_FEE: 3000,
    TICK_SPACING: 60,
    HOOKS: '0xe944714Cdd3db46821D54a4B07e5f32faaFF0088',
    POOL_ID: '0x53355d416cc700d400fbca59da38fe01d18546b45c7cddb85c19a9bfd9c328f8',
}
```

### 3. **scripts/loadPoolConfig.mjs** (Config Loader)
```javascript
// 🎯 Parses PoolConfig.sol at runtime
export function loadPoolConfig() {
    const content = readFileSync('src/PoolConfig.sol', 'utf8');
    const fee = extractConstant(content, 'FEE');
    const hooks = extractConstant(content, 'HOOKS');
    // ... returns parsed config object
}
```

### 4. **scripts/remove_liquidity.mjs** (Directly reads PoolConfig.sol)
```javascript
// 🎯 Loads from PoolConfig.sol at runtime - always fresh!
import { loadAndDisplayConfig } from './loadPoolConfig.mjs';

const config = loadAndDisplayConfig();
const FEE = config.pool.fee;      // ✅ Always up-to-date!
const HOOKS = config.pool.hooks;
const POOL_ID = config.pool.poolId;
```

## 🔧 When to Update Configurations

### Scenario 1: Redeploying Hook Contract
1. ✅ Update `HOOKS` address in `src/PoolConfig.sol`
2. ✅ Run `forge build` to recompile
3. ✅ Reinitialize pool to get new `POOL_ID`
4. ✅ Update `POOL_ID` in `src/PoolConfig.sol`
5. ✅ Update `frontend/src/config/contracts.ts` (manual)
6. ✅ **Done!** Scripts read from PoolConfig.sol automatically

### Scenario 2: Changing Pool Parameters
1. ✅ Update parameters in `src/PoolConfig.sol`
2. ✅ Run `forge build`
3. ✅ Update `frontend/src/config/contracts.ts` (manual)
4. ✅ **Done!** Scripts read from PoolConfig.sol automatically

### Scenario 3: Deploying New Token
1. ✅ Update token addresses in `src/PoolConfig.sol`
2. ✅ Run `forge build`
3. ✅ Reinitialize pool and update `POOL_ID`
4. ✅ Update `frontend/src/config/contracts.ts` (manual)
5. ✅ **Done!** Scripts read from PoolConfig.sol automatically

## ⚠️ Important Notes

### How It Works
- **Runtime Parsing**: Scripts read and parse `PoolConfig.sol` when they run
- **No Build Step**: No intermediate files, no sync scripts
- **Always Fresh**: Changes to `PoolConfig.sol` are immediately reflected
- **Single Source**: Only `PoolConfig.sol` needs to be updated

### PoolId Calculation
```
PoolId = keccak256(abi.encode(
    currency0,    // TOKEN_A or TOKEN_B (sorted)
    currency1,    // TOKEN_B or TOKEN_A (sorted)
    fee,          // 0x800000 (DYNAMIC_FEE_FLAG)
    tickSpacing,  // 60
    hooks         // Hook contract address
))
```

**Critical**: If any of these 5 parameters change, you MUST:
1. Calculate new PoolId
2. Update `POOL_ID` in all configuration files
3. Reinitialize the pool on-chain

## 📝 Verification Checklist

Before deploying or running scripts:

- [ ] `src/PoolConfig.sol` has correct values
- [ ] `frontend/src/config/contracts.ts` matches PoolConfig.sol (manual check)
- [ ] **Scripts automatically use PoolConfig.sol** ✅

## 🔍 Quick Verification Commands

```bash
# Check PoolConfig.sol (source of truth)
grep -E "constant (FEE|HOOKS|POOL_ID)" src/PoolConfig.sol

# Test script reads correctly
node scripts/remove_liquidity.mjs | head -20

# Check frontend config (needs manual sync)
grep -E "(FEE|HOOKS|POOL_ID)" frontend/src/config/contracts.ts
```

## 🎯 Summary

**Workflow:**
```
1. Edit src/PoolConfig.sol
2. Run forge build
3. Update frontend/src/config/contracts.ts (manual)
4. Done! Scripts read from PoolConfig.sol automatically ✅
```

**Key Benefits:**
- 🏗️ `src/PoolConfig.sol` is the single source of truth
- 🎯 Scripts read directly at runtime - **zero sync needed**
- ⚡ Changes are immediate - no build/sync step
- 🚀 Less maintenance, fewer errors
- 📝 Only frontend needs manual sync
