User request: "swap stopped working and this error: ## Error Type Runtime ReferenceError ## Error Message computeGridPositions is not defined"

### Objective Reconstruction
Resolve the `ReferenceError: computeGridPositions is not defined` in `useBentoLayout.ts`. This was caused by the recent refactor where `computeGridPositions` was moved to the shared engine, but the import in the hook was not updated.

### Strategic Reasoning
The error is a direct consequence of an incomplete refactor. Adding the missing import restores access to the utility and fixes the drag-and-drop initialization.

### Detailed Blueprint
1.  **useBentoLayout.ts**:
    *   Added `computeGridPositions` to the named imports from `@/lib/bento-engine`.

### Operational Trace
- Updated imports in `useBentoLayout.ts`.

### Status Assessment
The application should now be stable again, with correctly functioning drag-and-drop and the new coordinate-aware cancel logic active.
