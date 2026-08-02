# HukuNFT HTTPS Metadata and UUPS Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish versioned HTTPS metadata for all 500 HukuNFT assets and upgrade the existing HukuNFT UUPS proxy so existing and future tokens use it without changing mint, burn, refund, chip-allocation, or HakuToken behavior.

**Architecture:** Restore the repository's pinned Foundry toolchain, generate deterministic v2 JSON and integrity manifests from the current IPFS assets plus a read-only production mapping, and serve immutable files directly from nginx. Add one URI state variable and ERC-4906 signaling to the current HukuNFT implementation, validate storage compatibility, deploy a new implementation, and activate it only through the existing proxy with an owner-authorized `upgradeToAndCall` transaction.

**Tech Stack:** Solidity 0.8.26, Foundry, OpenZeppelin 5.5 UUPS/ERC-721, Node.js 24 built-ins, viem 2, Kubo 0.39, Pinata Pinning Service API, nginx, PostgreSQL, Arc Network Testnet.

---

## File Map

- `.gitmodules` and `foundry.lock`: pin the five Foundry dependency repositories recovered from `origin/arc-testnet-demo`.
- `src/PoolConfig.sol`: restore the Arc Testnet constants whose current tracked file is invalid placeholder text.
- `src/HukuNFT.sol`: add the HTTPS metadata base, v2 initializer, setter, and ERC-4906 signaling while preserving storage order.
- `test/fixtures/HukuNFTV1StorageFixture.sol`: model the deployed implementation's exact application storage order for upgrade-state tests.
- `test/HukuNFTMetadataUpgrade.t.sol`: prove upgrade authorization, storage preservation, URI behavior, ERC-4906 behavior, and rollback.
- `scripts/nft-metadata/release-lib.mjs`: deterministic metadata transformation, hashing, path validation, and manifest construction.
- `scripts/nft-metadata/generate-v2.mjs`: production CLI for generating the v2 release.
- `scripts/nft-metadata/validate-v2.mjs`: local/public release validator.
- `scripts/nft-metadata/release-lib.test.mjs`: Node unit tests for the generator and validator.
- `scripts/contracts/hukunft-metadata-v2-lib.mjs`: constants, state snapshot helpers, upgrade calldata construction, and receipt checks.
- `scripts/contracts/deploy-hukunft-metadata-v2.mjs`: deploy-only and explicitly confirmed upgrade modes using an injected private key.
- `scripts/contracts/verify-hukunft-metadata-v2.mjs`: read-only pre/post-upgrade chain verification.
- `scripts/contracts/hukunft-metadata-v2-lib.test.mjs`: calldata and invariant unit tests.
- `scripts/contracts/check-hukunft-storage-layout.mjs`: compare the committed v1 layout with the v2 layout.
- `deployments/arc-testnet/HukuNFT-v1-storage-layout.json`: immutable baseline layout captured before editing the contract.
- `deployments/arc-testnet/HukuNFT.json`: final machine-readable deployment and rollback record.
- `nft-metadata/v2/source-map.json`: sanitized, sorted production mapping with no wallet addresses or credentials.
- `nft-metadata/v2/json/*.json`: generated token metadata committed for reproducibility.
- `nft-metadata/v2/manifest.json`: hashes, CIDv1 values, sizes, mappings, release time, and generator commit.
- `deploy/nginx/hakupump-nft-metadata.conf`: reviewed nginx locations copied into the production virtual host.

## Verified Inputs

- HukuNFT proxy: `0x703CEB677e9fbB1f4c6E917195c3b63B7EFA4Fe8`.
- Current implementation: `0x73a0c937228837b79c2364f14b660c8a7d8f1472`.
- Owner: `0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510`.
- HakuToken proxy, which must not change: `0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12`.
- Current image root: `QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb`, 500 PNG files.
- Current metadata root: `QmeqYrSGKCaKzcLGuJT3N12HFH4ws47Lqbs18hSiuGEZGn`, 501 JSON entries including the aggregate file.
- Production database: 500 NFTs, IDs 1261–1760, 500 unique PNG filenames, 5 minted tokens.
- Reference: database ID 1551 → `740.png` → token ID 38 → token URL `740`.

### Task 1: Restore the reproducible Foundry baseline

**Files:**
- Restore: `.gitmodules`
- Restore: `foundry.lock`
- Restore: `src/PoolConfig.sol`
- Restore gitlinks: `lib/forge-std`, `lib/openzeppelin-contracts`, `lib/openzeppelin-contracts-upgradeable`, `lib/v4-core`, `lib/v4-periphery`

- [ ] **Step 1: Restore the exact Arc dependency declarations and configuration**

Run:

```bash
git checkout origin/arc-testnet-demo -- .gitmodules foundry.lock src/PoolConfig.sol lib/forge-std lib/openzeppelin-contracts lib/openzeppelin-contracts-upgradeable lib/v4-core lib/v4-periphery
```

Expected `PoolConfig.TOKEN_B`: `0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12`.

- [ ] **Step 2: Initialize every pinned dependency recursively**

Run:

```bash
git submodule update --init --recursive
git submodule status --recursive
```

Expected top-level commits:

```text
forge-std                              8e40513d678f392f398620b3ef2b418648b33e89
openzeppelin-contracts                6308fdc5e8e0d5e8a94dc9d5d4c79f6331334c81
openzeppelin-contracts-upgradeable    aa677e9d28ed78fc427ec47ba2baef2030c58e7c
v4-core                               e50237c43811bd9b526eff40f26772152a42daba
v4-periphery                          3779387e5d296f39df543d23524b050f89a62917
```

- [ ] **Step 3: Capture the pre-change storage layout**

Add `scripts/contracts/capture-hukunft-storage-layout.mjs`:

```js
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'

const output = execFileSync('forge', ['inspect', 'HukuNFT', 'storageLayout', '--json'], {
  encoding: 'utf8',
})
JSON.parse(output)
mkdirSync('deployments/arc-testnet', { recursive: true })
writeFileSync('deployments/arc-testnet/HukuNFT-v1-storage-layout.json', `${output.trim()}\n`)
```

Run:

```bash
node scripts/contracts/capture-hukunft-storage-layout.mjs
forge test
```

Expected: Foundry compiles and all existing tests pass. If compilation fails, stop and repair only version/remapping mismatches before changing HukuNFT.

- [ ] **Step 4: Commit the restored baseline**

```bash
git add .gitmodules foundry.lock src/PoolConfig.sol lib deployments/arc-testnet/HukuNFT-v1-storage-layout.json scripts/contracts/capture-hukunft-storage-layout.mjs
git commit -m "build: restore pinned Foundry dependencies"
```

### Task 2: Test deterministic metadata release behavior

**Files:**
- Create: `scripts/nft-metadata/release-lib.test.mjs`
- Create: `scripts/nft-metadata/release-lib.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing generator tests**

Create tests that call the pure release functions with a temporary `740.png`, source `740.json`, and the production-shaped source map:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildMetadata, buildRelease, tokenUrlFromFileName } from './release-lib.mjs'

const CID = 'bafybeido5yvptbcf5vgmtth52byp6pdj2q6g3kpy45nppd6nifqoa76qzi'

test('token URL is the numeric PNG stem', () => {
  assert.equal(tokenUrlFromFileName('740.png'), '740')
  assert.throws(() => tokenUrlFromFileName('../740.png'), /numeric PNG/)
  assert.throws(() => tokenUrlFromFileName('740.jpg'), /numeric PNG/)
})

test('metadata keeps traits and replaces wallet-facing fields', () => {
  const output = buildMetadata({
    source: { name: 'Haku #740', description: 'old', attributes: [{ trait_type: 'eyes', value: 'Angry' }], edition: 740 },
    tokenUrl: '740',
    imageCidV1: CID,
  })
  assert.equal(output.description, 'HakuNFT collectible from the Haku ecosystem.')
  assert.equal(output.image, 'https://www.hakupump.club/nft-media/v2/740.png')
  assert.equal(output.properties.image_ipfs, `ipfs://${CID}`)
  assert.deepEqual(output.attributes, [{ trait_type: 'eyes', value: 'Angry' }])
})

test('release output is byte-identical for identical explicit inputs', async () => {
  const root = mkdtempSync(join(tmpdir(), 'haku-metadata-'))
  const sourceJson = join(root, 'source-json')
  const sourceImages = join(root, 'source-images')
  const outA = join(root, 'out-a')
  const outB = join(root, 'out-b')
  mkdirSync(sourceJson)
  mkdirSync(sourceImages)
  writeFileSync(join(sourceImages, '740.png'), Buffer.from('png-fixture'))
  writeFileSync(join(sourceJson, '740.json'), JSON.stringify({ name: 'Haku #740', attributes: [] }))
  const options = {
    sourceMap: [{ nftId: 1551, fileName: '740.png', tokenId: '38', tokenUrl: '740', isMint: 2 }],
    sourceJsonDir: sourceJson,
    sourceImageDir: sourceImages,
    generatedAt: '2026-08-02T16:00:00.000Z',
    gitCommit: '163707d',
    cidForFile: async () => CID,
  }
  await buildRelease({ ...options, outputDir: outA })
  await buildRelease({ ...options, outputDir: outB })
  assert.deepEqual(readFileSync(join(outA, 'json', '740.json')), readFileSync(join(outB, 'json', '740.json')))
  assert.deepEqual(readFileSync(join(outA, 'manifest.json')), readFileSync(join(outB, 'manifest.json')))
})
```

- [ ] **Step 2: Run the tests and verify the red state**

Run:

```bash
node --test scripts/nft-metadata/release-lib.test.mjs
```

Expected: FAIL because `release-lib.mjs` and its exports do not exist.

- [ ] **Step 3: Implement the pure generator library**

Implement these exact public functions in `release-lib.mjs`:

```js
export function tokenUrlFromFileName(fileName)
export function sha256(bytes)
export function buildMetadata({ source, tokenUrl, imageCidV1 })
export async function buildRelease({ sourceMap, sourceJsonDir, sourceImageDir, outputDir, generatedAt, gitCommit, cidForFile })
export function validateRelease({ releaseDir, sourceMap })
```

`buildRelease` must sort by numeric token URL, reject duplicate NFT IDs/files/token URLs, reject missing source files, assert a minted row's database `tokenUrl` equals its filename stem, preserve the source `name`, `attributes`, `edition`, `dna`, `date`, and `compiler`, and replace only these fields:

```js
{
  description: 'HakuNFT collectible from the Haku ecosystem.',
  image: `https://www.hakupump.club/nft-media/v2/${tokenUrl}.png`,
  external_url: 'https://www.hakupump.club/',
  properties: {
    ...(source.properties ?? {}),
    metadata_version: 'v2',
    image_ipfs: `ipfs://${imageCidV1}`,
  },
}
```

The manifest schema is:

```js
{
  schemaVersion: 1,
  release: 'v2',
  generatedAt,
  generatorGitCommit: gitCommit,
  metadataBaseUrl: 'https://www.hakupump.club/nft-metadata/v2/',
  mediaBaseUrl: 'https://www.hakupump.club/nft-media/v2/',
  entries: [{
    nftId,
    tokenId,
    tokenUrl,
    sourceFileName: fileName,
    metadata: { fileName: `${tokenUrl}.json`, byteSize, sha256, cidv1 },
    image: { fileName, mediaType: 'image/png', byteSize, sha256, cidv1 },
  }],
}
```

- [ ] **Step 4: Add and run the metadata test command**

Add to root `package.json`:

```json
"scripts": {
  "test": "echo \"Error: no test specified\" && exit 1",
  "metadata:test": "node --test scripts/nft-metadata/*.test.mjs",
  "metadata:generate": "node scripts/nft-metadata/generate-v2.mjs",
  "metadata:validate": "node scripts/nft-metadata/validate-v2.mjs"
}
```

Run:

```bash
npm run metadata:test
```

Expected: all metadata unit tests pass.

- [ ] **Step 5: Commit generator tests and library**

```bash
git add package.json scripts/nft-metadata/release-lib.mjs scripts/nft-metadata/release-lib.test.mjs
git commit -m "test: define deterministic NFT metadata release"
```

### Task 3: Add production metadata CLI and validators

**Files:**
- Create: `scripts/nft-metadata/generate-v2.mjs`
- Create: `scripts/nft-metadata/validate-v2.mjs`

- [ ] **Step 1: Implement the generation CLI**

`generate-v2.mjs` must require these named arguments and reject missing values:

```text
--source-map
--source-json
--source-images
--output
--generated-at
--git-commit
```

Its CID resolver must execute Kubo without a shell:

```js
import { execFileSync } from 'node:child_process'

function cidForFile(filePath) {
  return execFileSync('ipfs', ['add', '--only-hash', '--cid-version=1', '--quiet', filePath], {
    encoding: 'utf8',
  }).trim()
}
```

`buildRelease` writes token JSON under the configured output directory's `json/` child and writes `manifest.json` at that output directory's root. After generation, call `validateRelease` and print only release counts, paths, and CIDs—never environment variables or source database URLs.

- [ ] **Step 2: Implement local and public validation modes**

`validate-v2.mjs` accepts `--release`, `--source-map`, and optional `--public-origin`. Local mode calls `validateRelease`. Public mode additionally fetches every metadata and image URL with redirect handling disabled and asserts:

```js
response.status === 200
response.headers.get('access-control-allow-origin') === '*'
response.headers.get('cache-control').includes('immutable')
metadata content-type starts with 'application/json'
image content-type === 'image/png'
downloaded SHA-256 equals manifest SHA-256
```

- [ ] **Step 3: Run all metadata tests**

```bash
npm run metadata:test
```

Expected: PASS.

- [ ] **Step 4: Commit the production CLI**

```bash
git add scripts/nft-metadata/generate-v2.mjs scripts/nft-metadata/validate-v2.mjs
git commit -m "feat: generate and validate HTTPS NFT metadata"
```

### Task 4: Write failing HukuNFT upgrade tests

**Files:**
- Create: `test/fixtures/HukuNFTV1StorageFixture.sol`
- Create: `test/HukuNFTMetadataUpgrade.t.sol`

- [ ] **Step 1: Create a v1 storage fixture**

The fixture must use the same inheritance order and declare the exact current application storage sequence:

```solidity
uint256 public nextTokenId;
mapping(uint256 => address) public mintUser;
mapping(string => uint256) public offlineIdToTokenId;
mapping(uint256 => string) public tokenIdToOfflineId;
string public baseCID;
IERC20 public hakuToken;
uint256 public mintPrice;
mapping(uint256 => uint256) public tokenRefundAmount;
uint256[47] private __gap;
```

It implements the existing initializer, `_authorizeUpgrade`, `_baseURI`, `tokenURI`, `supportsInterface`, and an owner-only `seedToken` helper that mints a token, stores the numeric token URI, and fills every application mapping/refund field. Its constructor calls `_disableInitializers()`.

- [ ] **Step 2: Write upgrade tests against the proxy**

Cover these exact assertions in `HukuNFTMetadataUpgrade.t.sol`:

```solidity
assertEq(nft.owner(), address(this));
assertEq(nft.nextTokenId(), 39);
assertEq(nft.baseCID(), "QmeqYrSGKCaKzcLGuJT3N12HFH4ws47Lqbs18hSiuGEZGn");
assertEq(nft.ownerOf(38), user);
assertEq(nft.mintUser(38), user);
assertEq(nft.offlineIdToTokenId("1551"), 38);
assertEq(nft.tokenIdToOfflineId(38), "1551");
assertEq(nft.tokenRefundAmount(38), 10_000 ether);
assertEq(nft.tokenURI(38), "https://www.hakupump.club/nft-metadata/v2/740.json");
assertTrue(nft.supportsInterface(0x49064906));
```

Also test:

- Non-owner `upgradeToAndCall` reverts.
- `initializeV2` emits `BatchMetadataUpdate(1, 38)` and cannot run twice.
- Calling `initializeV2` on the implementation address reverts.
- A non-empty URI without a trailing slash reverts.
- `setMetadataBaseURI("")` restores `ipfs://{baseCID}/740.json`.
- Upgrading the proxy back to the v1 fixture succeeds and preserves the v1-visible state.

- [ ] **Step 3: Run the upgrade tests and verify the red state**

```bash
forge test --match-contract HukuNFTMetadataUpgradeTest -vvv
```

Expected: compilation fails because `initializeV2`, `metadataBaseURI`, ERC-4906 support, and `setMetadataBaseURI` are not implemented.

- [ ] **Step 4: Commit the failing tests**

```bash
git add test/fixtures/HukuNFTV1StorageFixture.sol test/HukuNFTMetadataUpgrade.t.sol
git commit -m "test: specify HukuNFT metadata UUPS upgrade"
```

### Task 5: Implement the HukuNFT v2 metadata upgrade

**Files:**
- Modify: `src/HukuNFT.sol`
- Create: `scripts/contracts/check-hukunft-storage-layout.mjs`

- [ ] **Step 1: Add the metadata events and state**

Add:

```solidity
event MetadataUpdate(uint256 _tokenId);
event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
event MetadataBaseURIUpdated(string metadataBaseURI);

error InvalidMetadataBaseURI();

string public metadataBaseURI;
uint256[46] private __gap;
```

Replace the old `uint256[47]` declaration; do not add the new string after the gap.

- [ ] **Step 2: Add initializer, setter, and URI fallback**

Implement:

```solidity
function initializeV2(string calldata metadataBaseURI_)
    external
    reinitializer(2)
    onlyOwner
{
    _setMetadataBaseURI(metadataBaseURI_);
}

function setMetadataBaseURI(string calldata metadataBaseURI_)
    external
    onlyOwner
{
    _setMetadataBaseURI(metadataBaseURI_);
}

function _setMetadataBaseURI(string calldata metadataBaseURI_) internal {
    bytes memory value = bytes(metadataBaseURI_);
    if (value.length > 0 && value[value.length - 1] != bytes1('/')) {
        revert InvalidMetadataBaseURI();
    }
    metadataBaseURI = metadataBaseURI_;
    emit MetadataBaseURIUpdated(metadataBaseURI_);
    if (nextTokenId > 1) {
        emit BatchMetadataUpdate(1, nextTokenId - 1);
    }
}

function _baseURI() internal view override returns (string memory) {
    if (bytes(metadataBaseURI).length > 0) return metadataBaseURI;
    return string(abi.encodePacked("ipfs://", baseCID, "/"));
}
```

Extend `supportsInterface`:

```solidity
return interfaceId == 0x49064906 || super.supportsInterface(interfaceId);
```

- [ ] **Step 3: Run focused and full Foundry tests**

```bash
forge test --match-contract HukuNFTMetadataUpgradeTest -vvv
forge test
forge build
```

Expected: all tests pass.

- [ ] **Step 4: Add the storage-layout guard**

`check-hukunft-storage-layout.mjs` loads the committed v1 JSON and current `forge inspect HukuNFT storageLayout --json`. It must assert all existing entries have identical labels, slots, offsets, and types; the old gap length is 47; `metadataBaseURI` occupies the first consumed gap slot; and the new gap length is 46. It exits non-zero on any mismatch.

Run:

```bash
node scripts/contracts/check-hukunft-storage-layout.mjs
```

Expected: `HukuNFT storage layout compatible: metadataBaseURI consumes one reserved slot`.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/HukuNFT.sol scripts/contracts/check-hukunft-storage-layout.mjs
git commit -m "feat: add HTTPS metadata URI to HukuNFT"
```

### Task 6: Add safe deployment and verification tooling

**Files:**
- Create: `scripts/contracts/hukunft-metadata-v2-lib.mjs`
- Create: `scripts/contracts/hukunft-metadata-v2-lib.test.mjs`
- Create: `scripts/contracts/deploy-hukunft-metadata-v2.mjs`
- Create: `scripts/contracts/verify-hukunft-metadata-v2.mjs`

- [ ] **Step 1: Write failing calldata and invariant tests**

Tests must assert these constants and decoded values:

```js
export const HUKUNFT_PROXY = '0x703CEB677e9fbB1f4c6E917195c3b63B7EFA4Fe8'
export const EXPECTED_OLD_IMPLEMENTATION = '0x73a0c937228837b79c2364f14b660c8a7d8f1472'
export const EXPECTED_OWNER = '0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510'
export const HAKUTOKEN_PROXY = '0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12'
export const METADATA_BASE_URI = 'https://www.hakupump.club/nft-metadata/v2/'
export const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
```

`buildUpgradeCalldata(newImplementation)` must encode `upgradeToAndCall(newImplementation, encodeFunctionData(initializeV2(METADATA_BASE_URI)))`; decoding must recover the same implementation and URI.

- [ ] **Step 2: Run tests and verify failure**

```bash
node --test scripts/contracts/hukunft-metadata-v2-lib.test.mjs
```

Expected: FAIL because the library is absent.

- [ ] **Step 3: Implement deploy-only and upgrade modes**

The script reads `ARC_RPC_URL` and `PRIVATE_KEY` from the environment. It derives the account but never prints the key. Supported commands:

```text
node scripts/contracts/deploy-hukunft-metadata-v2.mjs snapshot
node scripts/contracts/deploy-hukunft-metadata-v2.mjs deploy
node scripts/contracts/deploy-hukunft-metadata-v2.mjs prepare-upgrade NEW_IMPLEMENTATION
node scripts/contracts/deploy-hukunft-metadata-v2.mjs upgrade NEW_IMPLEMENTATION
```

`upgrade` must refuse to send unless all are present and exact:

```text
CONFIRM_HUKUNFT_PROXY=0x703CEB677e9fbB1f4c6E917195c3b63B7EFA4Fe8
CONFIRM_NEW_IMPLEMENTATION=$NEW_IMPLEMENTATION
CONFIRM_CALLDATA_SHA256=$CALLDATA_SHA256
```

Before sending, it re-reads chain ID, owner, current implementation slot, `baseCID`, `nextTokenId`, token #38 owner/URI, HakuToken address, and owner account. Any mismatch aborts. `deploy` may deploy bytecode but may not call the proxy.

- [ ] **Step 4: Implement read-only verification**

`verify-hukunft-metadata-v2.mjs` writes a JSON snapshot containing only public chain state. It verifies proxy code, implementation slot, UUID, owner, `baseCID`, `metadataBaseURI`, HakuToken, mint price, `nextTokenId`, and token #38 owner/URI.

- [ ] **Step 5: Run tooling tests and commit**

```bash
node --test scripts/contracts/hukunft-metadata-v2-lib.test.mjs
git add scripts/contracts
git commit -m "feat: add guarded HukuNFT upgrade tooling"
```

### Task 7: Generate and commit the v2 release

**Files:**
- Create: `nft-metadata/v2/source-map.json`
- Create: `nft-metadata/v2/json/*.json`
- Create: `nft-metadata/v2/manifest.json`

- [ ] **Step 1: Export a sanitized production source map**

On the server, query only:

```sql
SELECT id, file_name, token_id, token_url, is_mint
FROM nfts
ORDER BY id;
```

Convert the result to sorted JSON objects with keys `nftId`, `fileName`, `tokenId`, `tokenUrl`, and `isMint`. Do not export `user_address`, the database URL, or other tables. Assert 500 rows, 500 unique numeric PNG filenames, IDs 1261–1760, and reference row 1551/740.png/38/740/2.

- [ ] **Step 2: Materialize immutable source assets from local Kubo**

Use the server staging directory `/var/tmp/hukunft-metadata-v2-20260802` and run:

```bash
ipfs get QmWEBUGXYwUcbcMtJkyixobY8ajoDrGtdqK25eEF3GaUfb -o /var/tmp/hukunft-metadata-v2-20260802/source-images
ipfs get QmeqYrSGKCaKzcLGuJT3N12HFH4ws47Lqbs18hSiuGEZGn -o /var/tmp/hukunft-metadata-v2-20260802/source-json
```

Copy both source directories into the local `/private/tmp/hukunft-metadata-v2-20260802/` staging directory. Expected: 500 PNGs and 500 numeric JSON files plus `_metadata.json`.

- [ ] **Step 3: Generate and validate v2 in the isolated worktree**

Initialize a disposable local Kubo repository for CID-only calculations, then run the worktree scripts locally with an explicit timestamp and Git commit:

```bash
IPFS_PATH=/private/tmp/hukunft-metadata-v2-20260802/ipfs-repo ipfs init --profile=server
METADATA_GIT_COMMIT=$(git rev-parse HEAD)
IPFS_PATH=/private/tmp/hukunft-metadata-v2-20260802/ipfs-repo node scripts/nft-metadata/generate-v2.mjs --source-map nft-metadata/v2/source-map.json --source-json /private/tmp/hukunft-metadata-v2-20260802/source-json --source-images /private/tmp/hukunft-metadata-v2-20260802/source-images --output nft-metadata/v2 --generated-at 2026-08-02T16:00:00.000Z --git-commit "$METADATA_GIT_COMMIT"
IPFS_PATH=/private/tmp/hukunft-metadata-v2-20260802/ipfs-repo node scripts/nft-metadata/validate-v2.mjs --release nft-metadata/v2 --source-map nft-metadata/v2/source-map.json
```

Expected: 500 valid metadata entries; reference 740 hashes and CIDv1 resolve.

- [ ] **Step 4: Commit reproducible metadata**

```bash
git add nft-metadata/v2
git commit -m "data: add HukuNFT v2 metadata release"
```

### Task 8: Publish HTTPS files and redundant IPFS pins

**Files:**
- Create: `deploy/nginx/hakupump-nft-metadata.conf`

- [ ] **Step 1: Add reviewed nginx locations**

```nginx
location ^~ /nft-metadata/v2/ {
    root /usr/local/www;
    try_files $uri =404;
    default_type application/json;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

location ^~ /nft-media/v2/ {
    root /usr/local/www;
    try_files $uri =404;
    default_type application/octet-stream;
    add_header Access-Control-Allow-Origin "*" always;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}
```

- [ ] **Step 2: Publish versioned files atomically**

Copy validated JSON to `/usr/local/www/nft-metadata/v2/` and the 500 source PNGs to `/usr/local/www/nft-media/v2/` through staging directories on the same filesystem. Validate `nginx -t`, back up the active vhost with a timestamped filename, install the reviewed locations, reload nginx, and keep every prior version directory.

- [ ] **Step 3: Pin locally and through Pinata**

Add both directories to the server Kubo node using CIDv1 and recursive local pins. Configure Pinata's standard Pinning Service API only from an injected `PINATA_JWT`:

```bash
ipfs pin remote service add pinata https://api.pinata.cloud/psa "$PINATA_JWT"
ipfs pin remote add --service=pinata --name=hukunft-metadata-v2 "$METADATA_CID_V1"
ipfs pin remote add --service=pinata --name=hukunft-media-v2 "$MEDIA_CID_V1"
ipfs pin remote ls --service=pinata --status=pinned
```

Never echo or commit `PINATA_JWT`. If it is absent or either remote status is not `pinned`, do not upgrade the contract.

- [ ] **Step 4: Validate the public origin**

```bash
node scripts/nft-metadata/validate-v2.mjs --release nft-metadata/v2 --source-map nft-metadata/v2/source-map.json --public-origin https://www.hakupump.club
```

Expected: all 1,000 public file requests return direct 200 responses, correct content types/CORS/cache headers, and manifest-matching hashes.

- [ ] **Step 5: Commit nginx configuration**

```bash
git add deploy/nginx/hakupump-nft-metadata.conf
git commit -m "ops: serve immutable NFT metadata and media"
```

### Task 9: Final pre-upgrade verification and direct main delivery

**Files:**
- Modify only files already listed

- [ ] **Step 1: Run the complete verification suite**

```bash
forge test
forge build
node scripts/contracts/check-hukunft-storage-layout.mjs
npm run metadata:test
npm run metadata:validate -- --release nft-metadata/v2 --source-map nft-metadata/v2/source-map.json
npm --prefix frontend test -- --run
npm --prefix frontend run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Scan tracked changes for secrets**

Search staged/tracked content for private keys, seed phrases, server passwords, database URLs, bearer tokens, Pinata JWTs, NFT.Storage tokens, and RPC credentials. Expected: no secret values; documentation may contain variable names only.

- [ ] **Step 3: Synchronize with main and rerun verification**

```bash
git fetch origin
git merge --no-edit origin/main
```

Repeat Step 1 after resolving any conflicts.

- [ ] **Step 4: Create the immutable pre-upgrade tag and push main**

Confirm `hukunft-metadata-v1-pre-upgrade-20260802` does not exist. Fast-forward local `main` to the verified branch, push `main`, create the annotated tag on the exact verified commit, and push the tag. Do not create a PR and never move an existing tag.

### Task 10: Deploy the implementation and prepare the owner transaction

**Files:**
- Create locally generated public snapshots under `deployments/arc-testnet/`

- [ ] **Step 1: Capture a pre-upgrade chain snapshot**

Run the read-only verification script against Arc Network Testnet. Confirm the proxy, implementation, owner, UUID, HakuToken, base CID, `nextTokenId`, token #38 owner, and old IPFS URI match the verified baseline.

- [ ] **Step 2: Deploy only the new implementation**

Use the server's existing `PRIVATE_KEY` environment without printing it. Confirm its derived address is exactly `0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510`. Deploy HukuNFT bytecode, wait for a successful receipt, and verify the deployed runtime bytecode hash matches the local artifact.

- [ ] **Step 3: Verify implementation safety**

Call `proxiableUUID()` on the implementation and require the EIP-1967 slot. Verify implementation `initializeV2` reverts, proxy storage is unchanged, and the proxy still points to `0x73a0c937228837b79c2364f14b660c8a7d8f1472`.

- [ ] **Step 4: Prepare the exact owner transaction**

Run `prepare-upgrade NEW_IMPLEMENTATION`. Record and present:

- Chain ID and latest block.
- Proxy and current/new implementations.
- Decoded `upgradeToAndCall` inner `initializeV2` URI.
- Full calldata SHA-256.
- Estimated gas and owner balance.
- Pre-upgrade public snapshot hash.

This is the human review checkpoint before any proxy-changing transaction.

### Task 11: Execute and verify the UUPS upgrade

**Files:**
- Create: `deployments/arc-testnet/HukuNFT.json`

- [ ] **Step 1: Send the explicitly confirmed proxy transaction**

After the transaction details from Task 10 are approved, supply all three confirmation environment variables and run `upgrade NEW_IMPLEMENTATION`. The only authorized state-changing target is the HukuNFT proxy.

- [ ] **Step 2: Verify receipt and chain state**

Require receipt status 1 and verify:

```text
implementation slot = NEW_IMPLEMENTATION
metadataBaseURI = https://www.hakupump.club/nft-metadata/v2/
tokenURI(38) = https://www.hakupump.club/nft-metadata/v2/740.json
ownerOf(38) unchanged
nextTokenId unchanged
baseCID unchanged
hakuToken unchanged
mintPrice unchanged
BatchMetadataUpdate(1, nextTokenId - 1) emitted
```

Fetch 740 JSON/image and rerun the public validator. Run read-only mint/burn invariant calls and site/API health checks without creating an extra NFT.

- [ ] **Step 3: Roll back on any mismatch**

First call `setMetadataBaseURI("")` through the proxy if the problem is content/URI-only. If contract state or behavior is wrong, call `upgradeToAndCall(0x73a0c937228837b79c2364f14b660c8a7d8f1472, 0x)` through the same proxy. Re-run the pre-upgrade snapshot comparison. Never touch the HakuToken proxy.

- [ ] **Step 4: Write the final deployment record**

Populate `deployments/arc-testnet/HukuNFT.json` with real chain ID, proxy, old/new implementations, owner, deploy/upgrade transaction hashes and blocks, bytecode hash, storage-layout hash, compiler settings, metadata and media CIDv1 roots, manifest SHA-256, nginx backup/config hash, Git commit/tags, verification outputs, timestamp, and exact rollback calldata. Include no secrets.

- [ ] **Step 5: Commit, push, and tag the deployed release**

```bash
git add deployments/arc-testnet/HukuNFT.json
git commit -m "docs: record HukuNFT metadata v2 deployment"
git push origin main
git tag -a hukunft-metadata-v2-deployed-20260802 -m "HukuNFT metadata v2 deployed"
git push origin hukunft-metadata-v2-deployed-20260802
```

Confirm remote `main` and the post-deployment tag point to the expected commits, then rerun the chain, HTTPS, site, and API smoke checks.

## Execution Checkpoints

1. Stop if the restored Foundry baseline does not pass before HukuNFT changes.
2. Stop if any storage-layout field changes outside the one consumed gap slot.
3. Stop if all 500 mappings/assets do not validate or either IPFS pin is not confirmed.
4. Stop if nginx public validation does not pass for all 1,000 files.
5. Stop if live proxy/implementation/owner/UUID differs from the baseline.
6. Stop after implementation deployment until the exact proxy transaction preview is reviewed.
7. Roll back immediately if any post-upgrade state or content invariant differs.
