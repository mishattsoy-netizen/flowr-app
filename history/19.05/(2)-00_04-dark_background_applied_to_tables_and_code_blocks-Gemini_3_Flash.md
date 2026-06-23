User request: "use dark color as bg color for all tebles and code blocks in chat and note"

### 0. Date and Time of the Request
- **Date**: 19.05.2026
- **Time**: 00:04

### 1. User Request
User request: "use dark color as bg color for all tebles and code blocks in chat and note"

### 2. Objective Reconstruction
- Change the background color of all tables and code blocks in both the assistant chat window (`ChatMessage.tsx`) and the notes/document editor (`BlockRenderer.tsx`) to a distinct, deep, solid dark tone.
- Enforce premium UI/UX hierarchy and visual contrast so these content blocks stand out beautifully against the main workspace canvas.

### 3. Strategic Reasoning
- Previously, tables, code blocks, and script outputs in both notes and chat streams used `bg-[var(--color-dark)]`, which mapped directly to `#191917` (the primary application canvas background). This caused these block elements to visually merge with the main workspace background, reducing layout structural clarity and scanning efficiency.
- By updating `--color-dark` inside `globals.css` to `#0c0c0b` (a rich, deeply saturated, slightly warm pitch-black charcoal), we construct a premium 3-tier visual depth hierarchy:
  1. **Panel Level** (sidebar, widget cards): `#262624` (lighter, floating).
  2. **Base Level** (workspace backdrop): `#191917` (medium).
  3. **Recessed Level** (tables, code blocks, tool run scrollboxes): `#0c0c0b` (deep, solid dark).
- This creates an exceptionally modern and readable layout where technical code blocks and dense data tables sink elegantly into the canvas, bordered cleanly by the existing warm `var(--bone-12)` overlays.

### 4. Detailed Blueprint
- File to modify: `src/app/globals.css`
- Target property: `--color-dark`
- Action: Redefine `--color-dark` from its baseline value of `#191917` to `#0c0c0b`.

### 5. Operational Trace
- Scanned the codebase for references to `color-dark` to assess impact. Verified it is exclusively utilized for:
  - Markdown table container wraps and block-level `code` wrappers inside chat messages (`ChatMessage.tsx`).
  - Active tool calling output containers and script block previewers inside chat messages (`ChatMessage.tsx`).
  - Mono-pill/code container blocks and editable simple tables inside notes (`BlockRenderer.tsx`).
- Used `replace_file_content` to surgically update the CSS variable definition inside `globals.css` from `#191917` to `#0c0c0b`.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Verification**: Toggling code blocks and tables in the chat stream or notes editor now renders them with the elegant recessed dark background `#0c0c0b` immediately via hot reloading, ensuring beautiful contrast and visual consistency across the entire app.
