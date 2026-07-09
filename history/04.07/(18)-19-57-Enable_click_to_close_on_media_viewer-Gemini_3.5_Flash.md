### 0. Date and time of the request
Date: 04.07.2026
Time: 19:57 (Start) - 19:57 (End)

### 1. User request
User request: "i cant exit modal by clicking anywhere"

### 2. Objective Reconstruction
Enable modal closure when clicking on the transparent/background areas of the media viewer content container, while preventing closure when clicking directly on the content assets (the image or the document card).

### 3. Strategic Reasoning
Previously, the content area container had an `onClick={e => e.stopPropagation()}` handler which stopped all click events inside its bounding box (which filled 100% width and height of the viewport). Consequently, clicks on the background did not reach the outer modal closure handler. We resolved this by:
1. Mapping the wrapper container click event directly to `closeModal`.
2. Adding `e.stopPropagation()` handlers to the image and document card elements to block propagation and preserve their internal interactive events (like zooming and original link opening).

### 4. Detailed Blueprint
- `src/components/modals/MediaViewerModal.tsx`: Change content area wrapper's click handler to close the modal, and add `e.stopPropagation()` on content items (`<img>` and `<div className="bg-white/5 ...">`).

### 5. Operational Trace
- Modified click event logic on wrapper and nested elements in `src/components/modals/MediaViewerModal.tsx`.
- Ran compilation checks via `npx tsc --noEmit` and confirmed successful build.

### 6. Status Assessment
Completed successfully. Background clicks now close the modal as expected.
