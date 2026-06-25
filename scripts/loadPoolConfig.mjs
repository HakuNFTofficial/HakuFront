/**
 * Load Pool Configuration directly from src/PoolConfig.sol
 * 
 * This module reads and parses PoolConfig.sol at runtime,
 * ensuring configurations are always up-to-date with no manual sync required.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POOL_CONFIG_PATH = join(__dirname, '..', 'src', 'PoolConfig.sol');

/**
 * Extract a constant value from PoolConfig.sol
 * @param {string} content - The content of PoolConfig.sol
 * @param {string} constantName - The name of the constant to extract
 * @returns {string|null} The extracted value or null if not found
 */
function extractConstant(content, constantName) {
    // Match: constant NAME = VALUE;
    // Handles various formats like:
    // - address public constant NAME = 0x...;
    // - uint24 public constant NAME = 3000;
    // - bytes32 public constant NAME = 0x...;
    const regex = new RegExp(
        `${constantName}\\s*=\\s*([^;]+);`,
        'i'
    );
    const match = content.match(regex);
    if (match) {
        let value = match[1].trim();
        
        // Handle special cases
        // LPFeeLibrary.DYNAMIC_FEE_FLAG -> 0x800000
        if (value.includes('DYNAMIC_FEE_FLAG')) {
            return '0x800000';
        }
        
        return value;
    }
    return null;
}

/**
 * Parse hex or decimal string to number
 * @param {string} value - The value to parse
 * @returns {number} Parsed number
 */
function parseValue(value) {
    if (!value) return 0;
    
    // Remove any comments or trailing text
    value = value.split('//')[0].trim();
    
    if (value.startsWith('0x')) {
        return parseInt(value, 16);
    }
    return parseInt(value, 10);
}

/**
 * Load all configuration from PoolConfig.sol
 * @returns {Object} Configuration object
 */
export function loadPoolConfig() {
    // Read PoolConfig.sol
    const content = readFileSync(POOL_CONFIG_PATH, 'utf8');
    
    // Extract all constants
    const poolManager = extractConstant(content, 'POOL_MANAGER');
    const tokenA = extractConstant(content, 'TOKEN_A');
    const tokenB = extractConstant(content, 'TOKEN_B');
    const swapExecutor = extractConstant(content, 'SWAP_EXECUTOR');
    const quoter = extractConstant(content, 'QUOTER');
    
    const feeStr = extractConstant(content, 'FEE');
    const hookFeeStr = extractConstant(content, 'HOOK_FEE');
    const tickSpacingStr = extractConstant(content, 'TICK_SPACING');
    const hooks = extractConstant(content, 'HOOKS');
    
    const sqrtPriceX96Str = extractConstant(content, 'SQRT_PRICE_X96');
    const liquidityRatioStr = extractConstant(content, 'LIQUIDITY_RATIO');
    const poolId = extractConstant(content, 'POOL_ID');
    
    // Parse numeric values
    const fee = parseValue(feeStr);
    const hookFee = parseValue(hookFeeStr);
    const tickSpacing = parseValue(tickSpacingStr);
    const liquidityRatio = parseValue(liquidityRatioStr);
    
    return {
        // Network (hardcoded as it's not in PoolConfig.sol)
        network: {
            rpcUrl: 'https://dream-rpc.somnia.network',
            chainId: 50312,
            chainName: 'Somnia Dream'
        },
        
        // Contract addresses
        contracts: {
            poolManager,
            tokenA,
            tokenB,
            swapExecutor,
            quoter,
            // These are not in PoolConfig.sol, use known values
            addLiquidityExecutor: '0xB93Fcd0919b8cB83abEb417060D9120Db8Bc90B0',
            hukuNft: '0x8557aFC94164F53a0828EB4ca16afE7dE280BE34'
        },
        
        // Pool parameters
        pool: {
            fee,
            feeHex: feeStr,
            hookFee,
            tickSpacing,
            hooks,
            sqrtPriceX96: sqrtPriceX96Str,
            liquidityRatio,
            poolId
        },
        
        // Position parameters (now in PoolConfig.sol)
        position: {
            tickLower: parseInt(extractConstant(content, 'TICK_LOWER')),
            tickUpper: parseInt(extractConstant(content, 'TICK_UPPER')),
            salt: extractConstant(content, 'SALT')
        }
    };
}

/**
 * Load and display configuration
 */
export function loadAndDisplayConfig() {
    const config = loadPoolConfig();
    
    console.log('✅ Configuration loaded directly from src/PoolConfig.sol\n');
    
    return config;
}
