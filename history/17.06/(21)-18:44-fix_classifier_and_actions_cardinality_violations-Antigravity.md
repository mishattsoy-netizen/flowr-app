User request: "## Error Type\nRuntime Error\n\n## Error Message\n{code: \"21000\", details: Null, hint: ..., message: ...}\n\nNext.js version: 16.2.4 (Turbopack)"

0. Date and time of the request:
2026-06-17 18:44

1. User request:
"## Error Type
Runtime Error

## Error Message
{code: "21000", details: Null, hint: ..., message: ...}

Next.js version: 16.2.4 (Turbopack)"

2. Objective Reconstruction:
Fix further `21000` (cardinality violation) runtime errors triggered when loading settings pages or classifier functions with duplicate rows in the database.

3. Strategic Reasoning:
- The previous fix resolved cardinality issues inside `getRouterChain`. However, the Next.js server actions (`src/app/admin/router/actions.ts`) and the intent classifier (`src/lib/bot/classifier.ts`) also perform direct `.maybeSingle()` queries on settings and bot_settings tables.
- If these tables contain multiple records for keys (like `router_temperatures`, `pipeline_status_messages`, `pipeline_settings`, `classifier_prompt`, etc.), they will throw the 21000 cardinality violation error when queried.
- Applying `.limit(1)` before `.maybeSingle()` prevents PostgREST from receiving multiple rows, ensuring safe execution even on duplicate keys.

4. Detailed Blueprint:
- Update all `.maybeSingle()` settings queries in `src/app/admin/router/actions.ts` to use `.limit(1)`.
- Update all `.maybeSingle()` bot_settings queries in `src/lib/bot/classifier.ts` to use `.limit(1)`.

5. Operational Trace:
- Modified `src/app/admin/router/actions.ts` to restore the code and safely inject `.limit(1)` into the 8 settings query methods.
- Modified `src/lib/bot/classifier.ts` to include `.limit(1)` in the 3 classifier queries.
- Executed typescript compile command `node node_modules/typescript/bin/tsc --noEmit` -> Success, 0 errors.

6. Status Assessment:
- Both the admin actions and intent classifier are fully protected against `21000` cardinality errors.
- Verification passed cleanly.
