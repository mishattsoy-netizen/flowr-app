User request: "not fixed"

## 0. Date and time
26.06.2026 00:08

## 1. User request
"not fixed" — rotated shapes still move out of bounding box.

## 2. Objective Reconstruction
Rotated shapes desync from their selection bounding box during drag.

## 3. Root Cause
The previous "fix" to transform order was a no-op — the order was already correct before.

The REAL bug was the dynamic `transformOrigin` update inside `applyTransform`:
```js
const cx = snap.x + snap.w / 2 + currentDX;  // ← BUG
const cy = snap.y + snap.h / 2 + currentDY;  // ← BUG
el.style.transformOrigin = `${cx}px ${cy}px`;
```

**Math proof:** With `transform: translate3d(dx,dy,0) rotate(angle)` and `transform-origin: (cx0, cy0)`:
- CSS applies: rotate around (cx0, cy0) first, then translate by (dx, dy) in parent space.
- The shape's visual center moves to exactly `(cx0 + dx, cy0 + dy)` — correct world-space movement.

BUT with the dynamic origin `(cx0 + dx, cy0 + dy)`:
- The rotate pivot shifts to a different point on every frame.
- `Rotate(angle) * (−dx, −dy)` ≠ `(0, 0)` for angle ≠ 0.
- The shape orbits around an incorrect moving point instead of translating.

## 4. Fix Applied
Removed `+ currentDX` and `+ currentDY` from the `transformOrigin` computation in `applyTransform`.
The origin now stays fixed at `(snap.x + snap.w/2, snap.y + snap.h/2)` for the entire drag.
This ensures rotate-then-translate = correct world-space translation at any angle.

## 5. Operational Trace
- Modified `useDrag.ts` `applyTransform`: removed `+ currentDX` / `+ currentDY`.
- Ran `npx tsc --noEmit` → exit 0.

## 6. Status Assessment
Rotated shapes should now stay perfectly aligned with their bounding box during drag.
