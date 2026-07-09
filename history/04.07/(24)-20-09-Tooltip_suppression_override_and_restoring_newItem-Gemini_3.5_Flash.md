### 0. Date and time of the request
Date: 04.07.2026
Time: 20:07 (Start) - 20:09 (End)

### 1. User request
User request: "dont see tooltips"

### 2. Objective Reconstruction
Resolve two issues:
1. Tooltips not rendering inside the media viewer modal because the app's global tooltip system automatically suppresses all tooltips when `modal !== null` is active.
2. Resolve a TypeScript compilation error in `Dashboard.tsx` and list widgets caused by the missing `{ kind: 'newItem' }` definition in the `ModalType` union in `store.types.ts`.

### 3. Strategic Reasoning
- **Tooltip suppression**: The overlay context suppresses tooltips when overlays are active to avoid background leakage. We added an `ignoreSuppression?: boolean` property to `TooltipProps` inside `Tooltip.tsx`. If set to `true`, the tooltip bypasses the active suppression check. We then updated the 4 tooltips in `MediaViewerModal.tsx` to pass `ignoreSuppression={true}`.
- **TypeScript compile failure**: We restored the missing `{ kind: 'newItem'; parentId?: string | null; initialType?: EntityType; defaultToFirstCollection?: boolean }` type inside `ModalType` in `store.types.ts`.

### 4. Detailed Blueprint
- `src/components/layout/Tooltip.tsx`: Add `ignoreSuppression?: boolean` prop and conditional checks.
- `src/components/modals/MediaViewerModal.tsx`: Pass `ignoreSuppression` to all controls tooltips.
- `src/data/store.types.ts`: Re-insert `{ kind: 'newItem' }` object into `ModalType` union.

### 5. Operational Trace
- Updated `Tooltip.tsx`, `MediaViewerModal.tsx`, and `store.types.ts`.
- Ran `npx tsc --noEmit` and confirmed successful compile.

### 6. Status Assessment
Completed successfully. Tooltips inside the media viewer modal are now fully visible, and the project builds cleanly.
