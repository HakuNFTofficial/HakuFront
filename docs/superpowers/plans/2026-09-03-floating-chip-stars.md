# Floating Chip Stars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the old multicolored edge-to-chip starburst animation while preserving exact owned-chip coordinates and the 512px pre-mint preview policy.

**Architecture:** Add a pure animation-model module that creates one stable random flight plan per selected real chip and calculates frame position, opacity, rotation, and scale. Keep `NFTChipOverlay` responsible only for drawing the persistent exact-color chip canvas and rendering transient star plans on its second canvas.

**Tech Stack:** React 18, TypeScript, Canvas 2D, Vitest, Testing Library, Vite

---

### Task 1: Model Real-Chip Star Flights

**Files:**
- Create: `frontend/src/nft/chipStarAnimation.ts`
- Create: `frontend/src/nft/chipStarAnimation.test.ts`

- [ ] **Step 1: Write failing tests for real targets, off-canvas starts, stagger timing, fade, and shrinking**

```ts
import { describe, expect, it } from 'vitest'
import {
    createFloatingStarPlans,
    getFloatingStarFrame,
    STAR_SEQUENCE_MS,
} from './chipStarAnimation'

const chip = { x: 300, y: 600, w: 30, h: 60 }

describe('floating chip stars', () => {
    it('targets the selected real chip and starts outside an edge', () => {
        const values = [0, 0.25, 0.5, 0.75]
        let index = 0
        const [plan] = createFloatingStarPlans([chip], () => values[index++ % values.length])

        expect(plan.chip).toBe(chip)
        expect(plan.targetX).toBeCloseTo(53.76)
        expect(plan.targetY).toBeCloseTo(107.52)
        expect(plan.startY).toBeLessThan(0)
    })

    it('fades in, shrinks, reaches the real target, and fades out', () => {
        const [plan] = createFloatingStarPlans([chip], () => 0)
        const opening = getFloatingStarFrame(plan, 0, 1, 300)
        const landing = getFloatingStarFrame(plan, 0, 1, 1500)

        expect(opening.alpha).toBeGreaterThan(0)
        expect(opening.scale).toBeGreaterThan(landing.scale)
        expect(landing.x).toBeCloseTo(plan.targetX)
        expect(landing.y).toBeCloseTo(plan.targetY)
        expect(landing.alpha).toBe(0)
    })

    it('places the final star at the end of the eight-second sequence', () => {
        const plans = createFloatingStarPlans([chip, chip, chip], () => 0)
        const last = getFloatingStarFrame(plans[2], 2, plans.length, STAR_SEQUENCE_MS)
        expect(last.alpha).toBe(0)
        expect(last.complete).toBe(true)
    })
})
```

- [ ] **Step 2: Run the focused test and confirm it fails because the module does not exist**

Run: `cd frontend && npm test -- --run src/nft/chipStarAnimation.test.ts`

Expected: FAIL with an unresolved `./chipStarAnimation` import.

- [ ] **Step 3: Implement the pure flight-plan and frame helpers**

```ts
import { NFT_PREVIEW_SIZE, scaleChipRect, type ChipCoordinate } from './chipOverlay'

export const STAR_SEQUENCE_MS = 8_000
export const STAR_FLIGHT_MS = 1_500
export const STAR_EDGE_OFFSET = 80

export interface FloatingStarPlan {
    chip: ChipCoordinate
    startX: number
    startY: number
    targetX: number
    targetY: number
    startRotation: number
    hue: number
}

export interface FloatingStarFrame {
    x: number
    y: number
    rotation: number
    scale: number
    alpha: number
    complete: boolean
}

export function createFloatingStarPlans(
    chips: ChipCoordinate[],
    random: () => number = Math.random,
): FloatingStarPlan[] {
    return chips.map((chip, index) => {
        const rect = scaleChipRect(chip)
        const side = Math.floor(random() * 4)
        const along = random() * NFT_PREVIEW_SIZE
        const starts = [
            { startX: along, startY: -STAR_EDGE_OFFSET },
            { startX: NFT_PREVIEW_SIZE + STAR_EDGE_OFFSET, startY: along },
            { startX: along, startY: NFT_PREVIEW_SIZE + STAR_EDGE_OFFSET },
            { startX: -STAR_EDGE_OFFSET, startY: along },
        ]
        return {
            chip,
            ...starts[side],
            targetX: rect.x + rect.width / 2,
            targetY: rect.y + rect.height / 2,
            startRotation: random() * Math.PI * 2,
            hue: (index * 137.508 + random() * 72) % 360,
        }
    })
}

export function getFloatingStarFrame(
    plan: FloatingStarPlan,
    index: number,
    count: number,
    elapsed: number,
): FloatingStarFrame {
    const delay = count > 1
        ? index * (STAR_SEQUENCE_MS - STAR_FLIGHT_MS) / (count - 1)
        : 0
    const progress = Math.max(0, Math.min(1, (elapsed - delay) / STAR_FLIGHT_MS))
    const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2
    const alpha = progress <= 0.4
        ? progress / 0.4
        : progress <= 0.8
            ? 1
            : 1 - (progress - 0.8) / 0.2

    return {
        x: plan.startX + (plan.targetX - plan.startX) * eased,
        y: plan.startY + (plan.targetY - plan.startY) * eased,
        rotation: plan.startRotation + progress * Math.PI * 6,
        scale: 1.4 - progress * 0.95,
        alpha: elapsed < delay ? 0 : Math.max(0, alpha),
        complete: elapsed >= delay + STAR_FLIGHT_MS,
    }
}
```

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `cd frontend && npm test -- --run src/nft/chipStarAnimation.test.ts`

Expected: the new test file passes.

- [ ] **Step 5: Commit the animation model**

```bash
git add frontend/src/nft/chipStarAnimation.ts frontend/src/nft/chipStarAnimation.test.ts
git commit -m "feat: model floating chip star flights"
```

### Task 2: Restore the Multicolored Canvas Starburst

**Files:**
- Modify: `frontend/src/components/NFTChipOverlay.tsx`
- Modify: `frontend/src/components/NFTChipOverlay.test.tsx`

- [ ] **Step 1: Extend the component test context and add a failing animated-star assertion**

Add `createLinearGradient`, `scale`, and gradient mocks to the fake canvas context. Capture the scheduled frame callback and add this assertion:

```ts
const gradient = () => ({ addColorStop: vi.fn() })

// Add these members to the context() test double.
createLinearGradient: vi.fn(gradient),
createRadialGradient: vi.fn(gradient),
scale: vi.fn(),

const frameCallbacks: FrameRequestCallback[] = []
vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frameCallbacks.push(callback)
    return frameCallbacks.length
}))

it('draws a moving multicolored starburst before it lands', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(
        <NFTChipOverlay
            image={image}
            nftId={3995}
            expectedCount={1}
            chips={[{ x: 300, y: 600, w: 30, h: 60 }]}
        />,
    )

    frameCallbacks[0](0)
    frameCallbacks[1](750)

    expect(sparkleContext.translate).toHaveBeenCalled()
    expect(sparkleContext.rotate).toHaveBeenCalled()
    expect(sparkleContext.scale).toHaveBeenCalledWith(expect.any(Number), expect.any(Number))
    expect(sparkleContext.createRadialGradient).toHaveBeenCalled()
    expect(sparkleContext.createLinearGradient).toHaveBeenCalled()
    expect(sparkleContext.fill).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the focused component test and confirm the old small white cross fails the new assertion**

Run: `cd frontend && npm test -- --run src/components/NFTChipOverlay.test.tsx`

Expected: FAIL because the current renderer does not create colored linear gradients or translate a flying star.

- [ ] **Step 3: Replace the fixed white pulse with the old layered rainbow star renderer**

In `NFTChipOverlay.tsx`:

```ts
const starPlans = createFloatingStarPlans(selectSparkleChips(renderedChips))

return startAnimationFrameLoop((timestamp) => {
    if (startedAt === null) startedAt = timestamp
    const elapsed = timestamp - startedAt
    context.clearRect(0, 0, NFT_PREVIEW_SIZE, NFT_PREVIEW_SIZE)
    starPlans.forEach((plan, index) => {
        const frame = getFloatingStarFrame(plan, index, starPlans.length, elapsed)
        if (frame.alpha > 0) drawFloatingStar(context, plan, frame, elapsed, index)
    })
    return elapsed < STAR_SEQUENCE_MS
})
```

`drawFloatingStar` must use the old visual recipe: additive blending, an HSL radial halo, four broad diamond beams, four thin beams, a bright radial core, six orbiting sparkle dots, continuous rotation, and the frame's decreasing scale. It must restore the context after every star and must not modify the persistent color canvas.

```ts
function drawFloatingStar(
    context: CanvasRenderingContext2D,
    plan: FloatingStarPlan,
    frame: FloatingStarFrame,
    elapsed: number,
    index: number,
) {
    const starSize = NFT_PREVIEW_SIZE * 0.025
    const beamLength = starSize * 5
    const { hue } = plan

    context.save()
    context.globalCompositeOperation = 'lighter'

    const halo = context.createRadialGradient(
        frame.x, frame.y, 0,
        frame.x, frame.y, starSize * frame.scale * 3,
    )
    halo.addColorStop(0, `hsla(${hue}, 70%, 50%, ${frame.alpha * 0.6})`)
    halo.addColorStop(0.6, `hsla(${hue}, 50%, 30%, ${frame.alpha * 0.2})`)
    halo.addColorStop(1, `hsla(${hue}, 40%, 20%, 0)`)
    context.fillStyle = halo
    context.beginPath()
    context.arc(frame.x, frame.y, starSize * frame.scale * 3, 0, Math.PI * 2)
    context.fill()

    context.translate(frame.x, frame.y)
    context.rotate(frame.rotation)
    context.scale(frame.scale, frame.scale)

    const drawBeam = (angle: number, length: number, thin: boolean) => {
        context.save()
        context.rotate(angle)
        const gradient = context.createLinearGradient(0, 0, length, 0)
        gradient.addColorStop(0, `hsla(${hue}, 100%, 95%, ${frame.alpha})`)
        gradient.addColorStop(0.3, `hsla(${hue}, 95%, 80%, ${frame.alpha * 0.85})`)
        gradient.addColorStop(1, `hsla(${hue}, 75%, 60%, 0)`)
        context.fillStyle = gradient
        const halfWidth = starSize * (thin ? 0.05 : 0.15)
        context.beginPath()
        context.moveTo(0, 0)
        context.lineTo(length * 0.3, -halfWidth)
        context.lineTo(length, 0)
        context.lineTo(length * 0.3, halfWidth)
        context.closePath()
        context.fill()
        context.restore()
    }

    for (let arm = 0; arm < 4; arm += 1) {
        const angle = arm * Math.PI / 2
        drawBeam(angle, beamLength, false)
        drawBeam(angle, beamLength * 1.3, true)
    }

    const pulse = 0.95 + Math.sin(elapsed / 100 + index * 0.5) * 0.05
    const core = context.createRadialGradient(0, 0, 0, 0, 0, starSize * 1.2 * pulse)
    core.addColorStop(0, `hsla(${hue}, 100%, 100%, ${frame.alpha})`)
    core.addColorStop(0.4, `hsla(${hue}, 90%, 80%, ${frame.alpha * 0.85})`)
    core.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`)
    context.fillStyle = core
    context.beginPath()
    context.arc(0, 0, starSize * 1.2 * pulse, 0, Math.PI * 2)
    context.fill()

    for (let sparkle = 0; sparkle < 6; sparkle += 1) {
        const angle = sparkle * Math.PI / 3 - frame.rotation * 0.6
        const distance = starSize * (1.4 + Math.sin(elapsed / 150 + sparkle) * 0.25)
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance
        const dot = context.createRadialGradient(x, y, 0, x, y, starSize * 0.3)
        dot.addColorStop(0, `hsla(${(hue + sparkle * 60) % 360}, 100%, 90%, ${frame.alpha})`)
        dot.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`)
        context.fillStyle = dot
        context.beginPath()
        context.arc(x, y, starSize * 0.3, 0, Math.PI * 2)
        context.fill()
    }

    context.restore()
}
```

- [ ] **Step 4: Run the focused component and model tests**

Run: `cd frontend && npm test -- --run src/nft/chipStarAnimation.test.ts src/components/NFTChipOverlay.test.tsx`

Expected: both test files pass.

- [ ] **Step 5: Commit the Canvas renderer**

```bash
git add frontend/src/components/NFTChipOverlay.tsx frontend/src/components/NFTChipOverlay.test.tsx
git commit -m "fix: restore floating rainbow chip stars"
```

### Task 3: Release and Verify v1.0.58

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`

- [ ] **Step 1: Bump the frontend patch version**

Run: `cd frontend && npm version 1.0.58 --no-git-tag-version`

Expected: both package files report `1.0.58`.

- [ ] **Step 2: Run all local verification**

Run: `npm run preview:test`

Expected: 5 preview tests pass.

Run: `cd frontend && npm test -- --run`

Expected: all frontend tests pass, including the new animation tests.

Run: `cd frontend && npm run build`

Expected: TypeScript and Vite production build succeed.

- [ ] **Step 3: Commit the release bump**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: release frontend 1.0.58"
```

### Task 4: Integrate, Publish, and Deploy

**Files:**
- No source files beyond prior tasks.

- [ ] **Step 1: Fetch and merge the latest main branch**

Run: `git fetch origin`

Run: `git merge origin/main`

Expected: merge succeeds without unresolved conflicts.

- [ ] **Step 2: Rerun frontend tests and the production build after the merge**

Run: `cd frontend && npm test -- --run`

Run: `cd frontend && npm run build`

Expected: the full suite and production build pass.

- [ ] **Step 3: Push the branch and open a pull request**

Run: `git push -u origin fix/restore-floating-stars`

Run: `gh pr create --base main --head fix/restore-floating-stars --title "Restore floating NFT chip stars" --body "Restores the old multicolored edge-to-chip starburst animation while preserving exact owned-chip coordinates and 512px preview-only loading before mint."`

Expected: GitHub returns a pull-request URL.

- [ ] **Step 4: Merge the verified pull request and build the deployment artifact from merged `origin/main`**

The production build must set `VITE_IPFS_PREVIEW_CID=bafybeidywgh6drtllyoifkqo5bl2vlvbnp2qovozccbcpc6unsnpi2mfvy`. Verify the resulting bundle contains version `1.0.58` and this CID.

- [ ] **Step 5: Deploy atomically to the existing Huawei Cloud Nginx directory**

Upload an archive of `frontend/dist`, extract to a staging directory, verify file hashes and `nginx -t`, rename the active `/usr/local/www/dist` to a timestamped backup, then rename staging to `/usr/local/www/dist`.

- [ ] **Step 6: Validate the public site in the connected Chrome wallet session**

Reload `https://www.hakupump.club/`. Confirm NFT #3995 shows multicolored large starbursts traveling from random edges to real chip targets during the sequence and retains 23 exact-color rectangles after settling. Confirm NFT #7081 animates one real target. Confirm both preview images remain 512 x 512 WebP assets and no application console errors are introduced.
