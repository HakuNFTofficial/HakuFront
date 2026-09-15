# Haku Sealed Upgrade Page Design

## Goal

Replace the unavailable dApp surface with a polished, static upgrade page while the Haku Sealed mint and Arc mainnet migration are in progress.

## Activation

The production build reads `VITE_MAINTENANCE_MODE`. The upgrade page is enabled only when the value is exactly `true`; any other value keeps the existing dApp active. Operations can restore the dApp by changing the value to `false` or removing it and rebuilding.

When maintenance mode is active, `VITE_IPFS_PREVIEW_CID` is not required because the NFT application is not mounted. Normal production builds continue to fail explicitly with the existing structured `FRONTEND_BUILD_ENV_MISSING` error when the preview CID is absent.

## Page

The selected visual direction is the immersive seal. It contains:

- the Haku Pump wordmark;
- links to the existing X and Discord communities;
- the label `Haku Sealed · In progress`;
- the headline `Sealing the next chapter.`;
- the exact announcement `Our dApp will be paused during the “Haku Sealed” mint and will return to the Arc mainnet soon.`; and
- an `Upgrade in progress` status indicator.

The background uses the existing dark Haku palette with restrained pink and violet gradients. A CSS-only concentric orb supplies the seal motif, so the page has no remote image dependency. Motion is subtle and disabled when the browser requests reduced motion.

## Runtime boundary

The maintenance decision is made before the existing dApp provider tree is rendered. In maintenance mode, Wagmi, React Query, WebSocket consumers, wallet controls, Swap, Profile, and API-backed sections are not mounted. The result is a static page that does not expose the reset data or network failures behind it.

## Responsive and accessible behavior

The layout fills the viewport, keeps the announcement readable on narrow screens, and preserves safe padding around the header and centered hero. The status remains text-based rather than color-only, social links have accessible names, and decorative artwork is hidden from assistive technology.

## Verification

Automated tests cover strict environment parsing, maintenance-mode root selection, visible copy and social links, reduced-motion CSS, and the conditional production-build requirement. The release is verified with the full frontend test suite and a production maintenance build.
