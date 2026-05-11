User request: "fix plus and drag buttons styles in note, it must be same for all blocks, same as in text blocks or table blocks"

## 1. Objective Reconstruction
Normalize the visual presentation of the `+` (Add) and `::` (Drag) controls across all component variants. Resolve the layout collision where specific visual elements (specifically Code/Mono blocks) forcibly leak their core layout attributes (like background, border, and rounding) onto the adjacent floating controls drawer.

## 2. Strategic Reasoning
Visual inspection verified that when rendering `BlockControls` for a `'mono'` type block, the controls wrapper erroneously inherited the full `getStyleClasses('mono')` token string. This caused the floating drawer to literally assume the code block's stylistic identity—inheriting a dark background, white border, and explicit corner rounding. By decoupling the standard style-definition arrays from the floating utility component, we force the controls back to a pure, unstyled floating status identical to normal text field operations.

## 3. Detailed Blueprint
- **Notes (BlockRenderer.tsx)**: Locate `BlockControls` function definition, eliminate usage of `styleClasses` from the wrapping `div` className array, and prune the now-unused variable reference.

## 4. Operational Trace
- Modified `src/components/editor/BlockRenderer.tsx`:
    - Deleted line coupling the inner `styleClasses` token array to the control layer's standard classes.
    - Cleaned the unused `styleClasses` variable definition.
    - Validated preservation of dynamic `heightClass` required for alignment consistency.

## 5. Status Assessment
Style contamination neutralized. The floating hover widgets will now uniformly present as standalone floating buttons regardless of the attached sibling block type.
