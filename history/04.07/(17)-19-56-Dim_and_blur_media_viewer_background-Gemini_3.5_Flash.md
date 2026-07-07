### 0. Date and time of the request
Date: 04.07.2026
Time: 19:54 (Start) - 19:56 (End)

### 1. User request
User request: "change moda's bg, not solid black but dimmed blured bg, smae as in vault or download popups"

### 2. Objective Reconstruction
Change the background overlay of the media viewer modal from a heavy, solid dark cover to the standard, unified `bg-overlay backdrop-blur-sm` style used across other modals and popups in the application.

### 3. Strategic Reasoning
To align with the design aesthetics of the app's standard popups (such as the download instructions, rename, and new item modals), we updated the backdrop CSS classes in `MediaViewerModal.tsx` to use the shared style configuration. This establishes design consistency and visual coherence.

### 4. Detailed Blueprint
- `src/components/modals/MediaViewerModal.tsx`: Change the backdrop `className` from `bg-black/90 backdrop-blur-xl` to `bg-overlay backdrop-blur-sm`.

### 5. Operational Trace
- Replaced backdrop styles in `src/components/modals/MediaViewerModal.tsx`.
- Ran compiler checks via `npx tsc --noEmit` and confirmed successful build.

### 6. Status Assessment
Completed successfully. The media viewer modal backdrop now matches the standard dimmed, blurred look of the rest of the application's overlays.
