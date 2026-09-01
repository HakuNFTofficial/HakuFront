# AddLiquidityExecutor Budgeted Liquidity Design

## Goal

Make `AddLiquidityExecutor` safely add liquidity to the Arc Testnet USDC/Haku Uniswap V4 pool from explicit maximum token budgets. The contract must calculate liquidity from the pool price at execution time, enforce owner-only access, apply caller-supplied minimum-use and deadline protections, and return unused funds without changing the existing UUPS proxy storage layout.

## Confirmed Pool Configuration

- PoolManager: `0x447032aAa569105437516dA21792862Bf05422C6`
- currency0: Arc native USDC, `0x0000000000000000000000000000000000000000`
- currency1: Haku proxy, `0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12`
- dynamic fee flag: `8388608` (`0x800000`)
- tick spacing: `60`
- hook: `0xb7812d8F30e1e0a0434AC917b868AAeccaBF4088`
- tick range: `-887220` through `887220`
- position salt: zero
- PoolId: `0x12512a4efd2e73344522fd8f20520575d943f6127fde7a0b6c8d70f41cfe8f5c`
- initialized price: `1 USDC = 2000 Haku`
- initialized `sqrtPriceX96`: `3543191142285914205922034323214`
- initial tick: `76012`
- existing Executor proxy: `0x6B184D87FdcD84C111a149289DCdAA40376EEB24`

The first planned budget is `25,000 USDC` and `50,000,000 Haku`. These values are transaction inputs, not contract constants.

## Current Defect

The existing `addLiquidity(uint256 amountA)` computes `amountB` from a fixed ratio, transfers both budgets into the Executor, and then uses `amountA` directly as `liquidityDelta`. Uniswap V4 liquidity `L` is not denominated in token0, so this uses only a small portion of the transferred assets and leaves the remainder in the Executor. The decoded `amountB` is not used to calculate liquidity.

## External Interface

Replace the old one-argument function with:

```solidity
function addLiquidity(
    uint256 amount0Max,
    uint256 amount1Max,
    uint256 amount0Min,
    uint256 amount1Min,
    uint256 deadline
) external payable onlyOwner;
```

The legacy `addLiquidity(uint256)` selector will no longer be supported. The repository's add-liquidity script must be updated to call the new selector.

`amount0Max` and `amount1Max` are maximum transaction budgets. `amount0Min` and `amount1Min` constrain the principal amounts used to create new liquidity. `deadline` is an absolute Unix timestamp. The operating script defaults to a 50-basis-point minimum-use tolerance and a 300-second validity window, while requiring both maximum budgets as explicit inputs.

## On-Chain Calculation

The Executor constructs the PoolKey from `PoolConfig` and verifies that its calculated PoolId equals `PoolConfig.POOL_ID`. Inside `unlockCallback`, while PoolManager is unlocked for this Executor, it:

1. Reads the current `sqrtPriceX96` with `StateLibrary.getSlot0`.
2. Converts `PoolConfig.TICK_LOWER` and `PoolConfig.TICK_UPPER` with `TickMath.getSqrtPriceAtTick`.
3. Calls `LiquidityAmounts.getLiquidityForAmounts` with the live price, tick boundaries, and maximum budgets.
4. Rejects zero liquidity.
5. Calls `modifyLiquidity` with the calculated positive liquidity delta and configured position salt.

The calculation occurs in the unlock callback so the price cannot change between calculation and liquidity modification.

## Validation and Failure Behavior

Before moving funds, the Executor validates:

- the caller is the proxy owner;
- `block.timestamp <= deadline`;
- both maximum budgets are nonzero;
- each minimum is less than or equal to its corresponding maximum;
- `msg.value == amount0Max`;
- the configured PoolKey hashes to the configured PoolId.

During the callback, it validates:

- the pool is initialized (`sqrtPriceX96 != 0`);
- calculated liquidity is nonzero and representable by `modifyLiquidity`;
- principal token0 and token1 usage do not exceed the maximum budgets;
- principal token0 and token1 usage meet the supplied minimums.

Failures use typed custom errors carrying the relevant expected and actual values. Any failure reverts the entire transaction, including the Haku transfer and native value transfer.

## Settlement, Fees, and Refunds

The Executor pulls `amount1Max` Haku with OpenZeppelin `SafeERC20` and receives exactly `amount0Max` native USDC as `msg.value` before entering the callback.

`PoolManager.modifyLiquidity` returns both caller delta and accrued-fee delta. The Executor derives principal delta as `callerDelta - feesAccrued` so minimum-use checks measure newly added liquidity rather than net settlement after fees.

The callback settles negative caller deltas and takes positive caller deltas. It returns the calculated liquidity, principal usage, and net settlement information to `addLiquidity`. After `unlock` completes, `addLiquidity` returns exactly the unused portion of this transaction's maximum budgets plus any fee credits realized by this modification. It never sweeps unrelated pre-existing Executor balances.

Native refunds use a checked call. Haku transfers use `SafeERC20`. A failed refund reverts the transaction.

Emit a `LiquidityAdded` event containing the indexed PoolId and owner, liquidity added, principal amounts used, and token amounts returned to the owner.

## Access and Upgrade Compatibility

`addLiquidity` becomes `onlyOwner`. This prevents third parties from donating assets into a Position owned by the Executor and removable only by the Executor owner.

The implementation must not add, remove, reorder, or change the types of these existing storage variables:

1. `poolManager`
2. `tokenA`
3. `tokenB`

Errors, events, local structs, constants, and internal functions do not consume proxy storage. Existing removal, withdrawal, position-query, initialization, synchronization, and UUPS authorization behavior remains available.

The existing proxy remains in place. Deployment creates only a new implementation, checks its bytecode and `proxiableUUID`, simulates `upgradeToAndCall`, and then upgrades proxy `0x6B184D87FdcD84C111a149289DCdAA40376EEB24`. It does not deploy another proxy, call `initialize` again, or call `syncTokensFromConfig` when token state is already correct.

No deployment or high-value liquidity transaction is broadcast automatically. The operator executes those commands after reviewing their simulations and parameters.

## Script Behavior

`scripts/add_liquidity_to_new_pool.sh` will:

- enable strict shell error handling;
- load the current PoolConfig values;
- require explicit maximum USDC and Haku budgets;
- default `SLIPPAGE_BPS` to `50` and reject values above `10000`;
- default `DEADLINE_SECONDS` to `300` and compute an absolute deadline immediately before simulation;
- calculate both minimum-use values from the explicit maximum budgets;
- verify the signer is the Executor owner;
- verify Haku balance and native balance;
- approve only the required Haku maximum when allowance is insufficient;
- simulate the exact five-argument call before broadcasting;
- stop on any RPC/preflight error instead of treating a failed check as empty data;
- print the maximums, minimums, deadline, PoolId, Hook, and final transaction hash without printing the private key.

## Tests

TDD begins with a regression test that calls the new selector against the old implementation and fails because the behavior is absent.

Unit and integration coverage includes:

- correct liquidity calculation at the initialized 1:2000 price;
- price cases equivalent to 1:1980 and 1:2020;
- zero budgets, invalid minimums, expired deadline, wrong native value, zero liquidity, and uninitialized pool;
- non-owner rejection;
- insufficient Haku allowance or balance;
- maximum budgets are never exceeded;
- minimum-use constraints cause an atomic revert;
- unused native USDC and Haku are returned;
- the Executor retains none of this transaction's unused funds;
- Position liquidity equals the computed liquidity;
- a repeated addition handles accrued fees separately from new principal;
- a local UUPS upgrade preserves owner, PoolManager, tokenA, and tokenB;
- `proxiableUUID` remains valid;
- an Arc Testnet fork simulates the new PoolId, Hook, price, and planned budgets without broadcasting.

The baseline command is `forge test --offline`. Fork tests use an explicitly supplied Arc RPC URL and a pinned or reported block. Compilation, focused tests, full tests, storage-layout comparison, and script syntax checks must pass before deployment instructions are handed off.

## Non-Goals

- Migrating to Uniswap V4 PositionManager or Permit2.
- Changing the initialized pool price or PoolKey.
- Redeploying PoolManager, FeeGrowthHook, HakuToken, or the Executor proxy.
- Making public users liquidity providers through this owner-controlled Executor.
- Broadcasting the implementation upgrade or the 25,000 USDC liquidity transaction from automated tests.
