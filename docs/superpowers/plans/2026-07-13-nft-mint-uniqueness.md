# NFT Mint Uniqueness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a live offline NFT identifier from being minted more than once, while allowing minting again after its existing token has been burned.

**Architecture:** Keep `offlineIdToTokenId` as the on-chain source of truth. `safeMint` rejects an identifier that maps to a live token. The existing burn path deletes both forward and reverse mappings, so the identifier becomes reusable only after the ERC-721 burn is complete.

**Tech Stack:** Solidity 0.8.26, Foundry, OpenZeppelin ERC-721 Upgradeable.

---

### Task 1: Add the regression coverage

**Files:**
- Modify: `test/HukuNFT.t.sol`

- [ ] **Step 1: Write failing tests**

```solidity
function testSafeMintRevertsForLiveOfflineId() public {
    _mockMintPayment();
    vm.prank(minter);
    nft.safeMint(minter, "offline-1422", 1422);

    _mockMintPayment();
    vm.expectRevert("Offline ID already used");
    vm.prank(minter);
    nft.safeMint(minter, "offline-1422", 1422);
}
```

- [ ] **Step 2: Run the focused test and verify it fails because the second mint succeeds.**

- [ ] **Step 3: Add a second test that burns the first token and successfully mints the same identifier again.**

- [ ] **Step 4: Run the focused test suite and verify both tests pass after the implementation.**

### Task 2: Enforce identifier uniqueness in the contract

**Files:**
- Modify: `src/HukuNFT.sol:179-181`

- [ ] **Step 1: Restore the live-token guard.**

```solidity
require(
    offlineIdToTokenId[remark] == 0,
    "Offline ID already used"
);
```

- [ ] **Step 2: Run the focused and full NFT test suites.**

- [ ] **Step 3: Compile the implementation artifact used for the UUPS upgrade.**

### Task 3: Deploy safely and reconcile state

**Files:**
- Modify: deployed UUPS NFT implementation via existing deployment script
- Verify: `/home/web-match` event worker and database state

- [ ] **Step 1: Backup the current implementation address, proxy configuration, and database before deployment.**
- [ ] **Step 2: Deploy the tested implementation, upgrade the existing proxy, and verify the implementation slot changed.**
- [ ] **Step 3: Run a dry-run query for database rows whose `token_id` is not owned by the recorded user; update only rows proven burned.**
- [ ] **Step 4: Confirm the service remains healthy and mint/burn event processing resumes.**
