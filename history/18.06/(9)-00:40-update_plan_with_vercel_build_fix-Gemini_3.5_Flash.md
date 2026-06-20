User request: "[Screenshot of Vercel build failure showing DB error loading classifier prompt]"

### 0. Date and time of the request
2026-06-18 00:39

### 1. User request
User request: "[Screenshot of Vercel build failure showing DB error loading classifier prompt]"

### 2. Objective Reconstruction
Incorporate the resolution of the Vercel build prerendering failure (due to direct Supabase proxy lookup) into the implementation plan alongside the sidebar drag scenarios update.

### 3. Strategic Reasoning
Prerendering failures occur during `next build` because the rewrite proxy configured on `https://flowr.website` is not running. On the server side during builds and SSR, the client should query the direct Supabase API endpoint (`https://qmufalwubepttjxehvit.supabase.co`) directly instead of passing requests through the un-started custom domain.

### 4. Detailed Blueprint
- Add the Supabase server-side URL resolution changes to `implementation_plan.md`.
- Detail changes for:
  - `src/lib/supabase.ts`
  - `src/utils/supabase/client.ts`
  - `src/utils/supabase/server.ts`
  - `src/utils/supabase/middleware.ts`

### 5. Operational Trace
1. Updated `implementation_plan.md` using `replace_file_content` to add the Supabase server-side configuration changes and verification steps.

### 6. Status Assessment
The plan is updated and ready for user review.
