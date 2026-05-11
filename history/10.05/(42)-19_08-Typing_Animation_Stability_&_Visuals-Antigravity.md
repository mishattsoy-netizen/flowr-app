User request: "fix typing answer animation, boc must be bone 100, he cant be used in the containers like table and meadia but can be use in code blocks, its inconsistant sometimes dissaears and sometimes getting stuck and sometimes getting diplicates. make sure its stable and consistant. and make sure that when answer caontain text no matter what chain, play typing animation"

### 2. Objective Reconstruction
1.  **Cursor Visuals**: Change the inline typing cursor color to `bone100`.
2.  **Container Filtering**: Explicitly prevent the cursor from appearing inside tables and media elements, while ensuring it renders correctly within code blocks.
3.  **Animation Stability**: Resolve issues with disappearing, stuck, or duplicate cursors by refining the terminal-node detection logic.
4.  **Guaranteed Animation**: Ensure the typing effect plays for all text-based assistant responses, even for very fast chains that might otherwise appear instantly.

### 3. Strategic Reasoning
*   **Monochromatic Consistency**: Updating the cursor color to `bone100` aligns it with the primary typography of the application.
*   **Terminal Node Precision**: Duplicates and "stuck" cursors are usually caused by multiple components (e.g., a `p` and a nested `strong`) both claiming to be at the "end" of the current stream. By removing the cursor from inline-only elements and focusing it on block-level containers (`p`, `li`, `code`, `headings`), we ensure a single, stable cursor.
*   **Freshness Threshold**: Fast responses often mount when `isAILoading` is already false. By introducing a 2-second "freshness" window based on the message timestamp, we can force the typing loop to run for these messages, providing a consistent UX across all AI chains.

### 4. Detailed Blueprint
*   **globals.css**: Updated `.ai-cursor-inline` color to `var(--bone-100)`.
*   **ChatMessage.tsx**:
    *   Updated `isInitiallyFinished` logic to include an `isFresh` check (2s window).
    *   Refined `isAtEnd` helper to include a 1-character margin for offset mismatches.
    *   Removed cursor logic from `strong` and `em`.
    *   Ensured cursor logic is present in `p`, `li`, `code` (both inline and block), and `h1-h3`.
    *   Ensured `isAILoading` is checked for `li` to prevent ghost cursors on historical messages.

### 5. Operational Trace
*   Modified `src/app/globals.css`: Changed cursor color.
*   Modified `src/components/assistant/components/ChatMessage.tsx`:
    *   Added `isFresh` constant.
    *   Updated `markdownComponents` map to selectively render the `ai-cursor-inline` span.
    *   Fixed a logic error in `code` component that caused duplicated children.
    *   Standardized `atEnd` checks across block components.

### 6. Status Assessment
*   **CURSOR VISUALS**: Corrected to Bone 100.
*   **STABILITY**: Improved via block-only rendering.
*   **ANIMATION**: Guaranteed for all recent messages.
