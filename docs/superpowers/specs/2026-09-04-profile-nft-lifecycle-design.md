# Profile NFT Lifecycle Design

## Goal

Move complete NFTs and the mint/burn lifecycle from the Swap surface to Profile. Swap remains the animated, coordinate-bearing view for incomplete NFTs; Profile becomes the static lifecycle-management view for complete, minting, and minted NFTs.

## Backend contract

`GET /api/user-nft-list` gains explicit server-side status filters:

- `in_progress`: `is_mint = 0`, a positive persisted chip total, and fewer owned chips than total chips;
- `profile`: complete `is_mint = 0` NFTs plus every `is_mint = 1` or `is_mint = 2` NFT;
- `mintable`, `minting`, and `burnable`: the three Profile lifecycle subsets.

Filtering happens in SQL before pagination. The response includes global counts for the incomplete, mintable, minting, burnable, and combined Profile states. Invalid filter values fail with HTTP 400 and a structured error; the server does not reinterpret them as another business state.

Swap requests six `in_progress` records with `include_chips=true`. Profile requests a paginated lifecycle filter with `include_chips=false`. The existing summary-only WebSocket event remains the realtime transition signal; each page refreshes its own filtered snapshot.

## Frontend behavior

Swap keeps `NFTImageReveal`, exact-coordinate chip rectangles, and the existing finite star animation. It contains no approve, mint, revoke, or burn controls. When a currently visible NFT changes from incomplete to complete, the card leaves the server-filtered page and a non-blocking notice links the user to Profile. The page never navigates automatically.

Profile owns the existing per-NFT lifecycle:

- complete plus `is_mint = 0`: ready to approve and mint;
- `is_mint = 1`: minting and protected from duplicate submission;
- `is_mint = 2`: minted and burnable;
- after a confirmed burn, the backend restores the NFT to complete plus `is_mint = 0`, so it remains in Profile and becomes mintable again.

Profile cards load the 512 x 512 color WebP preview without the dark filter, Canvas, chip coordinates, or animation. Clicking any Profile thumbnail opens the existing viewer, which loads the full original only after the click. Missing `file_name` or image configuration produces an explicit visible state and structured log; no filename or image source is guessed.

## State and rendering boundaries

The page-level lifecycle controller keeps a single set of wallet/contract hooks and per-NFT operation IDs. Card rendering stays passive, avoiding one allowance or contract subscription per card. Rare mint/burn synchronization polls remain summary-only and refresh the active Profile page after the authoritative backend transition appears.

Profile filters are `All`, `Mintable`, `Minting`, and `Burnable`. Counts come from the backend rather than the current page. A filter change resets pagination to page one, and a page is clamped after realtime removals.

## Verification and deployment

- Backend tests cover filter parsing, SQL state partitions, pagination, counts, and coordinate omission.
- Frontend tests cover server-filtered requests, Swap-only animation, static Profile previews, click-to-load originals for every Profile lifecycle state, and lifecycle controls living only on Profile.
- Run complete frontend tests/build and backend tests/release build.
- Merge latest `origin/main` into both branches, rerun verification, push both branches, and create pull requests.
- Deploy backend first with a timestamped binary backup and health rollback, then deploy the frontend through a staged atomic directory swap with a timestamped static backup.

