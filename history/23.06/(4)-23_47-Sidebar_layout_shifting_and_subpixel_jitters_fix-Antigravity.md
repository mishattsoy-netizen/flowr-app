User request: "dont push if i dint tell you!! now rows shift properly but left side of the row stays in one pace and right side is scaling on click, it ust scale ion the center, not pinned to left"

### 0. Date and time of the request
Date: 23.06.2026
Time: 23:47

### 1. User request
User request: "dont push if i dint tell you!! now rows shift properly but left side of the row stays in one pace and right side is scaling on click, it ust scale ion the center, not pinned to left"

### 2. Objective Reconstruction
Resolve inconsistent layout shifting and subpixel font/icon jitter inside sidebar rows (workspaces, folders, tasks, pages, and sessions) during hover and click states on low-DPI displays. Symmetrically scale rows from the center center (rather than left-aligned), preserve MacBook's click-scale feedback, prevent git pushes, and bump the patch version to `1.4.6.2`.

### 3. Strategic Reasoning
- **Centered Scaling**: Restoring `transform-origin: center center` satisfies the user's feedback to scale symmetrically from the center of the row rather than pinning the left edge.
- **Hardware Acceleration**: By applying `will-change: transform`, `transform: translate3d(0,0,0)`, and `backface-visibility: hidden` to `.sidebar-item-row`, we force the browser to composite each row on its own GPU layer. This keeps the text vectors rasterized as a static texture during transforms, preventing character alignment and kerning recalculations (which cause subpixel shifting and layout jitter on low-DPI screens).
- **Consolidated Classes**: Consolidating all duplicate `.sidebar-item-row` overrides in `globals.css` prevents rule conflicts.
- **Immediate Transitions**: Replacing `transition-all` on row buttons in `Sidebar.tsx` with static styles ensures hover color highlights change instantly (0ms), satisfying the branding guideline while avoiding transition stutters.
- **Dynamic Styling Suppression**: Removing dynamic font weight (`font-medium`) and spacing (`tracking-wide` / `letter-spacing`) from active states prevents text box width expansions that cause trailing items (like utility plus/chevron/options buttons) to shift on selection.
- **Version Bumping**: Incrementing the version name to `"flowr-beta-1.4.6.2"` correctly tracks the patch progression.
- **Git Push Deferral**: Staging and committing changes locally without pushing to GitHub.

### 4. Detailed Blueprint
- **[globals.css](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/app/globals.css)**: Consolidate `.sidebar-item-row` styling, apply center-centered origin, hardware acceleration, and the `:active` scale state.
- **[TreeItem.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/layout/TreeItem.tsx)**: Add `border-t border-x border-solid border-transparent bg-clip-padding` (matching the horizontal layout alignment of other sidebar items) to prevent horizontal shifts while restoring exactly a 1px vertical gap between highlights, and strip dynamic `tracking-wide` from active states.
- **[Sidebar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/layout/Sidebar.tsx)**: Strip dynamic active `tracking-wide` classes and remove `transition-all` on row buttons.
- **[admin/Sidebar.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/admin/Sidebar.tsx)**: Remove dynamic active `font-medium` and `tracking-wide` classes.
- **[package.json](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/package.json)**: Update version string to `flowr-beta-1.4.6.2`.
- **[SettingsModal.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/modals/SettingsModal.tsx)**: Update footer version string.
- **[SettingsPage.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/settings/SettingsPage.tsx)**: Update footer version string.
- **[patches.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/data/patches.ts)**: Document `1.4.6.2` patch details.

### 5. Operational Trace
- consolidation of duplicate `.sidebar-item-row` classes in `globals.css` into a single GPU-composited declaration using `transform-origin: center center`.
- Removed `transition-all` from button elements in `Sidebar.tsx`.
- Removed dynamic `font-medium` and `tracking-wide` overrides from active/selected states in `TreeItem.tsx`, `Sidebar.tsx`, and admin `Sidebar.tsx`.
- Bumped patch version across `package.json`, modal, settings page, and `patches.ts` from `1.4.6.1` to `1.4.6.2`.
- Ran Vitest suite with command: `npx vitest run --exclude "**/.claude/**"`.
- Verified that all 118 unit tests passed successfully.

### 6. Status Assessment
- **Completed**: Symmetrical hardware-accelerated centering scale fixes implemented. All dynamic layout class changes stripped. All unit tests passed. Local versions updated.
- **Awaiting**: User confirmation to commit and push changes to GitHub.
