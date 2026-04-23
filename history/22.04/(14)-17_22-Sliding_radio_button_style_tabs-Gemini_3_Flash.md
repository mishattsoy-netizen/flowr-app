User request: "fix selected button, make this like radio button that slides between selected items, fix colors"

### 2. Objective Reconstruction
Transform the static widget tab switcher into a dynamic "segmented control" with a sliding pill background. Fix the color contrast issues where active tab text was invisible due to missing theme tokens.

### 3. Strategic Reasoning
To achieve the "sliding" effect without adding heavy dependencies like Framer Motion, I used a relative container with an absolute-positioned "pill" div. This pill's `left` position is dynamically calculated based on the active tab index and animated via standard CSS transitions. For colors, I discovered that `on-accent` was missing from the Tailwind v4 `@theme` block, preventing `text-on-accent` from applying; adding it restored high-contrast visibility.

### 4. Detailed Blueprint
- **Tailwind Theme**: Added `--color-on-accent: var(--on-accent);` to the `@theme inline` block in `globals.css`.
- **Sliding Component**: 
    - Added a `div` for the background pill with `transition-all`.
    - Used `style={{ left: ... }}` for dynamic positioning.
    - Wrapped buttons in `z-10` to ensure they stay above the slider.
- **Typography**: Increased font weight to `font-extrabold` and adjusted tracking for better legibility at small sizes.

### 5. Operational Trace
- Modified `src/app/globals.css` to register missing tokens.
- Refactored `src/components/workspace/widgets/SmartTaskStackWidget.tsx` header section.
- Calculated tab index on the fly to determine slider position.

### 6. Status Assessment
Completed. The switcher now feels like a native radio-button/segmented control with smooth motion and correct colors.
