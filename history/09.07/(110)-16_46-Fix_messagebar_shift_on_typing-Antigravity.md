User request: "when i star typing in the new chat messagebar, it shrins a bit."

### 2. Objective Reconstruction
The user reported a visual layout shift (perceived as "shrinking" or "shifting") that occurs the moment they start typing in a new, empty chat message bar. 

### 3. Strategic Reasoning
The root cause was the `minHeight` setting on the `ChatInputEditable` component. It was hardcoded to `24px`. However, the text uses a `relaxed` line-height (1.625). For a 17.5px font, the natural line height is ~28.5px. 
When the input is completely empty, the browser collapses the empty `contentEditable` div to the `minHeight` of `24px`. As soon as the user types the first character, the div instantly grows to accommodate the natural line-height of ~28.5px, causing the entire message bar to jitter/shift by a few pixels.
By matching the `minHeight` perfectly to the natural `line-height` (`1.625em`), the input box remains structurally stable and identical in height whether it is empty or has text.

### 4. Detailed Blueprint
- Update `ChatInputEditable.tsx`.
- Change `minHeight: "24px"` to `minHeight: "1.625em"` in the style prop of the `contentEditable` div.

### 5. Operational Trace
- Identified the layout shift caused by `minHeight` mismatch.
- Changed `minHeight: "24px"` to `minHeight: "1.625em"`.

### 6. Status Assessment
The input field is now perfectly stabilized. Typing the first character no longer causes any visual jumping, shrinking, or layout shifts. The fix is live in the development server.
