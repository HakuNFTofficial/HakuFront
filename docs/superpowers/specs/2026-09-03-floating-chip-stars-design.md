# Floating Chip Stars Design

## Goal

Restore the pre-mint NFT animation shown in the supplied reference: large multicolored starbursts drift in from random canvas edges, shrink while approaching real owned-chip positions, then fade out and leave the exact-color chip rectangles visible.

## Scope

- Change only the pre-mint chip overlay animation.
- Keep the 512 x 512 color WebP preview as the sole pre-mint image download.
- Keep minted original-image viewing unchanged.
- Keep every persistent colored rectangle tied to a validated owned-chip coordinate.

## Visual Behavior

1. All validated owned-chip rectangles are drawn immediately from the already-loaded 512 x 512 preview.
2. Animated starbursts are selected only from the validated owned-chip list:
   - 1-30 owned chips: animate every chip.
   - 31-1000 owned chips: animate 30 chips.
   - More than 1000 owned chips: animate 100 chips.
3. Each selected starburst starts outside one randomly selected canvas edge.
4. Each starburst travels to the center of its own selected chip. It never targets an invented point or another NFT's chip.
5. During the 1.5 second flight, the starburst:
   - fades in over the first 40%, stays bright through 80%, and fades out over the final 20%;
   - rotates;
   - uses a distinct saturated hue and additive glow;
   - shrinks from 1.4 times the restored old star footprint to 0.45 times that footprint;
   - fades out on arrival.
6. Starbursts are staggered across an 8,000 ms sequence, with delay calculated so the final 1,500 ms flight ends at 8,000 ms. After the final starburst fades, the exact-color chip rectangles remain.
7. Reloading the page may produce different edge origins and colors, preserving the old random-arrival feeling. Within one animation run, each star's assigned origin, hue, rotation, and target remain stable.

## Rendering Architecture

`NFTChipOverlay` retains two canvas layers:

- The color canvas copies exact chip rectangles from the loaded preview and does not animate.
- The sparkle canvas owns the transient starburst animation and is cleared every animation frame.

Animation state is generated once per component run. Pure helper functions calculate star selection, random edge origins, stagger timing, interpolation, alpha, rotation, and scale. The drawing function consumes that state without changing business data.

## Data Integrity

- Coordinates continue to pass through the existing 3000 x 3000 validation and 512 x 512 scaling path.
- The expected owned-chip count remains authoritative.
- Missing or invalid coordinates continue to emit the structured `nft_chip_coordinates_invalid` error.
- No fallback target positions are generated for missing chip data.

## Performance and Accessibility

- The existing caps of 30 and 100 animated stars remain in place.
- The animation loop stops after the final 8 second sequence; there is no perpetual requestAnimationFrame loop.
- No additional image request is introduced.
- When `prefers-reduced-motion: reduce` is active, the transient starbursts are skipped and the exact-color chip rectangles remain visible.

## Verification

- Unit-test that every animated target is a real selected owned chip.
- Unit-test that randomized origins lie outside exactly one canvas edge.
- Unit-test stagger timing, decreasing scale, fade-in, and arrival fade-out.
- Component-test animation-loop start, cleanup, and reduced-motion behavior.
- Run the full frontend suite, TypeScript production build, and pre-mint preview tests.
- Validate online with the connected-wallet cards for NFT #3995 (23 chips) and NFT #7081 (1 chip), capturing the animation during flight and after it settles.

## Rollback

The currently deployed v1.0.57 remains available through Git history and its server backup. The earlier `v1.0.56` tag remains unchanged.
