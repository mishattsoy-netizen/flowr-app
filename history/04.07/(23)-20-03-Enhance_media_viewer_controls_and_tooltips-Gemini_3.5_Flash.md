### 0. Date and time of the request
Date: 04.07.2026
Time: 20:03 (Start) - 20:03 (End)

### 1. User request
User request: "remove dividers between button and make them bigger and add custom tooltips"

### 2. Objective Reconstruction
Refine the media viewer modal header buttons:
1. Remove all vertical divider lines between buttons.
2. Scale button dimensions up to `w-11 h-11` and inner icons to `w-5 h-5`.
3. Wrap all buttons with custom `Tooltip` components (`position="bottom"`) and remove legacy HTML native `title` tags to prevent duplicate tooltip rendering.

### 3. Strategic Reasoning
To create a clean and prominent UI matching the user's styling inputs:
- Custom `<Tooltip>` wrappers from `@/components/layout/Tooltip` are integrated with dynamic content (e.g. tracking `copied` state for the copy image feedback).
- We set `position="bottom"` for optimal screen visibility.
- Divider bars were removed to make the top-right toolbar a contiguous, clean group of sleek floating action buttons.

### 4. Detailed Blueprint
- `src/components/modals/MediaViewerModal.tsx`:
  - Import the `Tooltip` component.
  - Wrap buttons (Details, Copy Image, Download, Close) with `<Tooltip content="..." position="bottom">`.
  - Scale classes from `w-9 h-9` to `w-11 h-11` and icon sizes to `w-5 h-5`.
  - Remove dividers and standard `title` attributes.

### 5. Operational Trace
- Updated imports and controls markup in `src/components/modals/MediaViewerModal.tsx`.
- Ran compiler checks via `npx tsc --noEmit` and confirmed successful build.

### 6. Status Assessment
Completed successfully. The toolbar looks extremely premium with larger buttons, clean custom tooltips, and no dividers.
