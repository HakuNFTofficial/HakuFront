# HukuNFT HTTPS Metadata and UUPS Upgrade Design

## Objective

Make HukuNFT artwork and metadata render reliably in MetaMask and other wallets while retaining IPFS integrity and a reversible migration path. The migration covers existing and future HukuNFTs and keeps every mint, burn, refund, offline-ID, and HakuToken payment rule unchanged.

The standard wallet-facing metadata URL will use the existing domain:

`https://www.hakupump.club/nft-metadata/v2/{tokenURL}.json`

No new domain is introduced. The change is implemented by upgrading the existing HukuNFT UUPS proxy; neither the HakuToken proxy nor the frontend contract address changes.

## Current Production Baseline

The implementation must re-check these values from Arc Network Testnet immediately before any deployment or owner signature:

| Item | Current value |
| --- | --- |
| HukuNFT UUPS proxy | `0x703CEB677e9fbB1f4c6E917195c3b63B7EFA4Fe8` |
| HukuNFT implementation | `0x73a0c937228837b79c2364f14b660c8a7d8f1472` |
| HukuNFT owner | `0xD693a84A55fd1CbA3e1B5d82571b4Cfe1aF14510` |
| HakuToken proxy (out of scope) | `0x19c02CC2118Afe3CB59bb2f777d1a1124c7A6C12` |
| Existing metadata CID | `QmeqYrSGKCaKzcLGuJT3N12HFH4ws47Lqbs18hSiuGEZGn` |
| Current next token ID at design time | `39` |
| EIP-1967 implementation slot | `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` |

The current implementation UUID matches the EIP-1967 implementation slot. The existing `baseCID` must remain unchanged throughout the migration so the previous IPFS metadata remains an immediate fallback.

NFT #38 is the production reference case. Its offline ID is `1551`, its stored token URL is `740`, and the new URI must resolve to:

`https://www.hakupump.club/nft-metadata/v2/740.json`

The HukuNFT proxy is distinct from the HakuToken proxy. No HakuToken implementation, storage, configuration, or proxy upgrade is authorized by this project.

## Architecture

### 1. Versioned HTTPS metadata origin

The Haku server will publish immutable, versioned static assets from the existing `www.hakupump.club` origin:

- Metadata: `/nft-metadata/v2/{tokenURL}.json`
- Artwork: `/nft-media/v2/{tokenURL}.png`
- Release manifest: `/nft-metadata/v2/manifest.json`

Files are addressed by the numeric `tokenURL` already stored in HukuNFT, not by the on-chain `tokenId`. This preserves the current mapping between minted tokens and source artwork. The server must return the files directly with HTTP 200; redirects, HTML fallbacks, authenticated endpoints, runtime database dependencies, and application-server proxying are not allowed for these paths.

Nginx will serve the assets with:

- `application/json; charset=utf-8` for metadata and the manifest.
- The real image media type, initially `image/png`, for artwork.
- `Access-Control-Allow-Origin: *` for wallet and marketplace fetchers.
- `Cache-Control: public, max-age=31536000, immutable` for versioned files.
- No cookies and no user-specific response variation.

The `v2` directory is immutable after release. Corrections use a new version such as `v3`; deployed version directories are retained for rollback. A release is assembled in a staging directory, validated completely, and then published atomically so crawlers cannot observe a partial set.

A CDN may cache these immutable paths, but the Haku server remains a complete origin and both IPFS providers retain independent copies. The release must remain retrievable even if the CDN cache is purged.

### 2. Metadata schema and IPFS redundancy

Each `{tokenURL}.json` file will be UTF-8 JSON and retain the NFT's existing name and attributes. Placeholder descriptions such as “Remember to replace this description” will be replaced with a stable HakuNFT collection description. The wallet-facing `image` field will be HTTPS:

```json
{
  "name": "Haku #740",
  "description": "HakuNFT collectible from the Haku ecosystem.",
  "image": "https://www.hakupump.club/nft-media/v2/740.png",
  "external_url": "https://www.hakupump.club/",
  "attributes": [],
  "properties": {
    "metadata_version": "v2",
    "image_ipfs": "ipfs://bafybeido5yvptbcf5vgmtth52byp6pdj2q6g3kpy45nppd6nifqoa76qzi"
  }
}
```

The example uses NFT #38's current artwork CIDv1. Existing attributes are copied without semantic changes. The generator must preserve valid JSON types for trait values.

Every artwork file and the complete metadata directory will also be pinned to IPFS using CIDv1 in lower-case base32 form. Two independent pinning providers will retain the content. HTTPS is the compatibility URL used by the ERC-721 `tokenURI` response, while IPFS provides content-addressed integrity and disaster-recovery copies.

The release manifest will be committed to Git and published with the metadata. For every token URL it records:

- Metadata filename, byte size, SHA-256, and CIDv1.
- Artwork filename, media type, byte size, SHA-256, and CIDv1.
- Metadata version and generation timestamp.

The manifest itself records its release version and generator Git commit. Large image binaries need not be committed to Git, but the generator, metadata JSON, manifest, checksums, and reproducible source mapping must be version controlled. Server and IPFS copies remain independently recoverable.

### 3. HukuNFT UUPS implementation change

Only a new HukuNFT implementation will be deployed. The existing proxy address remains the application's permanent HukuNFT address.

The implementation adds one state variable after all current state variables:

```solidity
string public metadataBaseURI;
```

The current `uint256[47] __gap` is reduced to `uint256[46] __gap`. Existing variables must not be reordered, removed, renamed in a way that affects layout, or have their types changed. An automated storage-layout comparison against the exact deployed implementation is mandatory before deployment.

The URI behavior becomes:

- When `metadataBaseURI` is non-empty, `_baseURI()` returns it exactly.
- When it is empty, `_baseURI()` returns the existing `ipfs://{baseCID}/` value.
- `tokenURI(tokenId)` continues using the stored numeric token URL and appending `.json` exactly once.
- A base URI supplied by the owner must end in `/`; invalid non-empty values revert.

The implementation adds:

- `initializeV2(string calldata metadataBaseURI_)`, protected by `reinitializer(2)` and `onlyOwner`, for the atomic proxy upgrade call.
- `setMetadataBaseURI(string calldata metadataBaseURI_)`, protected by `onlyOwner`, for later version changes or fallback. Passing an empty string intentionally restores the legacy IPFS base.
- ERC-4906 `MetadataUpdate` and `BatchMetadataUpdate` events.
- ERC-4906 interface support for interface ID `0x49064906`.

Both successful URI-setting functions emit `BatchMetadataUpdate(1, nextTokenId - 1)` when at least one token exists. The initializer can run only once. Calling it directly on the implementation must fail because implementation initializers are disabled by the constructor.

The production upgrade transaction is an owner-signed call through the HukuNFT proxy:

`upgradeToAndCall(newImplementation, abi.encodeCall(HukuNFT.initializeV2, ("https://www.hakupump.club/nft-metadata/v2/")))`

Deploying the implementation alone does not activate it. No transaction may call business or initialization functions on the implementation address directly. The new implementation's bytecode, `proxiableUUID()`, storage layout, and constructor-disabled initializer behavior must be verified before requesting the owner signature.

### 4. Preserved contract behavior

The upgrade must not change:

- `safeMint` eligibility, payment, token numbering, or emitted business events.
- `burn` authorization or token-specific HakuToken refund behavior.
- `mintUser`, `offlineIdToTokenId`, `tokenIdToOfflineId`, or `tokenRefundAmount` contents.
- `hakuToken`, `mintPrice`, `baseCID`, owner, balances, approvals, or token ownership.
- Existing token IDs or the stored per-token numeric URI values.
- Frontend HukuNFT or HakuToken addresses.

This metadata project does not change the temporary chip-allocation rule. Chip concentration and overflow allocation remain the currently deployed backend behavior and can later be returned to three random NFTs independently.

## Data Generation and Validation

Before publication, the production database mapping of every mintable or minted NFT must be exported read-only. The generator must prove that each distinct `tokenURL` has exactly one source artwork file and one generated metadata file. Duplicate mappings, missing files, unexpected extensions, malformed metadata, or path traversal characters abort the release.

Validation covers every generated asset:

- JSON parses as UTF-8 and includes non-empty `name`, `description`, and HTTPS `image`.
- `attributes` is an array and retains the source traits.
- Every HTTPS image URL corresponds to the same token URL as the metadata filename.
- Every file's size and SHA-256 match the manifest.
- Every recorded CID is CIDv1 lower-case base32 and resolves to bytes matching the manifest.
- Both IPFS pinning providers report the release as pinned.
- Public HTTPS requests return direct 200 responses with the expected content type, CORS header, cache policy, and body bytes.
- All on-chain existing token IDs resolve through `tokenURI` after the upgrade.
- NFT #38 resolves through token URL `740` and its artwork hash matches the manifest.

The generator is deterministic: the release timestamp is an explicit build input, and identical source files, mappings, configuration, and timestamp must produce byte-identical JSON and manifest output.

## Test Strategy

### Contract tests

Foundry tests will deploy the current implementation behind an ERC-1967 proxy, populate representative production-like state, upgrade through the proxy, and assert:

- The proxy implementation slot changes only to the expected new implementation.
- `proxiableUUID()` matches the EIP-1967 implementation slot.
- Owner, `nextTokenId`, `baseCID`, HakuToken, mint price, ownership, mappings, refunds, approvals, balances, and stored token URLs are preserved.
- Existing and newly minted token URIs use the HTTPS base after `initializeV2`.
- An empty metadata base restores the previous IPFS URI behavior.
- `initializeV2` executes exactly once and only through an owner-authorized proxy call.
- `setMetadataBaseURI` is owner-only and rejects malformed non-empty base URIs.
- ERC-4906 interface detection and batch update events are correct.
- Mint, transfer, burn, refund, and duplicate offline-ID tests still pass.
- Upgrading back to the old implementation works on an Arc Network Testnet fork and preserves the old contract's view of state.

The exact OpenZeppelin version and compiler settings used by the repository remain pinned. `forge build`, the complete Foundry test suite, and the storage-layout diff must pass from a clean checkout.

### Server and end-to-end tests

Automated release checks will validate the complete manifest locally and against the public origin. Smoke tests will use representative existing tokens, including #38, and at least one unminted future token URL.

After upgrade, read-only production verification will compare pre- and post-upgrade state snapshots, read the EIP-1967 implementation slot, call `tokenURI(38)`, fetch its JSON and image, and confirm `ownerOf(38)` is unchanged. MetaMask rendering is a manual compatibility check after its cache refresh; it is not a substitute for HTTP, hash, and on-chain verification.

## Git and Release Management

Work is isolated on a branch created from a freshly fetched `origin/main`. The implementation uses granular commits for generator/tests, metadata release, contract/tests, server configuration, deployment tooling, and the final deployment record. No secrets, private keys, seed phrases, server passwords, RPC credentials, or pinning-provider tokens may enter Git, command output captured in Git, or deployment logs.

The maintainer has explicitly chosen direct delivery without pull requests. Before pushing, the branch will fetch and merge the latest `origin/main`, rerun all verification, and then be fast-forwarded into `main` and pushed directly to `origin/main`.

Two annotated, non-moving tags establish rollback points:

- `hukunft-metadata-v1-pre-upgrade-20260802` on the exact verified pre-upgrade commit.
- `hukunft-metadata-v2-deployed-20260802` on the commit containing the real post-deployment record.

If either tag already exists, automation must stop rather than move or overwrite it; a new unique suffix must be chosen and documented.

The final deployment record is committed at:

`deployments/arc-testnet/HukuNFT.json`

It records the chain ID, proxy, previous and new implementation addresses, owner, deployment and upgrade transaction hashes, block numbers, Git commit and tags, implementation bytecode hash, storage-layout hash, compiler settings, metadata version, manifest SHA-256 and CIDv1, public base URI, nginx configuration version, verification results, timestamp, and exact rollback commands. Secret values are never recorded.

## Deployment Sequence

The sequence is deliberately staged so every step before the owner signature is non-disruptive:

1. Fetch `origin/main`, create the isolated worktree/branch, capture the current production state, and verify proxy, implementation, UUID, owner, and chain.
2. Build and test the deterministic metadata release and pin it through both providers.
3. Publish the immutable server `v2` files and nginx configuration atomically; verify all public URLs while the contract still uses IPFS.
4. Complete contract tests, storage-layout comparison, Arc fork upgrade and rollback rehearsal, clean build, sensitive-data scan, and implementation bytecode reproducibility check.
5. Merge the latest `origin/main`, repeat verification, create the pre-upgrade annotated tag, and push the verified main commit and tag.
6. Deploy the new HukuNFT implementation without changing the proxy. Verify its code, bytecode hash, UUID, and disabled initializer.
7. Present the exact decoded proxy, implementation, calldata, chain, and expected base URI for owner review. The owner signs `upgradeToAndCall` through the HukuNFT proxy.
8. Verify the receipt, implementation slot, ERC-4906 log, complete state snapshot, NFT #38 ownership and URI, public metadata, mint/burn invariants, server health, and site health.
9. Write the real deployment record, commit and push it to `main`, create and push the post-deployment tag, and rerun the production smoke checks.

The owner-signature step is never automated with an unreviewed private key. If a connected wallet signature is required, deployment pauses at step 7 with all prior work complete and a human-readable transaction prepared.

## Stop Conditions and Rollback

Deployment stops before the owner signature if any of these occur:

- The live proxy, implementation, UUID, owner, chain, or storage layout differs from the verified baseline.
- Any old or new contract test, fork rehearsal, build, or sensitive-data scan fails.
- Any metadata or image is missing, malformed, mismatched, not pinned twice, or not served directly with the required headers.
- The implementation bytecode does not match the locally verified artifact.
- The owner transaction preview targets anything other than the HukuNFT proxy or contains unexpected calldata.

After the signature, any failed receipt, wrong implementation slot, unexpected state mutation, URI failure, server regression, or site-health failure triggers rollback:

1. Metadata-only rollback: the owner calls `setMetadataBaseURI("")` through the HukuNFT proxy, restoring `ipfs://{baseCID}/{tokenURL}.json`, and the resulting batch metadata event and token URIs are verified.
2. Implementation rollback: if contract behavior is affected, the owner upgrades the same HukuNFT proxy back to the recorded previous implementation with empty call data. State is rechecked against the pre-upgrade snapshot.
3. Server rollback: restore the versioned nginx configuration backup if necessary. Retain both old and new metadata directories, manifests, and IPFS pins for investigation and future recovery.

Rollback never changes the HakuToken proxy. No force-push, moving tag, destructive Git reset, or deletion of the versioned release is part of recovery.

## Acceptance Criteria

- Existing and future HukuNFT `tokenURI` values use `https://www.hakupump.club/nft-metadata/v2/{tokenURL}.json` through the existing HukuNFT proxy.
- Metadata and artwork return stable direct HTTPS 200 responses and render in MetaMask after cache refresh.
- Every release file is integrity-checked, represented in the manifest, and redundantly pinned with CIDv1.
- NFT #38 continues to belong to the same wallet and resolves to token URL `740` with the expected artwork.
- All current contract state and mint/burn/refund behavior are unchanged apart from the metadata base URI and ERC-4906 signaling.
- Only the HukuNFT implementation slot changes; the HukuNFT proxy and HakuToken proxy remain unchanged.
- Storage-layout, Foundry, fork upgrade/rollback, metadata, public HTTP, and post-deployment smoke checks all pass.
- Git contains reproducible release inputs, checksums, deployment evidence, immutable rollback tags, and no secrets.
- The exact verified commit is pushed directly to `main`, deployed, and recorded with enough information to reproduce or roll back the release.
