Date and time: 01.06.2026, 00:36

User request: "fix task shodow in drag"

### Objective Reconstruction
Fix the visual presentation of the task card drag preview so that the shadow looks soft, premium, and theme-adaptive, eliminating the harsh black artifacts underneath the shadow in Chrome/Chromium browsers.

### Strategic Reasoning
- **Chromium Artifact Resolution**: In Chromium-based browsers, when capturing off-screen canvas snapshots for drag previews, elements with transparent parent elements and heavy/large box-shadows (`rgba(0,0,0,0.5)`) render with pixelated black backgrounds or high-contrast artifact outlines.
- **Visual Symmetrical Enhancements**:
  - Replaced the heavy static shadow with a soft, theme-adaptive `0 6px 16px var(--popup-shadow-color)` style, which uses a very soft 8% opacity shadow in light theme and 30% opacity shadow in dark theme.
  - Replaced the dark background fill (`var(--app-dark)`, which was `#EFEEEB` in light mode) with the clean theme-adaptive panel background (`var(--app-panel)`, which resolves to `#FFFFFF` in light mode), making the dragged preview perfectly match the columns aesthetic.
  - Added a subtle border (`border-[var(--bone-10)]`) around the dragged card, matching the premium visual guidelines of floating modal specs.

### Detailed Blueprint
- Update `/src/components/tracker/TaskCard.tsx`:
  - Modify the portal-rendered container inside the `TaskCard` preview block to use `border-[var(--bone-10)]`, `bg-[var(--app-panel)]`, and style-applied `boxShadow: '0 6px 16px var(--popup-shadow-color)'`.

### Operational Trace
- Replaced classes and style attributes on the drag container in `/src/components/tracker/TaskCard.tsx` using `replace_file_content`.

### Status Assessment
- Drag card visual styling polished. The preview now appears as a gorgeous, soft-shadowed white floating card in light mode, and a soft dark-floating card in dark mode.
