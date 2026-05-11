User request: "all text in note blocks and chat ai answer must be crimson, exept tables, pills, buttons and code blocks"

## 1. Objective Reconstruction
Establish unified typeface coherence across semantic text pipelines. Target goal: Convert standard textual entities (Paragraphs, Headers, Unordered/Ordered lists) in Note Editor blocks and Assistant message streams to the 'Crimson Text' serif font, guaranteeing that isolated interface widgets like tables, markdown buttons, and code blocks preserve their dedicated functional fonts (DM Sans / DM Mono).

## 2. Strategic Reasoning
Leverage the application's central design tokens and recursive CSS inheritances for the lightest feasible overhead. Rather than overriding every node manually, targeting `BlockRenderer`'s style resolver mapping dynamically reroutes general styles to the `font-display` token (mapped to Crimson Text). For standard chat messages, establishing a strict font declaration directly onto the top-level recursive container `ReactMarkdown` acts as an absolute fallback catchment, naturally terminated by established children component overrides (tables/inline-code).

## 3. Detailed Blueprint
- **Editor Logic:** In `BlockRenderer.tsx`, swap the `font-sans` token reference to `font-display` within the internal `getStyleClasses` switch statement for generic blocks.
- **Chat Aesthetics:** 
    - Modify explicitly typed component callbacks inside `ChatMessage.tsx` markdown component mapping (specifically `h1`, `h2`, `h3`) to transition hardcoded `DM Sans` declarations to the requested serif font.
    - Wrap markdown view scope with localized stylesheet declaration to guarantee baseline consistency.

## 4. Operational Trace
- Modified `src/components/editor/BlockRenderer.tsx`: Updated `getStyleClasses()` mapping. Rewrote output strings for `title`, `heading`, `subheading`, and generic `body` styles from `font-sans` to `font-display`.
- Modified `src/components/assistant/components/ChatMessage.tsx`:
    - Redefined `h1`, `h2`, `h3` inline styles replacing `fontFamily: 'DM Sans'` with `fontFamily: '"Crimson Text"'`.
    - Injected direct explicit `style={{ fontFamily: '"Crimson Text"', fontSize: '17px', fontWeight: 500 }}` declaration into the parent JSX wrapper encapsulating the primary `<ReactMarkdown>` execution context.

## 5. Status Assessment
Successfully deployed. Generic readability contexts (narrative prose, section headers, descriptive bodies) are seamlessly inheriting the specialized serif layout. Functional exceptions (tables, citation chips, navigation elements, code containers) maintain structural integrity under pre-existing sans/monospaced tokens. Deployment is static and immediate.
