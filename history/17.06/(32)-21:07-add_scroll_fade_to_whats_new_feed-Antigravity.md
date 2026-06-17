User request: "scroll containe should fill al the way to the bottom and all the way to the top with fade out effects like in collumns in kanban"

0. Date and time of the request:
2026-06-17 21:07

1. User request:
"scroll containe should fill al the way to the bottom and all the way to the top with fade out effects like in collumns in kanban"

2. Objective Reconstruction:
Implement full-height vertical scrolling with smooth scroll-fade effects (using custom SVG masking gradients) for the patch updates timeline in both settings modal overlay and full settings page. Prevent page-level scroll double-bars by locking parent scroll context on this tab.

3. Strategic Reasoning:
- **Scrolling Autonomy**: Instead of scrolling the entire modal or page, locking the parent scroll container and dedicating a full-height scroll viewport for the updates feed keeps header and labels static while allowing update cards to scroll.
- **Scroll Fade Unification**: By utilizing the existing `<OverlayScrollbar>` component from [OverlayScrollbar.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/tracker/OverlayScrollbar.tsx) inside [UpdatesSection.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/settings/UpdatesSection.tsx), we get high-performance hardware-accelerated CSS scroll mask transitions (`scroll-fade` utility class setting `data-fade-top` / `data-fade-bottom` dynamically) that match the columns in the Kanban board.
- **Header Pinning**: In both settings modal and settings page, the section header blocks stay fixed, and cards scroll up beneath them, fading out at the header divider border.

4. Detailed Blueprint:
- [src/components/settings/UpdatesSection.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/settings/UpdatesSection.tsx): Replace the wrapper `div` with `<OverlayScrollbar>` component.
- [src/components/modals/SettingsModal.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/modals/SettingsModal.tsx): Condition layout wrapper to remove page scroll and vertical padding when updates tab is active.
- [src/components/settings/SettingsPage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/settings/SettingsPage.tsx): Condition layout wrapper to lock page scroll and enable full-height stretching when updates tab is active.

5. Operational Trace:
- Replaced wrapper divs with `<OverlayScrollbar>` in `UpdatesSection.tsx`.
- Updated container classes in `SettingsModal.tsx` and `SettingsPage.tsx` using conditional styling `cn` to lock height and disable vertical bounds scroll.
- Verified TypeScript compilation: `/Users/mktsoy/.local/bin/node node_modules/typescript/bin/tsc --noEmit` -> Success with 0 errors.

6. Status Assessment:
- The updates list now scrolls independently with scroll-fade effects, filling the panel vertically from top to bottom.
