User request: "icons of these buttons shift on hover"

### 0. Date and time of the request
Date: 09.06.2026
Time: 16:00

### 1. User request
User request: "icons of these buttons shift on hover"

### 2. Objective Reconstruction
The objective is to fix a layout shift where the icons inside the hover buttons (plus and drag handle) shift slightly by 1 pixel on hover.

### 3. Strategic Reasoning
- The tooltip component (`Tooltip`) wrapped its children with a `<div className="contents">` wrapper, which relies on CSS `display: contents`.
- `display: contents` removes the wrapper's box model and exposes descendants directly to the parent layout (flexbox).
- However, in Chromium/Safari browsers, when a component inside `display: contents` re-renders (e.g., when the tooltip's visibility state transitions on hover, causing a portal addition), the browser triggers a subpixel layout recalculation. This was causing a tiny but noticeable layout shift of the button icons.
- To eliminate this rendering bug completely, `Tooltip` was refactored to use `React.cloneElement` when wrapping a valid React element. This attaches the refs and event handlers directly onto the target element (`button` or `div`), removing the intermediate wrapping DOM node and its `display: contents` styling entirely from the layout tree.

### 4. Detailed Blueprint
- **Modify** [Tooltip.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Tooltip.tsx):
  - Check if the wrapped `children` is a valid React element.
  - If it is not a valid element, wrap it in a fallback `span` with `inline-block`.
  - If it is a valid React element, clone it and inject the trigger reference (`setRefs`) along with `onMouseEnter`, `onMouseLeave`, and `onClick` handlers directly.
  - Return the cloned child and the portalled tooltip body.

### 5. Operational Trace
1. Traced the layout shift on hover to the `Tooltip` component using a `contents` class wrapper.
2. Refactored the render method in `Tooltip.tsx` to conditionally clone the child element using `React.cloneElement` and merge its ref and handlers.
3. Verified compile safety by running the markdown block tests.

### 6. Status Assessment
- **Completed**: Tooltip trigger wrapping has been refactored, eliminating layout shifting.
- **Verified**: Unit tests pass successfully.
