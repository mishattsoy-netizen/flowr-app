User request: "also bot should be able to use dm mono when needed, not only in code blocks, also he should be able to use different text/ arrows and other elements color opacity for accent, or better visibility- bone30 bone 60 and bone 100(default)."

### 2. Objective Reconstruction
1.  **DM Mono Font**: Allow the bot to switch to the monospace font (DM Mono) for arbitrary text fragments, not just within markdown code blocks.
2.  **Color/Opacity Control**: Enable the bot to specify text and element colors using the project's design tokens: `bone30` (30% opacity), `bone60` (60% opacity), `bone100` (full opacity/default), and the `accent` color (with optional opacity).
3.  **Dynamic Arrows**: Ensure that arrows (e.g., `->`) inherit the currently active color and font style from their surrounding context while remaining visually distinct.

### 3. Strategic Reasoning
*   **Style Stack Architecture**: To handle nested formatting (e.g., mono text that is also semi-transparent), I implemented a stack-based parser. As the parser encounters tags like `[m]` or `[30]`, it pushes the corresponding Tailwind classes onto the stack. Closing tags pop them off.
*   **Contextual Overrides**: By wrapping styled text in `<span>` tags with specific Tailwind classes and inline styles (for font overrides), we ensure that these manual bot instructions take precedence over the default `Crimson Text` typography.
*   **Unified Parser**: Renaming `renderContentWithArrows` to `renderContentWithStyles` reflects the transition from a single-purpose utility to a comprehensive formatting engine.

### 4. Detailed Blueprint
*   **ChatMessage.tsx**:
    *   Defined `STYLE_REGEX` to capture arrows and new formatting tags: `[m]`, `[30]`, `[60]`, `[100]`, `[a]`, `[a30]`, `[a60]`.
    *   Implemented `renderContentWithStyles`:
        *   Maintains a `stack` of CSS classes.
        *   Detects arrows and applies the top color from the stack (defaulting to accent).
        *   Wraps text segments in `<span>` with active stack classes.
        *   Explicitly sets `fontFamily: 'DM Mono'` when the mono tag is active.
    *   Updated `p`, `li`, and `h1-h3` renderers to use the new unified parser.

### 5. Operational Trace
*   Modified `src/components/assistant/components/ChatMessage.tsx`:
    *   Replaced `ARROW_REGEX` with a more inclusive `STYLE_REGEX`.
    *   Implemented the stack-based `renderContentWithStyles` function.
    *   Updated all markdown component overrides to call `renderContentWithStyles(children)`.
    *   Ensured arrows detect and use the active color from the formatting stack.

### 6. Status Assessment
*   **DM MONO**: ENABLED via `[m]...[/m]`.
*   **BONE COLORS**: ENABLED via `[30]...[/30]`, `[60]...[/60]`, `[100]...[/100]`.
*   **ACCENT COLORS**: ENABLED via `[a]...[/a]`, `[a30]...[/a30]`, `[a60]...[/a60]`.
*   **NESTED FORMATTING**: SUPPORTED.
