User request: "why production app doesnt show favicon?"

### 0. Date and time of the request
2026-06-18 00:24

### 1. User request
User request: "why production app doesnt show favicon?"

### 2. Objective Reconstruction
Analyze the Next.js workspace and deployment configuration to identify the technical cause of the favicon not rendering in the production build (`https://flowr.website`).

### 3. Strategic Reasoning
Examined standard Next.js asset resolution, browser image-rendering specifications for SVG favicons, and repository-specific service worker / router configuration. Identified that Safari and other browsers lack support for pure SVG favicons without `.ico` fallback, next.js layout metadata structure is missing explicit type annotations for `.svg`, and the service worker does not precache the resource.

### 4. Detailed Blueprint
1. Check file existence in `/public`.
2. Inspect `layout.tsx` metadata config for `icons`.
3. Check `sw.js` for precaching / caching strategies.
4. Recommend solutions for compatibility:
   - Generate and provide `/favicon.ico` as fallback.
   - Use App Router file-based convention (`app/icon.svg`).
   - Or configure the `icons` metadata field with MIME types explicitly.

### 5. Operational Trace
1. Scanned directory `/public` for favicons: found `favicon.svg` but no `favicon.ico`.
2. Inspected `src/app/layout.tsx` metadata and found the configuration:
   ```ts
   icons: {
     icon: "/favicon.svg",
     shortcut: "/favicon.svg",
     apple: "/favicon.svg",
   }
   ```
3. Verified browser compatibility: Safari does not support SVG favicons without `.ico` fallbacks.
4. Verified that Next.js requires explicit metadata type objects to serve type="image/svg+xml" when defined inline, or using `/app/icon.svg` file-based routing.

### 6. Status Assessment
Identified three root causes: missing legacy/Safari fallback (`favicon.ico`), metadata SVG definition missing `type="image/svg+xml"`, and service worker cache configuration omissions.
