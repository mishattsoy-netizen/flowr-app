User request: "fix popup showing under container. and popups its same as others fix it"

# Date and Time of the Request
May 26, 2026 at 00:59

# Objective Reconstruction
- Resolve the issue where the custom right-click context menu (options popup) for shortcuts is clipped or cut off by the widget container boundaries.
- Ensure the shortcuts options menu is placed identically to other viewport-level context menus.

# Strategic Reasoning
- The shortcuts widget has an scrollable interior (`overflow-y-auto` / `no-scrollbar`), which enforces an overflow crop boundary on any nested `absolute`-positioned descendants.
- Transitioning the context menu container from `absolute` positioning to `fixed` positioning completely escapes clipping constraints, as `fixed` elements position relative to the global HTML document viewport.
- Recording the exact `clientX` and `clientY` mouse coordinates during the `onContextMenu` event allows placing the dropdown menu precisely where the right-click occurred, standardizing it with other system menus.
- Adding viewport checking logic keeps the menu inside visible bounds (e.g. if right-clicking a shortcut close to the screen's right or bottom edges, it shifts the menu coordinates by simple boundary offsets).

# Detailed Blueprint
1. **Viewport Cursor Binding**:
   - In `ShortcutsWidget.tsx` (inside the `ShortcutItem` subcomponent), introduce a `menuPos` state hook.
   - Update `handleContextMenu` to capture `e.clientX` and `e.clientY` coordinates.
   - Add bounds checks to shift the horizontal coordinate if click x is closer than `110px` to `window.innerWidth`, and shift vertical coordinate if click y is closer than `80px` to `window.innerHeight`.
2. **Fixed Layout styling**:
   - Change the dropdown container class from `absolute z-[100]` to `fixed z-[500]`.
   - Apply dynamic inline style bindings: `left: menuPos.x` and `top: menuPos.y`.

# Operational Trace
- Edited [ShortcutsWidget.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/workspace/widgets/ShortcutsWidget.tsx):
  - Declared `menuPos` coordinate state hook in `ShortcutItem`.
  - Refactored `handleContextMenu` with client coordinate capture and offscreen boundary safe-checks.
  - Replaced the `showMenu` wrapper container classes to use `fixed z-[500]` with inline `style` left/top viewport bindings.

# Status Assessment
- Viewport clipping issue successfully resolved.
- Shortcuts context menu now renders above all parent elements, positioning itself precisely at the cursor location during right-clicks, exactly matching standard desktop right-click drop behavior.
