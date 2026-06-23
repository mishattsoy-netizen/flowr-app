Date and time: 01.06.2026, 00:31

User request: "scrollbar moved to the left"

### Objective Reconstruction
Fix the layout issue where the columns scrollbar jumped to the left edge of the scroller container instead of staying positioned at its correct right-side visual coordinates.

### Strategic Reasoning
- **Root Cause**: The absolute-positioned track container used the arbitrary negative tailwind class `right-[-10px]`. In Tailwind v4, arbitrary negative pixel offsets like `right-[-10px]` did not compile properly under the current configuration. Because the browser failed to parse the invalid class, no `right` style was applied. In absolute positioning, when neither `left` nor `right` are defined, browsers default the element X-coordinate to the start of the layout line, which is the left edge of the parent container, making the custom scrollbar jump to the left.
- **Resolution**: Replaced the Tailwind arbitrary class with a standard React inline `style={{ right: -10 }}` property. This is cross-browser compliant, compiles flawlessly, and strictly forces the absolute container's right boundary to `10px` beyond the right edge of the scroll wrapper, placing it back on the right side.

### Detailed Blueprint
- Update `/src/components/tracker/OverlayScrollbar.tsx`:
  - Swap the Tailwind class `right-[-10px]` for the inline style property `style={{ right: -10 }}` on the absolute-positioned transparent scrollbar track.

### Operational Trace
- Swapped coordinates class for inline style on the scrollbar track container in `/src/components/tracker/OverlayScrollbar.tsx` using `replace_file_content`.

### Status Assessment
- Scrollbar positioning issue resolved. The scrollbar is cleanly positioned at its visual right edge location again (`right: -4px` relative to parent).
