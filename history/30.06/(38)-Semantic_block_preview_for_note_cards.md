User request: "yes" (implement semantic block rendering for note preview cards)

Date/Time: 2026-06-30 21:52

What changed (Dashboard.tsx):
1. Added stripHtml() util - strips <tags>, **bold**, *italic*, `code`, [link](url) and list markers
2. Added NoteBlockPreview component - type-aware renderer for up to 4 blocks per card:
   - text/body: plain truncated line
   - text/title,heading,subheading: bold larger text
   - text/mono: font-mono dark pill
   - bulletList/dashedList: dot + text
   - numberedList: number + text
   - checklist: empty checkbox square + text
   - quote: vertical bar accent + italic text
   - table: 3-bar skeleton (no actual content)
   - image/video: emoji icon + label
   - link: link icon + underlined text
   - divider: thin horizontal line
   - columns: two-bar skeleton
3. Replaced flat bullet list rendering in card with NoteBlockPreview
4. Fixed BlockStyle heading detection: title/heading/subheading (not h1/h2/h3)

Status: TypeScript 0 errors.
