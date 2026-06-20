User request: "but now when i drop, some other row below is getting stuck with highlighted effect unles i hover and unhover it"

### 0. Date and Time of the Request
18.06.2026 04:37

### 1. User Request
"but now when i drop, some other row below is getting stuck with highlighted effect unles i hover and unhover it"

### 2. Objective Reconstruction
Ensure that after any drop event in the sidebar (including no-ops, early returns, or successful reorders), browser `:hover` state styling is correctly cleared on the row under the cursor.

### 3. Strategic Reasoning
Safari and other WebKit-based browsers latch `:hover` styling onto whatever element lands under the stationary cursor after drag ends. We already had a pointer-events reset block at the bottom of the `onDrop` handler in `Sidebar.tsx` to handle this. However, since the newly introduced no-op checks perform early returns (exiting the function immediately), they were bypassing this reset block. By wrapping the entire `onDrop` processing logic inside a `try-finally` block, we guarantee that the pointer-events disable-enable sequence runs on *every* exit path, clearing all stuck `:hover` styling.

### 4. Detailed Blueprint
- **[Sidebar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/layout/Sidebar.tsx)**:
  - Wrap the main execution logic of the `onDrop` handler inside a `try` block.
  - Place the pointer-events reset block inside the accompanying `finally` block so it is guaranteed to run.

### 5. Operational Trace
- Wrapped `onDrop`'s inner body in `try {} finally {}`.
- Moved the `pointerEvents = 'none'` reset sequence to the `finally` block:
  ```typescript
  finally {
    // Safari latches :hover onto whichever element lands under the stationary
    // cursor after a drop reorders the DOM — clear it by briefly disabling
    // pointer-events so the browser recalculates. (No-op in Chrome.)
    const sb = sidebarRef.current;
    if (sb) {
      sb.style.pointerEvents = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { sb.style.pointerEvents = ''; });
      });
    }
  }
  ```

### 6. Status Assessment
- Verified that all early returns correctly clear visual row highlights upon dropping.
- Walkthrough updated.
