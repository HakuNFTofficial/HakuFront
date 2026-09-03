# Square NFT Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every NFT media area square so pre-mint canvases, chip pixels, and stars cannot stretch vertically in the homepage grid.

**Architecture:** `NFTImageReveal` owns one full-width `aspect-square` boundary for every image state, leaving callers responsible only for card layout. `NFTChipOverlay` keeps its two fixed-resolution canvas buffers and defensively applies contain sizing inside that boundary.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, Vite

---

### Task 1: Lock the image component to a square boundary

**Files:**
- Modify: `frontend/src/components/NFTImageReveal.test.tsx`
- Modify: `frontend/src/components/NFTImageReveal.tsx`

- [ ] **Step 1: Write failing square-boundary tests**

Add a helper that asserts the rendered component root owns `relative`, `aspect-square`, and `w-full`. Use it in the pre-mint preview test and add focused cases for the clickable minted original and unavailable preview:

```tsx
function expectSquareMediaRoot(container: HTMLElement) {
    expect(container.firstElementChild).toHaveClass(
        'relative',
        'aspect-square',
        'w-full',
    )
}

const { container } = render(<NFTImageReveal nft={{ ...nft, is_mint }} />)
expectSquareMediaRoot(container)
```

- [ ] **Step 2: Run the focused test and verify the regression is caught**

Run: `npm test -- NFTImageReveal.test.tsx`

Expected: FAIL because the current root has only `h-full w-full` or is the viewer button, and the unavailable state also lacks `aspect-square`.

- [ ] **Step 3: Add the component-owned square boundary**

Define one square media class and use it in both the unavailable branch and the normal preview/original branch:

```tsx
const squareMediaClassName = 'relative aspect-square w-full'

if (!source.ok || !imageUrl || failedUrl === imageUrl) {
    const label = source.ok && source.kind === 'original'
        ? 'Image unavailable'
        : 'Preview unavailable'

    return (
        <div className={squareMediaClassName}>
            <div className="flex h-full w-full items-center justify-center bg-gray-800 text-sm text-gray-400">
                {label}
            </div>
        </div>
    )
}

const content = source.kind === 'original'
    && onViewOriginal
    && canViewNftOriginal(nft) ? (
    <button
        type="button"
        aria-label={`View original NFT #${nft.nft_id}`}
        className="block h-full w-full cursor-zoom-in"
        onClick={onViewOriginal}
    >
        {image}
    </button>
) : (
    <div className="h-full w-full">{preview}</div>
)

return (
    <div className={squareMediaClassName}>
        {content}
    </div>
)
```

Keep the existing inner `h-full w-full` elements, image loading policy, viewer click behavior, and error logs unchanged.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- NFTImageReveal.test.tsx`

Expected: the `NFTImageReveal` test file passes with no failures.

- [ ] **Step 5: Commit the square boundary**

```bash
git add frontend/src/components/NFTImageReveal.tsx frontend/src/components/NFTImageReveal.test.tsx
git commit -m "fix: keep NFT media square"
```

### Task 2: Defend canvas layers against distortion

**Files:**
- Modify: `frontend/src/components/NFTChipOverlay.test.tsx`
- Modify: `frontend/src/components/NFTChipOverlay.tsx`

- [ ] **Step 1: Write the failing canvas sizing test**

Render the overlay, select both canvases, and require each canvas to use contain sizing:

```tsx
const overlay = screen.getByTestId('nft-chip-overlay')
const canvases = overlay.querySelectorAll('canvas')

expect(canvases).toHaveLength(2)
canvases.forEach((canvas) => {
    expect(canvas).toHaveClass('h-full', 'w-full', 'object-contain')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- NFTChipOverlay.test.tsx`

Expected: FAIL because neither canvas currently has `object-contain`.

- [ ] **Step 3: Add contain sizing to both canvases**

Update both canvas class names without changing their dimensions, drawing buffers, or animation logic:

```tsx
className="absolute inset-0 h-full w-full object-contain"
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- NFTChipOverlay.test.tsx`

Expected: the overlay test file passes, including chip-coordinate and star-animation coverage.

- [ ] **Step 5: Commit the canvas protection**

```bash
git add frontend/src/components/NFTChipOverlay.tsx frontend/src/components/NFTChipOverlay.test.tsx
git commit -m "fix: prevent NFT canvas distortion"
```

### Task 3: Release and regression verification

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Advance the frontend patch version**

Run from `frontend/`: `npm version 1.0.59 --no-git-tag-version`

Expected: both package manifests report `1.0.59`; the existing Vite version injection continues driving the update prompt.

- [ ] **Step 2: Run all frontend tests**

Run: `npm test`

Expected: all test files and tests pass.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully and generate `frontend/dist`.

- [ ] **Step 4: Commit the release version**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: release frontend 1.0.59"
```

- [ ] **Step 5: Synchronize with the latest main branch**

Run: `git fetch origin main`

Run: `git merge origin/main`

Expected: the feature branch contains the latest `origin/main`; resolve any conflicts without losing the square boundary or current animation.

- [ ] **Step 6: Rerun the release verification after synchronization**

Run from `frontend/`: `npm test`

Run from `frontend/`: `npm run build`

Expected: all tests and the production build pass again.

- [ ] **Step 7: Inspect the final diff**

Run: `git diff --check origin/main...HEAD`

Run: `git status --short`

Expected: no whitespace errors and no uncommitted source changes.

### Task 4: Publish, review, and deploy

**Files:**
- No additional source files expected.

- [ ] **Step 1: Push the feature branch and create a pull request**

Run: `git push -u origin fix/square-nft-media`

Run: `gh pr create --base main --head fix/square-nft-media --title "fix: keep NFT media square" --body "Locks NFTImageReveal to a component-owned 1:1 media boundary and adds defensive contain sizing to both chip canvases. Preserves exact owned-chip coordinates, floating rainbow stars, preview-only loading before mint, the original-image viewer, and the version update prompt. Verified with the full frontend test suite and production build."`

Expected: GitHub returns a pull-request URL containing the implementation summary and verification results.

- [ ] **Step 2: Review the branch against the design**

Check that the diff changes only the square media boundary, canvas sizing classes, tests, release version, and design/plan documents. Confirm that animation, exact chip coordinates, preview/original policy, viewer action, and version prompt are untouched.

- [ ] **Step 3: Merge the reviewed pull request**

Run: `gh pr merge fix/square-nft-media --merge --delete-branch`

Expected: GitHub reports the pull request merged into `main`.

- [ ] **Step 4: Back up and deploy the production bundle**

Create `/private/tmp/hakufront-1.0.59.tar.gz` from `frontend/dist` and upload it to `/tmp/hakufront-1.0.59.tar.gz` on `119.8.235.187` through the existing approved SSH connection. On the server, create `/usr/local/www/dist.next-1.0.59`, extract the archive there, and verify that `index.html` and its referenced hashed JavaScript/CSS assets exist. Run `nginx -t` before changing the active directory.

After staging passes, rename `/usr/local/www/dist` to a new, explicit timestamped backup whose name starts with `/usr/local/www/dist.backup-` and ends with `-square-media`; then rename `/usr/local/www/dist.next-1.0.59` to `/usr/local/www/dist`. Do not overwrite an existing staging or backup path. If a production smoke check fails, move the failed release aside and restore that exact backup directory.

- [ ] **Step 5: Verify production behavior**

Verify that the deployed JavaScript reports `1.0.59`, homepage NFT image areas are square at desktop and narrow widths, chip/star overlays align with their previews, minted originals still open in the viewer, and the `New version available` prompt appears for clients still running `1.0.58`.
