# Square NFT Media Design

## Problem

The homepage `My NFTs` grid can stretch an NFT preview vertically when neighboring cards have different content heights. The pre-mint preview is rendered through fixed-resolution canvases using `h-full w-full`, so a non-square container distorts the silhouette, chip pixels, and star animation. Minted originals use `object-contain`, which makes the mismatch especially visible.

## Root Cause

The earlier image component owned a `w-full aspect-square` root. The silhouette-preview refactor removed that aspect-ratio boundary and moved sizing responsibility to callers. `Profile` added its own square wrapper, but `NFTSection` did not. CSS Grid therefore stretches the homepage card row, and the canvas layers fill the resulting rectangular area.

## Design

`NFTImageReveal` will once again own a full-width, 1:1 media boundary for every render state:

- preview image and chip canvases;
- minted original and its click-to-view button;
- loading, unavailable, and failed-image states.

The component root will be `relative`, `w-full`, and `aspect-square`. Inner image, overlay, button, and status content may continue using `h-full w-full` because their containing block is guaranteed to be square. Canvas layers will also use `object-contain` as defensive protection against future layout regressions.

Caller-specific wrappers will not determine the component's aspect ratio. The existing `Profile` wrapper may remain because it also anchors status badges; the nested square constraint does not change its layout.

## Preserved Behavior

- Colored chip squares remain at the user's exact owned-chip coordinates.
- Large colored stars keep their current fly-in, scale-down, fade-out animation.
- Pre-mint cards continue loading only lightweight silhouettes, not originals.
- Minted NFT originals remain clickable and use the existing full-image viewer.
- The new-version refresh prompt remains enabled.

## Error Handling

Existing structured image-source and image-load errors remain unchanged. The square boundary also applies to unavailable states so a failed preview cannot change grid row geometry.

## Verification

Automated tests will assert that preview, original, clickable-original, and unavailable states all expose the component-owned square boundary. Overlay tests will assert that both canvas layers retain contain-style sizing.

The full frontend test suite and production build must pass. Browser verification will confirm that homepage cards remain square at desktop and narrow responsive widths, with no vertical distortion and no regression to chip/star alignment.

## Release

The frontend patch version will advance from `1.0.58` to `1.0.59`, preserving the existing update notification. Deployment will use the current server release procedure only after the branch is synchronized with the latest `origin/main` and verification passes.

## Non-Goals

- Changing the NFT artwork aspect ratio or crop mode.
- Modifying animation timing, star count, colors, or chip selection.
- Changing IPFS gateways, caching, mint eligibility, or original-image access rules.
