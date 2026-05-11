User request: "change notes and chat formatting. i attached images how it looks like right now and here are references... no dont show ** syntext, just text... here is the chat history when we were working on chat and notes forrmating and some other things, you can analyze all my messages, build a timeile from this and recover same edits"

## Objective Reconstruction
Fulfill the final user mandates for aesthetic consistency and functional correctness:
1. Completely strip/parse raw markdown syntax (like `**bold**`) from appearing as literal characters in Note Editor Table Cells.
2. Implement the high-fidelity Code Block Header with language designation and copy button in agent chat responses.
3. Standardize Chat and Note Table styling: remove the accidental monospace font cascade, adopt DM Sans globally, and visually distinguish the first column with semi-bold text.

## Strategic Reasoning
1. **Note Editor Formatting Persistence**: The Note Editor utilizes browser-native `contentEditable` backed by innerHTML. The literal appearance of `**` markers occurred because parsed markdown string data was never run through a simple inline token converter before instantiation. By implementing `inlineMarkdownToHtml`, tokens become persistent HTML tags instantly upon parsing, preventing them from ever being revealed as source code to the end user.
2. **Code Container Hierarchy**: Overhauled the flat ReactMarkdown `<pre>` definition to incorporate a flex-header container for proper visual segregation between meta-data/actions and code literals.
3. **Typographical Separation**: Enforced system font stacks in all table components, removing the legacy monospace definitions. Applied semantic styling hooks (`first:font-semibold`) to ensure row-level clarity visually matching user reference imagery.

## Detailed Blueprint
### Files Touched
1. **`src/lib/utils/markdownToBlocks.ts`**: Create `inlineMarkdownToHtml` helper and hook into text/table parser generators.
2. **`src/data/store.helpers.ts`**: Import same parser to restore parity for duplicate generation routes.
3. **`src/components/editor/BlockRenderer.tsx`**: Upgrade Table cells to use `dangerouslySetInnerHTML` & force font styling.
4. **`src/components/assistant/components/ChatMessage.tsx`**: Implement Code Header wrapper logic and revamp standard Table component parameters.

## Operational Trace
### Markdown Parser Enhancement
- Created `inlineMarkdownToHtml` using aggressive regex mapping for bold, italic, inline code, and hyper-links.
- Updated both `markdownToBlocks.ts` and `store.helpers.ts` to map raw contents through the formatter prior to block assembly.

### Note Editor Table Upgrade
- Changed existing `textContent` assignments to `innerHTML` retrieval on user blur events to capture nested HTML tags.
- Added explicit `ci === 0` conditional targeting to add `font-semibold text-bone-100` classes.
- Set `dangerouslySetInnerHTML` as source for table content rendering.

### Chat Visual Polish
- Overhauled Markdown `code` block rendering to define a standalone wrapper `div` with a fixed top header.
- Mapped `/language-(\w+)/` capture to extract descriptive labels for the header bar.
- Transformed Markdown `td` declaration to apply `font-sans text-[13px] first:font-semibold first:text-bone-100`.

## Status Assessment
**COMPLETED**.
1. Literal `**` syntax is now properly filtered and converted into rendered HTML strong tags across the entire note engine.
2. Code blocks in chat now utilize proper encapsulated container aesthetics with header meta-information.
3. Tables across the platform use high-fidelity DM Sans hierarchies with emphasized leftmost columns.
