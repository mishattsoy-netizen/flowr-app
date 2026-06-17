User request: "@[supabase.ts:current_problems]"

0. Date and time of the request:
2026-06-17 23:38

1. User request:
"@[supabase.ts:current_problems]"

2. Objective Reconstruction:
Fix the TypeScript compiler type error in `src/lib/supabase.ts` (and `src/utils/supabase/client.ts`) where `url` was passed under `realtime` client options. Since `@supabase/supabase-js`'s `RealtimeClientOptions` does not accept `url` but does accept `WebSocket`, implement a custom `ProxyWebSocket` class that wraps the native browser `WebSocket` constructor to rewrite target urls on-the-fly to the direct Supabase websocket server, bypassing Next.js ws proxy limitations.

3. Strategic Reasoning:
- **Type Safety**: Avoids type check bypasses (`@ts-ignore`) and follows `RealtimeClientOptions` types exactly.
- **WebSocket Route Resolution**: Since Next.js dev server rewrites cannot proxy WebSocket handshakes out of the box, overriding `WebSocket` client-side allows direct-to-backend WebSockets for real-time features like `.subscribe()` channels.
- **Isomorphic Support**: The `ProxyWebSocket` is safely wrappered with checking `typeof window !== 'undefined'` to avoid runtime reference errors during server-side build compilation.

4. Detailed Blueprint:
- [src/lib/supabase.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/supabase.ts): Implemented `ProxyWebSocket` class extending `window.WebSocket` and passed it as `realtime.WebSocket` inside options.
- [src/utils/supabase/client.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/client.ts): Done the same configuration update.

5. Operational Trace:
- Replaced incorrect `realtime: { url }` structure with custom `ProxyWebSocket` mapping.
- Verified syntax correctness.

6. Status Assessment:
- The TypeScript error is resolved.
