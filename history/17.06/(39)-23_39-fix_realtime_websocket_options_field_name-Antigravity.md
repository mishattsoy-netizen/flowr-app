User request: "@[client.ts:current_problems]"

0. Date and time of the request:
2026-06-17 23:39

1. User request:
"@[client.ts:current_problems]"

2. Objective Reconstruction:
Fix the TypeScript compiler type error in `src/utils/supabase/client.ts` (and `src/lib/supabase.ts`) where the `WebSocket` option was reported as invalid inside `RealtimeClientOptions`. In the Supabase JS Realtime configuration, the WebSocket injection parameter is named `transport`.

3. Strategic Reasoning:
- **Exact Field Matching**: Use the officially defined `transport` field to resolve strict type definition issues for websocket overrides in the Supabase Client.

4. Detailed Blueprint:
- [src/utils/supabase/client.ts](file:///Users/mktsoy/Dev/flowr-app/src/utils/supabase/client.ts): Changed `WebSocket` to `transport` under the `realtime` option block.
- [src/lib/supabase.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/supabase.ts): Changed `WebSocket` to `transport` under the `realtime` option block.

5. Operational Trace:
- Replaced option names in client initialization configurations.

6. Status Assessment:
- Both type compilation errors are successfully resolved.
