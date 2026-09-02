# NFT Image Resolution Hotfix Design

## Problem

Minted NFT #40 uses database `token_url=2828`. The production banner API returns an
absolute `nftstorage.link` image URL, so the frontend preserves an unreliable legacy
gateway instead of using its configured Pinata gateway. On chain, HukuNFT still returns
`ipfs://QmeqYr.../2828.json`, while the current metadata exists under
`Qmeub98.../2828.json`. The old metadata path and the current HTTPS v2 path do not contain
`2828.json`.

## Goal

Restore newly minted NFT artwork in the site and wallets without deriving token metadata
from unrelated fields or switching the proxy to an incomplete HTTPS metadata release.

## Considered Approaches

1. **Frontend-only rewrite.** Rewrite legacy gateway URLs in the browser. This restores
   the banner quickly, but leaves the API serving unreliable URLs to other consumers.
2. **Backend-only configuration change.** Change the production gateway to Pinata. This
   fixes the current API but leaves clients vulnerable to stale absolute IPFS gateway URLs.
3. **Defense in depth plus the on-chain CID switch (selected).** Canonicalize IPFS URLs in
   the frontend, prevent the backend from emitting the known legacy gateway, update the
   production environment, and change HukuNFT `baseCID` only after validating every live
   token URL against the new metadata CID.

## Design

### Frontend

`convertIPFSToHttp` becomes the single canonicalizer for wallet-style `ipfs://` URIs and
HTTP gateway URLs containing `/ipfs/`. It preserves non-IPFS HTTP URLs. `Banner` calls it
for every backend `image_url`, so an absolute `nftstorage.link` URL is rewritten to the
configured Pinata origin while retaining the exact CID and path.

### Backend

The default IPFS gateway becomes `https://gateway.pinata.cloud/ipfs/`. A pure gateway
selection helper replaces the exact legacy `nftstorage.link` gateway with the Pinata
default, preserves explicitly configured non-legacy gateways, and keeps the existing
trailing-slash normalization. Runtime logs an actionable warning when it replaces the
legacy value. No NFT ID, token URL, image CID, or metadata field is guessed.

### Chain and Production

Before calling `setBaseCID`, enumerate all non-burned token IDs below `nextTokenId`, extract
their stored token URL from the current `tokenURI`, and require the matching JSON and image
to return successfully from the new CID. Then the owner may call
`setBaseCID("Qmeub98s5ZPPANZVksF8Vs6CbPT3Xe5PEmkFEhgMP9ovzK")`. Do not upgrade to the existing
HTTPS v2 base because `/nft-metadata/v2/2828.json` currently returns 404.

### Verification

- Frontend unit tests prove `ipfs://` and legacy HTTP gateway inputs resolve through Pinata,
  while unrelated HTTPS images remain unchanged.
- Backend unit tests prove missing/legacy gateway values use Pinata and custom gateways are
  preserved.
- Production verification requires the banner API image URL and its bytes to return 200.
- Chain verification requires `baseCID()` and `tokenURI(40)` to reference the new CID, then
  the resulting metadata and image must return 200.

## Scope

No metadata values, token IDs, ownership, mint logic, database rows, or HTTPS v2 release
contents are changed by the code hotfix.
