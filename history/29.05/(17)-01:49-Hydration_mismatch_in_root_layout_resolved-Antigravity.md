User request: "## Error Type
Console Error

## Error Message
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <HotReload globalError={[...]} webSocket={WebSocket} staticIndicatorState={{pathname:null, ...}}>
      <AppDevOverlayErrorBoundary globalError={[...]}>
        <ReplaySsrOnlyErrors>
        <DevRootHTTPAccessFallbackBoundary>
          <HTTPAccessFallbackBoundary notFound={<NotAllowedRootHTTPFallbackError>}>
            <HTTPAccessFallbackErrorBoundary pathname="/auth/call..." notFound={<NotAllowedRootHTTPFallbackError>} ...>
              <RedirectBoundary>
                <RedirectErrorBoundary router={{...}}>
                  <Head>
                  <__next_root_layout_boundary__>
                    <SegmentViewNode type="layout" pagePath="layout.tsx">
                      <SegmentTrieNode>
                      <link>
                      <script>
                      <script>
                      <script>
                      <script>
                      <script>
                      <script>
                      <RootLayout>
                        <html lang="en" suppressHydrationWarning={true} className="literata_d...">
                          <head>
                            <script
                              dangerouslySetInnerHTML={{
+                               __html: "(function() {\n              try {\n                const str = localStorage...."
-                               __html: ""
                              }}
-                             id="exodus-extension"
-                             src="chrome-extension://aholpfdialjgjfhomihkjbmgjidlcdno/inapp.js"
-                             data-extension-id="aholpfdialjgjfhomihkjbmgjidlcdno"
-                             data-prioritize-exodus="true"
                            >
                          ...
                  ...



    at script (<anonymous>:null:null)
    at RootLayout (src/app/layout.tsx:60:9)

## Code Frame
  58 |     >
  59 |       <head>
> 60 |         <script
     |         ^
  61 |           dangerouslySetInnerHTML={{
  62 |             __html: `(function() {
  63 |               try {

Next.js version: 16.2.4 (Turbopack)"

### 0. Date and time of the request
May 29, 2026 at 01:48

### 1. User request
The user submitted a Next.js hydration mismatch console error stack trace originating in root layout (`src/app/layout.tsx:60:9`).

### 2. Objective Reconstruction
The objective was to eliminate a hydration mismatch error caused by third-party browser extensions (e.g., the Exodus Web3 wallet extension `id="exodus-extension"`) injecting external `<script>` elements into the layout `<head>` tag prior to React mounting.

### 3. Strategic Reasoning
1. **Hydration Matching & Injectors**: React compares the server-rendered DOM to the actual browser DOM during hydration. When browser extensions inject script elements into the `<head>` tag before React mounts, React's hydration parser aligns these injected scripts with our layout script tags, producing false-positive hydration discrepancies due to mismatching properties and inner HTML.
2. **Defensive Suppressing**: Standardizing `suppressHydrationWarning` on `<head>` and layout `<script>` tags signals React to bypass property/mismatch checks for those nodes. This resolves extension-driven hydration warnings completely without impacting performance or semantic layout structure.

### 4. Detailed Blueprint
- **`layout.tsx`**:
  - Add `suppressHydrationWarning` to the `<head>` element.
  - Add `suppressHydrationWarning` to both `<script>` tags in the root layout (the inline theme config script and the Puter API client script).

### 5. Operational Trace
1. **Modified [layout.tsx](file:///Users/mktsoy/Dev/flowr-app/src/app/layout.tsx)**:
   - Modified `<head>` to `<head suppressHydrationWarning>`.
   - Appended `suppressHydrationWarning` to the inline theme-loader `<script>`.
   - Appended `suppressHydrationWarning` to the external Puter API `<script>` at the bottom of `<body>`.
2. **Validated type safety & test paths**:
   - Ran `npx tsc --noEmit` which completed successfully with exit code `0`.
   - Executed `npm run test` and confirmed all 44 unit tests pass cleanly.

### 6. Status Assessment
- **Completed**: Resolved root layout hydration warning mismatch completely, making the Next.js mount phase fully resilient to custom user script extensions.
- **Active state**: Typecheck green, unit tests passing.
