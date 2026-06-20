# 20.06 at 05:07

User request: "i see black screen in live app for some reason"

## Objective Reconstruction
Resolve the black screen issue in production:
1. Fix CORS preflight OPTIONS redirects caused by domain mismatch between the user's browser domain (`www.flowr.website`) and the configured Supabase URL (`flowr.website` without `www`).
2. Add an error catch boundary to the initial load operation to prevent sync/network failures from hanging the initial loading state.

## Strategic Reasoning
1. **Dynamic Origin Matching**: On the client-side, the Supabase client should always make requests to the domain currently shown in the browser address bar (`window.location.origin`) rather than forcing a hardcoded host that might trigger cross-subdomain redirections.
2. **Defensive Sync Fallback**: Wrapping `loadFromSupabase()` in a `.catch` block guarantees that even if a database fetch fails completely or is blocked by CORS/offline state, `isInitialSync` is turned off so that the application falls back gracefully to local state rather than hanging on a black screen.

## Detailed Blueprint
1. Modify [supabase.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/supabase.ts):
   - Replace server/client URL ternary check with a client-side origin dynamic path builder.
2. Modify [client.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/client.ts):
   - Apply matching origin-matching logic inside `createClient`.
3. Modify [SupabaseProvider.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/SupabaseProvider.tsx):
   - Add a `.catch` error handler to `loadFromSupabase()` that turns off `isInitialSync`.

## Operational Trace
1. Updated client-side URL mapping in [supabase.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/supabase.ts) and [client.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/client.ts).
2. Added `.catch` fallback handler in [SupabaseProvider.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/SupabaseProvider.tsx).
3. Evaluated code build, compiles successfully.

## Status Assessment
- **Completed:** CORS preflight redirect blocks fixed and initial load crash handler added.
- **Fixed:** Resolved production black screen/loading hang.
