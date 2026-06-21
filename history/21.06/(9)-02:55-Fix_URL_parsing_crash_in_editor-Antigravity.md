# 0. Date and time of the request
Date: 21.06.2026
Time: 02:55

# 1. User request
User request: "## Error Type
Runtime TypeError

## Error Message
\"techcrunch.com\" cannot be parsed as a URL."

# 2. Objective Reconstruction
The user encountered a runtime `TypeError` when editing notes with a standard inline link. The error occurred because the string `"techcrunch.com"` is parsed directly with `new URL(activeInlineBtn.url)`, which throws an exception when the URL lacks a protocol (e.g. `http://` or `https://`). The objective is to fix all occurrences of unsafe URL parsing in the note editor, ensuring that raw hostnames or relative paths do not cause Next.js crashes.

# 3. Strategic Reasoning
We resolved the crash by replacing the unsafe `new URL(...)` parsing logic with a pre-existing safe helper function, `getHostname(...)`, defined at the top of [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx). The helper function:
- Trims the URL string.
- Automatically prepends `https://` if it does not start with `http://` or `https://`.
- Safely wraps the `new URL` instantiation in a `try...catch` block to handle completely malformed input and prevent runtime page failures.

# 4. Detailed Blueprint
We identified all unsafe references to `new URL(...)` in `src/components/editor/BlockRenderer.tsx`:
- Line 579: Inside `saveInlineUrl` (already wrapped in a try/catch, but updated to use `getHostname`).
- Line 668: Inside the active link label editor.
- Line 734: Inside the link popover preview image source.
- Line 1097: Inside the Link block render method (already try-catch wrapped, but updated to use `getHostname`).

# 5. Operational Trace
1. Edited [BlockRenderer.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/editor/BlockRenderer.tsx) to replace instances of:
   ```typescript
   new URL(urlStr).hostname
   ```
   with:
   ```typescript
   getHostname(urlStr)
   ```
2. Ran Vitest test suite via `./node_modules/.bin/vitest run src/lib/editor/markdownBlocks.test.ts` to ensure block rendering logic is intact. All 84 tests passed successfully.

# 6. Status Assessment
- **Status**: Completed.
- **Verification**: Tests pass, and potential URL crashes are mitigated.
- **Recommendation**: Clean local cache and restart the dev server to verify in browser.
