User request: "Fix hydration error: In HTML, <div> cannot be a descendant of <p> in LogsTable"

## Date and time of the request
11.05.2026 16:12

## User request
"Fix hydration error: In HTML, <div> cannot be a descendant of <p> in LogsTable"

## Objective Reconstruction
Resolve a hydration mismatch and invalid DOM nesting error in the `LogsTable` component where Markdown content containing images (wrapped in `div`s) was being rendered inside `<p>` tags.

## Strategic Reasoning
React and Next.js enforce strict HTML nesting rules. A `<p>` tag cannot contain block-level elements like `<div>`. Since the `ReactMarkdown` component defaults to using `<p>` for paragraphs, and our custom overrides for images use `<div>` for styling, we must override the paragraph component itself to use a `<div>` instead of a `<p>`.

## Detailed Blueprint
- **src/app/admin/logs/LogsTable.tsx**: Updated the `components.p` override in `ReactMarkdown` to return a `<div>` with equivalent styling instead of a `<p>`.

## Operational Trace
- Analyzed the browser console error trace to pinpoint the nesting violation.
- Modified the paragraph renderer in the Markdown configuration.

## Status Assessment
- [x] Hydration error resolved.
- [x] Invalid DOM nesting fixed.
