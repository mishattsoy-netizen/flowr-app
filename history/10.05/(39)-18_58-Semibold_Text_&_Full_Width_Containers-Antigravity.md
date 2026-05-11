User request: "add ability for bot to use not only bold but semibold text aswell" and "tables, code, media and other dcontainers must always be full width"

### 2. Objective Reconstruction
1.  **Semibold Text**: Enable the bot to render semibold text alongside bold text in chat responses.
2.  **Full Width Containers**: Ensure that tables, code blocks, media elements (images), and UI proposal cards span the full width of the message content area, preventing them from appearing constrained or squished.

### 3. Strategic Reasoning
*   **Semibold Logic**: Markdown naturally supports two forms of emphasis for strong text (`**` and `__`). By mapping `**` to `bold` (700) and `__` to `semibold` (600) within the custom `ReactMarkdown` component, we provide the bot with a semantic way to vary visual weight.
*   **Full Width Layout**: Large data containers (tables, code) and visual elements (images) provide a better reading experience when they maximize horizontal space. By applying `w-full` to their respective wrapper components and ensuring their internal layout (like `pre` or `table`) also fills the parent, we eliminate artificial constraints.

### 4. Detailed Blueprint
*   **ChatMessage.tsx**: 
    *   Update `strong` renderer to check the raw markdown source (`targetContent`) for double underscores to toggle `font-semibold`.
    *   Add `w-full` to the `table` wrapper `div`.
    *   Add `w-full` to the `code` block wrapper `div`.
    *   Add `w-full` to `ApplyNoteCard` and `ApplyCanvasCard` containers.
*   **ChatImage.tsx**:
    *   Add `w-full` to the root `div` wrapper for image previews.

### 5. Operational Trace
*   Modified `src/components/assistant/components/ChatMessage.tsx`:
    *   Refactored `strong` component: `isSemibold` now correctly detects `__` by looking at the substring of `targetContent` at the node's offset.
    *   Updated `table` component: Replaced `max-w-full` with `w-full`.
    *   Updated `code` component: Added `w-full` to the container `div`.
    *   Updated `ApplyNoteCard` and `ApplyCanvasCard`: Added `w-full` to root `div` and inner `pre`.
*   Modified `src/components/assistant/components/ChatImage.tsx`:
    *   Added `w-full` to the main container `div`.

### 6. Status Assessment
*   **Semibold Support**: ACTIVE. Bot can now use `__text__` for semibold and `**text**` for bold.
*   **Container Layout**: FULL WIDTH. All major block-level containers now stretch to the edges of the message content.
*   **Visual Polish**: Tables and code blocks now have more room to breathe, especially when nested in lists.
