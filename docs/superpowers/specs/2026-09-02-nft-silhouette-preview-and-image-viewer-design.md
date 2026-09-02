# NFT Silhouette Preview and Original Image Viewer Design

## Context

The NFT cards currently load each 3000×3000 PNG before minting, then use browser-side
canvas and CSS effects to make the artwork dark and blurry and to reveal owned chip
regions. The 10,000 production PNGs occupy about 9.82 GB, with an average file size of
about 0.98 MB. Consequently, the current pre-mint UI still transfers full originals even
though it presents them as shadows.

The repository also contains an `NFTImageViewer`, but no page opens it. Users therefore
cannot enlarge minted artwork from the Profile grid.

## Goal

Reduce browser image traffic while preserving a distinct visual identity for every NFT:

- Before mint completion, load a dedicated 512×512 WebP silhouette and never load the
  corresponding original PNG.
- After mint completion, load the original PNG and allow it to be opened in the existing
  full-screen viewer from Profile.
- Keep NFT status, chip counts, progress bars, minting, and burning behavior unchanged.

This is a performance feature, not an access-control boundary. The original collection
remains publicly retrievable from IPFS by anyone who knows its CID and paths.

## Status Contract

The frontend will use the established backend lifecycle values consistently:

- `is_mint = 0`: mint not requested; use the silhouette.
- `is_mint = 1`: mint in progress; continue using the silhouette.
- `is_mint = 2`: mint complete and burnable; use the original and enable the viewer.

Collecting every chip does not switch the card to the original. Only `is_mint = 2` does.
Misleading comments that describe `1` as minted or `2` as burned will be corrected where
the affected image display code is changed.

## Considered Approaches

1. **Continue loading originals and rely on edge caching.** This protects the origin and
   improves latency, but every new browser still receives nearly 1 MB per card and the
   browser must run the canvas effects. It does not meet the traffic objective.
2. **Use one generic local placeholder for all pre-mint NFTs.** This nearly eliminates
   pre-mint image traffic, but every card looks the same and loses collection identity.
3. **Use one optimized silhouette per NFT (selected).** This adds a small preview library
   and a release step, while retaining recognizable silhouettes and reducing each
   pre-mint transfer from roughly 0.98 MB to a small WebP.

## Preview Asset Pipeline

A reproducible repository script will accept explicit input and output directories. The
input is the canonical directory of 3000×3000 PNG originals; the output is a new,
separate directory that is safe to pin as its own IPFS collection. Neither path will be
guessed.

For every source `<stem>.png`, the script will create `<stem>.webp` with these fixed
properties:

- 512×512 pixels without changing the square composition;
- grayscale;
- pre-baked blur and reduced brightness so removing browser CSS cannot restore detail;
- WebP quality 50;
- preserved deterministic filename stem.

The script will use bounded concurrency to avoid loading the 10,000 originals into memory
at once. It will write a manifest containing the transformation version, settings, source
count, output count, total output bytes, and per-file source/output names and sizes.

A validation command will fail unless:

- the explicit expected count is 10,000;
- every source has exactly one preview and there are no extra previews;
- every preview is readable WebP at exactly 512×512;
- every manifest entry matches a file on disk.

Generated previews will not be committed to Git. After validation, an operator pins the
output directory and records its immutable preview CID in the production frontend build
configuration.

## Frontend Image Selection

Image selection will be centralized in a small pure policy module rather than being
repeated in Profile and the homepage NFT list. Given an NFT lifecycle state and canonical
`file_name`, it will select exactly one source:

- pre-mint and minting: preview CID plus `<stem>.webp`;
- minted: existing original CID plus the exact `file_name`.

`VITE_IPFS_PREVIEW_CID` is required for preview URLs. The existing gateway override
continues to choose the HTTP gateway for both preview and original CIDs. Missing
`file_name` or preview CID produces a visible image error and a structured console event
containing the NFT ID, lifecycle status, and missing field names. It must never fall back
to the original PNG for a pre-mint NFT.

The card image component will use a normal `<img loading="lazy" decoding="async">` for
both sources. The pre-mint path will not initialize the original image, canvas animation,
or chip-coordinate request. Chip counts and progress bars remain sourced from the NFT list
response, so removing the image-region request does not remove progress information.

## Original Image Viewer

Profile will make only minted card images interactive. Activating a minted image opens
`NFTImageViewer` with the same original URL used by the card, allowing the browser cache
to reuse the downloaded response. Pre-mint and minting silhouettes are not interactive.

The viewer will:

- display the original fitted within the viewport;
- retain its save/open behavior;
- close from the close button, backdrop, or Escape key;
- prevent background scrolling while open;
- expose dialog semantics and an accessible close label;
- show a loading or explicit load-error state.

## Delivery and Caching

The preview directory and original directory use independent immutable IPFS CIDs. The
frontend is compatible with the existing Pinata gateway and with a later Cloudflare Web3
Gateway configured through the existing gateway override. CDN and browser caches may use
a one-year immutable lifetime because any content change produces a new CID.

The release order is:

1. Generate and validate all 10,000 previews.
2. Pin the preview directory and verify representative files through the chosen gateway.
3. Set `VITE_IPFS_PREVIEW_CID` for the production build.
4. Build and deploy the frontend.
5. Verify an `is_mint` value of 0 or 1 requests only WebP previews, while an `is_mint`
   value of 2 requests the original PNG and opens the viewer.

This ordering prevents deploying code that references a missing preview collection.

## Error Handling and Data Integrity

- Missing configuration or NFT filenames are explicit errors with identifiers and missing
  field names.
- A failed preview request displays an error placeholder and does not substitute the
  original.
- A failed original request displays the existing original-image error state.
- Asset generation and validation stop on unreadable, duplicate, missing, or invalid
  files; partial output is never treated as a releasable preview collection.

## Verification

- Pure unit tests cover lifecycle-to-source selection, deterministic preview filenames,
  and required-field failures.
- Component tests prove that states 0 and 1 render only the WebP preview URL, state 2
  renders only the PNG original URL, and no pre-mint chip-coordinate request occurs.
- Profile interaction tests prove only minted images open the viewer and that close,
  backdrop, and Escape interactions work.
- Generator tests use small fixtures to prove dimensions, format, transformation settings,
  manifest contents, and failure behavior.
- A full preview validation checks all 10,000 generated files before pinning.
- The complete frontend test suite and production build run before delivery and again
  after merging the latest `origin/main` into the feature branch.

## Non-goals

- Preventing direct access to already-public IPFS originals.
- Moving originals or previews into R2.
- Adding wallet-signature authorization for images.
- Changing NFT metadata, smart contracts, ownership, mint, or burn semantics.
- Preserving the current colored-chip canvas animation before minting.
