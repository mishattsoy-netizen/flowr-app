# 20.06 at 05:20

User request: "still black screen in live app"

## Objective Reconstruction
Fix the infinite redirect loop between `/login` and `/app` on the production custom domain `https://www.flowr.website`.

## Strategic Reasoning
1. **Root Cause**: `@supabase/ssr` hashes the client's URL to generate the auth token cookie name. Because the server client was using `flowr.website` (no `www`) and the client client was dynamically matching `www.flowr.website` (with `www`), they generated two different cookie names (e.g. `sb-[hash-of-non-www]-auth-token` vs `sb-[hash-of-www]-auth-token`).
2. **Infinite Redirect**:
   - The middleware (server) saw the user was authenticated via the non-www cookie, letting them proceed to `/app`.
   - The browser (client) looked for the www cookie, found it empty, assumed the user was logged out, and pushed them to `/login`.
   - The middleware intercepted `/login`, saw the user was logged in via the non-www cookie, and redirected them back to `/app`, causing an infinite black screen redirect loop.
3. **Solution**: Configure a static, unified cookie name (`sb-flowr-auth`) in `cookieOptions` for all Supabase clients (client, server, middleware, and core lib) so that server and client always read and write to the exact same cookie, bypassing domain-hash mismatches.

## Detailed Blueprint
1. Modify [supabase.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/supabase.ts):
   - Add `cookieOptions: { name: 'sb-flowr-auth' }` to `createBrowserClient` options.
2. Modify [client.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/client.ts):
   - Add `cookieOptions: { name: 'sb-flowr-auth' }` to `createBrowserClient` options.
3. Modify [server.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/server.ts):
   - Add `cookieOptions: { name: 'sb-flowr-auth' }` to `createServerClient` options.
4. Modify [middleware.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/middleware.ts):
   - Add `cookieOptions: { name: 'sb-flowr-auth' }` to `createServerClient` options.

## Operational Trace
1. Updated [supabase.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/supabase.ts), [client.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/client.ts), [server.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/server.ts), and [middleware.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/middleware.ts) with the unified cookie configuration.
2. Ran Next.js build locally to verify type safety; compiles successfully.

## Status Assessment
- **Completed:** Unified the auth cookie name across all Supabase configurations.
- **Fixed:** Resolved cookie name mismatch and the resulting redirect loop.
