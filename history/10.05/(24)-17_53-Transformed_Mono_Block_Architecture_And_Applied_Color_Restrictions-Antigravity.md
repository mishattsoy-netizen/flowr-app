User request: "change mono block style, it should ook like text block with filled bacgkround, so whole block acts like container/card same as table block. also dont color option for this type of blocks(database, simple tables, Media blocks, embed blocks...)"

## 1. Objective Reconstruction
Elevate the 'Mono' code block format from a simple inline text container to a full-width structured "Card" entity adhering to the visual dimensions of Database and Table blocks. Simultaneously harden the Block Options system by stripping color-formatting capabilities from strict architectural block archetypes (Databases, Tables, Media, Embeds, and Mono blocks) that implement hardcoded thematic wrappers.

## 2. Strategic Reasoning
Mono blocks historically suffered visual indentation because they were processed within the generic Text wrapper context's standard padding (`px-4`). By conditionalizing the core wrapper logic within `BlockRenderer`, we can liberate Mono content to occupy the component's full horizon while standardizing `py-2` vertical padding, achieving 1:1 parity with robust system components like Tables. Stripping the `Color` sub-menu from `BlockOptionsMenu` prevents end-users from injecting incompatible inline styles that break predetermined container aesthetics.

## 3. Detailed Blueprint
- **Block Configuration:** In `BlockOptionsMenu.tsx`, append strict conditional rendering logic surrounding the `<Paintbrush> Color` button to logically evaluate `block.type` and `block.style` against banned lists.
- **Layout Transformation:** In `BlockRenderer.tsx`, replace standard iterative paddings in the generic block generator to natively detect `effectiveStyle === 'mono'`, yielding container widths and heights distinct from standard paragraph formatting.

## 4. Operational Trace
- Modified `src/components/editor/BlockOptionsMenu.tsx`: Wrapped the "Color" sub-menu button with defensive checks excluding block types `database`, `table`, `image`, `video`, `embed`, and the `text:mono` variant.
- Modified `src/components/editor/BlockRenderer.tsx`:
    - Adjusted parent layout to extend to `py-2` only when `mono` configuration detected.
    - Recoded internal layout container `className` conditional switch to remove `px-4 py-1` insets for `mono`, freeing the pre-defined card visuals to scale outward to grid boundaries.
    - Disabled base-level hover triggers for `mono` to guarantee standard system highlights do not stack or conflict with the existing card boundaries.

## 5. Status Assessment
Deployment verified. Mono code blocks are successfully promoted to full-fledged container status, properly nested copy-buttons and overflow behavior intact. Aesthetic controls locked across restrictive formats.
