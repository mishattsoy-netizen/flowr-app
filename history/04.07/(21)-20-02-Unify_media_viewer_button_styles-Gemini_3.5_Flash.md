### 0. Date and time of the request
Date: 04.07.2026
Time: 20:01 (Start) - 20:02 (End)

### 1. User request
User request: "close, downlaod and copy buttons must have same colors and effects and style as plsu button in dashboard"

### 2. Objective Reconstruction
Align the styling, sizes, borders, colors, hover effects, and opacity transitions of all action buttons inside the media viewer modal header (toggle details, copy image, download, and close) to match the dashboard's quick-add plus button.

### 3. Strategic Reasoning
To achieve visual coherence and follow the brand preferences, we unified the button design across the app. We mapped the exact classes from the dashboard plus button:
- Dimension: `w-9 h-9`
- Borders: `border border-[var(--bone-10)]` and hover: `hover:border-[var(--bone-30)]`
- Backgrounds: `bg-[var(--sys-color)]` and hover: `hover:bg-[var(--card-bg)]`
- Icon opacity: `opacity-60 group-hover:opacity-100 transition-opacity`
- Transition timing: `transition-all duration-200`

### 4. Detailed Blueprint
- `src/components/modals/MediaViewerModal.tsx`: Replace classes and layout configuration of the top-right button header control block to use the unified styling schema.

### 5. Operational Trace
- Replaced button markup and styling details inside `MediaViewerModal.tsx` top-right controls container.
- Verified TypeScript build.

### 6. Status Assessment
Completed successfully. All media viewer controls now display with identical styles and hover feedback as the dashboard plus button.
