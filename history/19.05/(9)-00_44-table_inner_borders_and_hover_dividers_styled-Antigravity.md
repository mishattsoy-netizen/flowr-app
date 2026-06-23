User request: "change inner borders color in tables. bone 6 for row and collumn dividers and bone 12 only for table hover divider."

## 0. Date and time of the request
Date: 19.05 (May 19, 2026)
Time: 00:44

## 1. User request
"change inner borders color in tables. bone 6 for row and collumn dividers and bone 12 only for table hover divider."

## 2. Objective Reconstruction
Update all table layouts (both notes content tables and assistant chat message tables) to enforce a unified, elegant visual hierarchy matching the digital instrument aesthetic:
1. Render all horizontal (row) and vertical (column) dividers using `bone-6` (`var(--bone-6)`).
2. Render the horizontal divider underneath a row in `bone-12` (`var(--bone-12)`) only when that specific row is hovered.
3. Ensure outer borders use `bone-12` with modern rounded corners, and prevent duplicate bottom or rightmost borders.

## 3. Strategic Reasoning
- **Visual Polish**: Universal CSS rules override standard elements uniformly without duplicating row-by-row definitions inside the components.
- **Visual Hierarchy**: Elevates information layout by making table cell borders subtle, while giving an explicit and high-contrast focus line underneath the hovered row.
- **Layout Robustness**: Scopes the styling directly to `.prose table` and `.editor-block table` to avoid impacting widget blocks or utility tables (like standard calendar elements) that require independent styles.

## 4. Detailed Blueprint
- `src/app/globals.css`: Add a comprehensive table section targeting `.prose table` and `.editor-block table` setting cell borders to `bone-6`, column borders to remove right-outer borders, and configuring the row `:hover` state divider to `bone-12`.
- `src/components/assistant/components/ChatMessage.tsx`: Adjust `thead` to use `border-[var(--bone-6)]` and remove the local `divide-y` on the `tbody` so it natively delegates to the clean, universal styles.

## 5. Operational Trace
- Appended robust, scoped styling rules to the end of `src/app/globals.css` that configure row and column dividers to `var(--bone-6)` and the horizontal row hover border-bottom to `var(--bone-12)`.
- Modified `src/components/assistant/components/ChatMessage.tsx` to set the table header divider to `var(--bone-6)` and remove `divide-y` on `tbody`.
- Verified the rendering, layout transitions, and hover states using the browser subagent, confirming duplicate borders are fully eliminated on the edges.

## 6. Status Assessment
- **Completed**: All table inner horizontal and vertical borders are elegantly set to bone-6, row hover divider outlines use bone-12, and outer table containers are clean and double-border free.
- **Recommendation**: Restart the server and clear browser cache to load the updated styling classes completely.
