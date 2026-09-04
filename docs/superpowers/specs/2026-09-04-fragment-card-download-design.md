# Fragment Card Download and Compact Profile Design

## Goal

Make the native browser **Save Image As…** action on an incomplete Swap NFT card save a promotional PNG that shows the dark silhouette plus the user's exact owned color fragments. Reduce Profile lifecycle cards so their square media area is approximately 200×200 pixels.

## Swap fragment export

The visible Swap rendering remains unchanged: the 512 WebP preview stays darkened by CSS, exact owned chip rectangles stay on the color canvas, and floating stars continue on the separate animation canvas.

After the preview and validated chip coordinates are available, a focused export helper creates one 512×512 canvas. It fills the existing dark card background, draws the preview with the same grayscale/blur/brightness/contrast treatment and 1.04 scale, then draws the exact owned color chip rectangles. It exports a PNG blob. Dynamic stars are intentionally omitted so the promotional image is stable and repeatable.

`NFTImageReveal` exposes that blob through an invisible, topmost image element. The element does not alter the visible card, but it becomes the browser's native image context-menu target, so **Open Image in New Tab** and **Save Image As…** use the composed fragment PNG rather than the underlying WebP. Blob URLs are revoked whenever the snapshot changes or the component unmounts. Preview images request anonymous CORS access so canvas export is permitted; export failures emit a structured log with the NFT identifier.

## Compact Profile layout

Profile uses an auto-filling grid of fixed 200-pixel columns aligned to the start. Each lifecycle card is 200 pixels wide and retains its square media ratio, status badge, mint/burn actions, filters, pagination, and click-to-open original viewer. On narrow screens the existing Profile container remains responsive without horizontal overflow.

The downloaded Swap PNG remains 512×512 regardless of the smaller Profile presentation.

## Verification and release

- Unit-test the PNG composition order, 512×512 output, exact chip rectangles, and structured export failure.
- Component-test that the native context-menu target appears only after a composed PNG is ready and that blob URLs are revoked.
- Test the 200-pixel Profile grid contract.
- Run the complete frontend test suite and production build.
- Release as frontend `1.0.61`, merge through a PR, and deploy via a staged atomic directory swap with a timestamped backup and public smoke checks.
