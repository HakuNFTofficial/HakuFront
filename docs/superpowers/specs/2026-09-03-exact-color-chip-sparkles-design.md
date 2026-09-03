# Exact-color NFT chip sparkles

## Context

Release 1.0.56 stopped loading full-resolution NFT originals before minting and replaced them with generated 512×512 WebP silhouettes. That removed the previous Canvas layer which drew owned chip regions and the sparkle animation. The generated silhouette is also too bright, so the underlying portrait is more visible than intended.

## Requirements

- Before minting, never request the full-resolution NFT original.
- Draw only chips the connected wallet actually owns, at their exact database coordinates.
- Reveal each owned chip using color sampled from the NFT artwork, not a synthetic palette.
- Restore a visible twinkle at actual owned-chip positions.
- Make the non-owned background substantially darker and less recognizable than release 1.0.56.
- Preserve the minted-original viewer behavior for `is_mint === 2`.
- Keep coordinate loading batched with existing NFT summary endpoints; do not restore per-NFT chip requests or chip Base64 payloads.
- Cap animated sparkles for high chip counts while selecting only real owned-chip coordinates.

## Design

The preview release artifact becomes a 512×512 color WebP collection. All source artwork is validated as 3000×3000 before generation; generation fails with the file name and actual dimensions when this invariant is violated. The browser downloads only this small preview before minting. CSS turns the preview element into the dark blurred background, while an overlaid Canvas copies the owned coordinate rectangles from the same already-loaded preview image. This preserves the artwork's displayed colors without downloading the full-resolution original or separate chip images.

The frontend requests `owned_chips` from the existing `query-mint` and paginated `user-nft-list` responses by setting `include_chips=true`. These responses contain only `x`, `y`, `w`, and `h`; the backend does not include image bytes. WebSocket notifications trigger a fresh coordinate-bearing snapshot rather than replacing rendered data with summary-only event data.

Canvas rendering uses a fixed 3000×3000 source coordinate space and a 512×512 preview canvas. Each owned rectangle is scaled into preview space and copied from the color preview. Sparkles animate at selected owned-chip centers. Up to 30 positions animate for 1–1000 owned chips and up to 100 positions above that threshold; deterministic even sampling prevents layout changes between renders. Every rendered sparkle therefore corresponds to an actual owned chip even when the animated subset is capped.

For `prefers-reduced-motion`, the color chips remain visible and animation is omitted. Missing coordinates are treated as missing required display data for incomplete NFTs: the component logs a structured error with the NFT id and expected/actual coordinate counts and renders the dark preview without inventing positions.

## Verification

- Generator tests prove the preview remains color, is 512×512 WebP, validates 3000×3000 inputs, and records artifact version 2.
- Pure rendering tests prove exact coordinate scaling and deterministic real-chip selection.
- Component tests prove incomplete NFTs use the preview URL, dark treatment, Canvas overlay, and no original URL; minted NFTs retain the viewer.
- Source-policy tests prove both card surfaces request coordinate-bearing summaries and never call the legacy per-NFT batch endpoint.
- Full frontend tests and production build must pass before deployment.
- Regenerate and validate all 10,000 previews, pin the new CID, deploy release 1.0.57 atomically, then verify public HTML, JS, API, and representative preview files.

## Rollback

Git tag `v1.0.56` points to commit `1079c4c9a7314fcae5699d19c70dc71f9c814f90`. Deployment retains the previous server static directory until public verification is complete.
