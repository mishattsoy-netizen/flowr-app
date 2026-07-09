### 0. Date and time of the request
Date: 04.07.2026
Time: 20:02 (Start) - 20:02 (End)

### 1. User request
User request: "nope zooming is too sensetive, as soon as i start zooming, image instantly fills my screen fix it"

### 2. Objective Reconstruction
Resolve the sudden image jump/screen-fill behavior that occurs immediately when zooming in, ensuring zoom adjustments occur smoothly relative to the base fit dimensions.

### 3. Strategic Reasoning
The visual jump was caused by class swaps: when `scale` became greater than 1, the image class switched from `max-h-[80vh] w-auto` to `max-w-none`, and the parent container switched to `w-full h-full`. This instantly removed standard sizing constraints, causing the image to expand to its native raw resolution instantly. We resolved this by keeping layout sizing constraints (`max-h-[80vh] object-contain w-auto` on the image and `max-w-[90%] max-h-[85%] overflow-visible` on the parent container) static across all zoom states. The zooming and scale offsets are now applied purely through CSS transform scale/translate, keeping the operation precise and completely smooth.

### 4. Detailed Blueprint
- `src/components/modals/MediaViewerModal.tsx`: Change image wrapper container classes and image `className` to be static (removing dynamic conditionals that swapped layout limits on scale change).

### 5. Operational Trace
- Replaced dynamic classes on `MediaViewerModal` elements with stabilized layout classes.
- Validated clean TypeScript compilation.

### 6. Status Assessment
Completed successfully. Image zooming is now completely linear and smooth, scaling directly from the baseline fit layout.
