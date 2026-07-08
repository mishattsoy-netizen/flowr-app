User request: "what are modes default and pro in chat changing?"

### 2. Objective Reconstruction
Explain the architectural differences and effects of the "Default" and "Pro" chat modes in the application.

### 3. Strategic Reasoning
Investigated the codebase, particularly `src/app/api/ai/chat/route.ts`, `src/lib/bot/chainRouter.ts`, and `src/lib/router-config.ts`. The `mode` parameter determines which model chains are fetched from the `router_chains` database table and affects the instructional tone in the system prompt.

### 4. Detailed Blueprint
- Read `src/lib/router-config.ts` to identify `getRouterChain`.
- Examined `router-chains.json` to view prompt differences.
- No code was changed.

### 5. Operational Trace
1. Searched for `mode` in `src/app/api/ai/chat/route.ts`.
2. Located the `mode` parameter being passed to `getRouterChain` in `src/lib/bot/chainRouter.ts`.
3. Observed `fetchRouterChainFromDb` using `mode` to filter chains in the `router_chains` Supabase table.
4. Noted the `system_prompt` referencing the mode for determining "tone and depth".

### 6. Status Assessment
The user's question has been answered accurately based on the current implementation in the codebase.
