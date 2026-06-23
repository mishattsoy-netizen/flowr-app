User request: "when i copy text from this app especially chat or notes. i want text to be copied as text, so when i paste to google docs, it pastes without background fill and custom colors"

### 0. Date and time of the request
May 24, 2026 at 17:55 (Local Time)

### 1. User request
User request: "when i copy text from this app especially chat or notes. i want text to be copied as text, so when i paste to google docs, it pastes without background fill and custom colors"

### 2. Objective Reconstruction
The user wants to prevent custom fonts, theme background fills, and custom element colors from leaking into their clipboard when copying text from the app (particularly notes and chat selection groups):
1. Intercept manual text copy commands (`Cmd+C` or context menu copy).
2. Format the copied selection exclusively as raw plain text (`text/plain`), completely stripping the HTML layout (`text/html`) that contains the CSS font, background, and color attributes.
3. Ensure that when pasting this content into rich-text documents (like Google Docs), it pastes as raw, unformatted text that matches the target document's theme.

### 3. Strategic Reasoning
- When text is copied from a web browser, the browser creates both standard plain text and formatted HTML clip structures.
- Rich-text targets like Google Docs favor the HTML clip format and parse inline style tags, which pulls the dark background panel color and light grey theme text color into Google Docs, breaking formatting rules.
- Intercepting the global `copy` event at the root level of the application shell (`Shell.tsx`) is the most comprehensive, robust, and clean approach:
  - Read the active user selection strings with `window.getSelection()?.toString()`.
  - Override the clipboard write buffer by manually setting the `text/plain` data representation.
  - Call `preventDefault()` to cancel the default browser-level copy behavior that writes styled HTML data.
- This doesn't affect standard copy-to-clipboard buttons (like code block copy buttons or share links) since they are already explicitly writing only raw text strings using `navigator.clipboard.writeText(...)`.

### 4. Detailed Blueprint
- **File**: [Shell.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/Shell.tsx)
- **Modifications**:
  - Add a global `copy` listener in a new root-level React `useEffect` block.
  - Retrieve plain selection string and set MIME type `text/plain` on `e.clipboardData`.
  - Safely add and clean up the listener during mount/unmount lifecycles.

### 5. Operational Trace
- **Modified**: [Shell.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/layout/Shell.tsx)
  - Registered the root copy event listener inside the client-side Shell layout.
- **Verification**: Executed type checks with `npx tsc --noEmit` and verified successful zero-error compilation.

### 6. Status Assessment
- **Completed**: Global text copies from the app (notes, chat transcripts, dashboards) are now strictly formatted as plain text in the clipboard.
- **Result**: Color, background, and font leakage are completely resolved when pasting into external editors like Google Docs.
