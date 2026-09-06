# Production Preview CID Build Guard Design

## Problem

The production frontend was built without `VITE_IPFS_PREVIEW_CID`. The preview
assets themselves are available, but `getIPFSPreviewUrl` correctly refuses to
invent a required CID, so every unminted Profile image renders as unavailable.

## Decision

Keep the immutable preview CID as release configuration and make a production
build fail before emitting assets when the value is missing or blank. Do not
hardcode a fallback CID in browser code and do not derive it from any other NFT
field.

`vite.config.ts` will load the selected mode's environment before returning the
Vite configuration. For `vite build` in production mode, it will validate
`VITE_IPFS_PREVIEW_CID` and throw a structured error containing:

- `code: FRONTEND_BUILD_ENV_MISSING`
- `missingFields: [VITE_IPFS_PREVIEW_CID]`
- `command` and `mode`

Development and test commands remain unaffected so local work can still start
without production release configuration.

## Release Flow

The deployment command must explicitly provide the already validated immutable
preview CID. Before replacing the served assets, verify representative preview
files return HTTP 200 with `image/webp`, then verify the built JavaScript bundle
contains the CID. Only after those checks pass may the new `dist` replace the
production frontend.

## Verification

An integration test invokes a real production Vite build with the preview CID
removed and asserts the structured failure. The normal frontend test suite and
a production build with the configured CID must pass. After deployment, NFT
Profile previews are checked in the live browser and representative public
preview URLs are checked directly.
