User request: "so mode only chages models that will answer?"

### 2. Objective Reconstruction
Confirm to the user that the chat mode only affects which AI models are selected to answer the query.

### 3. Strategic Reasoning
Re-verified `route.ts`, `chainRouter.ts`, and `router-config.ts` to ensure no other side-effects exist for the `mode` parameter. It is strictly used to query the `router_chains` table for a specific `model_list`.

### 4. Detailed Blueprint
- Answer with a direct confirmation.
- Keep it brief.

### 5. Operational Trace
1. Verified that `mode` is only passed to `getRouterChain` to query `model_list` and returned for analytics logging.

### 6. Status Assessment
The user's mental model of the chat mode architecture is now accurate.
