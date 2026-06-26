User request: "right panel fixed, left not"

### 0. Date and time of the request
Date: 26.06.2026
Time: 05:33

### 1. User request
"right panel fixed, left not"

### 2. Objective Reconstruction
Apply the transition-free panel mounting/resizing fix to the left panel (the layers and assets tabs slider inside `CanvasLayersPanel`) so that its tab sliding indicator pill does not slide in or stretch during visibility changes or layout initialization, but animates smoothly when user tabs are clicked.

### 3. Strategic Reasoning
- The left panel has its own local tab selector slider using a sliding indicator pill.
- Applied the exact same solution implemented for the right panel: checking `tab` changes in a layout transition handler to set a temporary `shouldAnimate` flag, while utilizing a `ResizeObserver` (with `shouldAnimate` disabled) to track container resizing and keep the layout instantly updated.

### 4. Detailed Blueprint
- Modify `src/components/canvas/CanvasLayersPanel.tsx`:
  - Import `useEffect` from React.
  - Implement `shouldAnimate` and `prevTabRef` states.
  - Structure `useLayoutEffect` to trigger `shouldAnimate` only when `tab` values change.
  - Implement `ResizeObserver` observing the tab container in `useEffect`, setting `shouldAnimate` to `false` and measuring positions.
  - Toggle transition styles on the sliding pill `div`.

### 5. Operational Trace
- Modified imports and hooks/rendering code inside `src/components/canvas/CanvasLayersPanel.tsx`.
- Confirmed project code builds successfully with `npx tsc --noEmit`.

### 6. Status Assessment
- Successfully unified the sliding pill transition fixes across both panels.
- Verified TypeScript checks passed.
