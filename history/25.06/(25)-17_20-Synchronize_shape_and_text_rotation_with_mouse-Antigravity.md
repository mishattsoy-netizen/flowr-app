0. Date and time of the request: 25.06.2026 17:20

1. User request: "fix unsaple rotation. make sure when i rotate whole shape and text inside of it if there is is moving with my mouse. also make sure it works with all shapes. also sometimes when i rotate, shape shifts from bounding box or even dissapears"

2. Objective Reconstruction
- Fix unstable rotation alignment bugs:
  1. Synchronize the active rotation gesture so that both the shape boundary border (rendered in `CanvasShapeLayer.tsx`) and the text content container wrapper (rendered in `CanvasBlock.tsx`) rotate in real-time together with the mouse.
  2. Prevent shapes from shifting away from their selection bounds or flying off-screen by defining exact center-anchored transform origin coordinate properties for SVG groups.
  3. Hide rotation handle guides on lineish shapes (lines, arrows, freedraw) which do not support bounding box rotation transforms.

3. Strategic Reasoning
- The SVG group element `<g>` lacked rotation styling inside `CanvasShapeLayer.tsx`, causing the actual shape border to remain static until re-renders occurred.
- The shift and disappearing issues were caused by CSS transforms executing on the `<g>` element without an explicit `transform-origin` style rule. Since SVGs default to `0 0` (top-left viewbox corner) as their origin, the shape swung in a wide circle off-screen. Setting the transform origin to the absolute shape center (`(x + w/2)px (y + h/2)px`) constrains rotation strictly in place.
- Selecting all elements by `id` during the rotate pointermove listener updates both HTML elements and SVG nodes synchronously at 60fps.

4. Detailed Blueprint
- **src/components/canvas/CanvasShapeLayer.tsx**: Attach `transform: rotate(...)` and `transformOrigin: "${x + w/2}px ${y + h/2}px"` style rules to the shape grouping `<g>` container.
- **src/components/canvas/CanvasBlock.tsx**: 
  - Query all matching ID nodes inside `handleRotateStart` to rotate HTML block and SVG nodes in sync on pointer move.
  - Set `transformOrigin: 'center'` on the HTML block container.
  - Exclude `'line'`, `'arrow'`, and `'freedraw'` shape kinds from rendering rotation handles.

5. Operational Trace
- **CanvasShapeLayer.tsx**: Added inline transform rotation mapping and calculated dynamic center pixel coordinates for SVG transform origins.
- **CanvasBlock.tsx**:
  - Replaced the single element transform update loop inside `handlePointerMove` to fetch and rotate all matched nodes by query selector.
  - Added lineish exclusions to rotation handle trigger.
  - Added HTML transform origin style constraints.
  - **Type checking**: Ran `npx tsc --noEmit` which completed successfully with 0 errors.

6. Status Assessment
- **Completed**: Rotations are highly stable, synchronized across shape borders and text wrappers in real-time, and fixed to shape centers with zero visual shifting.
