User request: "can we rome _cupabase from url, i want url to be clean and premium"

0. Date and time of the request:
2026-06-17 23:35

1. User request:
"can we rome _cupabase from url, i want url to be clean and premium"

2. Objective Reconstruction:
Remove the temporary `_supabase` path prefix from custom routing. Set up clean Next.js proxy rewrites for Supabase's base namespaces (`/auth/v1/`, `/rest/v1/`, `/storage/v1/`) directly mapping to the Supabase domain, and update configuration files and documentation to use the clean origin domain (`flowr.website` / `localhost:3000`) instead.

3. Strategic Reasoning:
- **Premium URLs**: Utilizing paths like `/auth/v1` instead of `/_supabase` removes visual indicators of database hosting providers from address-bar transitions.
- **WebSocket Direct Access**: Real-time websocket protocols are configured to bypass the Next.js rewrite proxy (since Next.js lacks native websocket proxy routing) by passing the direct Supabase websocket endpoint to client-side initialization options.
- **Router Isolation**: Keeping the Next.js router from intercepting auth rewrites prevents route collisions since local pages reside under `/auth/callback` instead of `/auth/v1/...`.

4. Detailed Blueprint:
- [next.config.ts](file:///Users/mktsoy/Dev/flowr-app/next.config.ts): Replaced the broad `_supabase` rewrite rule with clean URL rewrites for `/auth/v1/`, `/rest/v1/`, and `/storage/v1/`.
- [public/sw.js](file:///Users/mktsoy/Dev/flowr-app/public/sw.js): Whitelisted the clean endpoints in service worker caching exception rules.
- [src/utils/supabase/client.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/client.ts): Added direct WebSocket connection endpoint for client-side subscription calls.
- [src/lib/supabase.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/supabase.ts): Implemented realtime option targeting the direct Supabase websocket backend.
- [.env](file:///Users/mktsoy/Dev/flowr-app/.env): Changed `NEXT_PUBLIC_SUPABASE_URL` to local dev origin `http://localhost:3000`.
- [docs/auth-custom-domain-setup.md](file:///Users/mktsoy/Dev/flowr-app/docs/auth-custom-domain-setup.md): Updated OAuth callback settings instructions to use `https://flowr.website/auth/v1/callback`.

5. Operational Trace:
- Modified `next.config.ts` rewrite mappings.
- Edited `sw.js` network-only passthrough conditions.
- Added custom WebSocket URL to `createClient` and `supabase` instances.
- Updated env variables to local origin without path prefix.
- Rewrote domain branding setup guide paths.

6. Status Assessment:
- Supabase proxy URLs have been successfully premium-branded and cleaned up.
