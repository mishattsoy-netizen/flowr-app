# Remove `router_chains.platform` (dead column) and simplify admin platform labels

## Summary

`router_chains.platform` (`'app' | 'telegram'`) was added so router config could theoretically differ per surface, but the only function that actually fetches config for a live request — `getRouterChain`/`fetchRouterChainFromDb` in `src/lib/router-config.ts` — hardcodes `.eq('platform', 'telegram')` regardless of caller. The `'app'` rows are dead data, never read at runtime. This was discovered while building mode-based (Default/Pro) router chains: a stale `router_chains_pkey` on `(category, platform)` blocked inserting Pro rows, and while diagnosing it we found `platform` itself was never functional.

Separately, `src/app/admin/logs/actions.ts` and `src/app/admin/bot/feedback/actions.ts` derive a *different* `platform` value from `message_logs.telegram_id` (real, meaningful data — did this message come from the Telegram bot or the web app) and expose it as a 3-way filter/badge in their respective admin pages. This is unrelated to `router_chains.platform` but shares the same confusing name.

This fix removes the dead `router_chains.platform` column and its column-threading throughout the Router Matrix admin UI, and simplifies the two `message_logs`-derived platform displays to not show a filter/badge that's about to be redesigned anyway (a follow-up brainstorm will properly design Telegram as an account-linked connector, which will likely change how Telegram-origin messages are identified).

## Goals

- `router_chains` no longer has a `platform` column; `(category, mode)` becomes the sole unique key.
- `getRouterChain` and all admin Router Matrix code stop passing/threading a `platform` parameter.
- The dead prompt-sync-to-`router_chains.system_prompt` step in `bot/global/actions.ts` is removed (it was already writing to a column `chainRouter` never reads).
- Logs page and Feedback page stop displaying an app/telegram platform filter/badge.

## Explicitly out of scope

- The Telegram bot integration itself (`src/lib/bot/telegram.ts`, `src/app/api/telegram/webhook/route.ts`, `src/lib/bot/notifications.ts`, `src/lib/bot/usageGuard.ts`) — kept as-is, dormant. A follow-up brainstorm will design it as a proper account-linked connector (chat parity with the app, task reminders/notifications).
- `message_logs.telegram_id` column and its data — kept as-is. Not touched because the upcoming Telegram connector design may change how Telegram-origin messages are identified, so redesigning this classifier now would likely be thrown away.
- Any change to `chainRouter.ts`'s actual routing logic, model selection, or the mode-based (Default/Pro) routing work already shipped.

## 1. Schema migration

New migration `supabase/migrations/20260708_drop_router_chains_platform.sql`:

1. Delete rows where `platform = 'app'` (confirmed dead — never read by `getRouterChain`, and the earlier SQL audit showed most were empty `model_list: []` stubs).
2. Drop the `router_chains_category_platform_mode_key` unique index (created during the mode migration) and any remaining constraint referencing `platform`.
3. Drop the `platform` column.
4. Create a new unique index on `(category, mode)`.

This must run **after** confirming (via a `SELECT` audit, done manually before running the migration) that no `platform = 'app'` row contains real data that would be lost — per the earlier investigation in this session, all `app` rows were empty, but the migration script itself will re-verify by logging row counts before deleting, not delete blindly.

## 2. `src/lib/router-config.ts`

- `fetchRouterChainFromDb`: remove `.eq('platform', 'telegram')` from the Supabase query.
- The self-healing insert (for missing VISION/CODING/IMAGE_GEN categories) drops `platform: 'telegram'` from its insert payload.
- `Platform` type (`export type Platform = 'telegram'`) is removed — it was already a single-value union that nothing meaningfully constrained.

## 3. Router Matrix admin UI

Remove the `platform` prop/parameter from the full call chain, since it no longer distinguishes anything real:

- `src/app/admin/router/actions.ts`: `getRouterChains`, `getRouterOrder`, `saveRouterOrder`, `createRouterChain` all drop their `platform` parameter and the corresponding `.eq('platform', ...)` filters.
- `src/app/admin/router/page.tsx`: `RouterPageContent` no longer takes/passes `platform`; the default export calls it with no platform argument.
- `src/components/admin/RouterMatrixGrid.tsx`, `RouterCategoryCard.tsx`, `AddCategoryButton.tsx`, `SortableRouterGrid.tsx`: drop the `platform` prop from each component's interface and JSX usage.

Since there is now exactly one `/admin/router` surface (no more `/admin/app/router` vs `/admin/telegram/router` distinction in practice), the two route paths that both currently render `RouterPageContent` with different platform args should both continue to work and show the same (now platform-less) data — no route deletion needed, both pages simply render identical content, which is harmless and avoids a routing change outside this fix's scope.

## 4. `src/app/admin/bot/global/actions.ts`

Delete the "Compaction prompt → router_chains" sync block (the one upserting `system_prompt` into `router_chains` with `onConflict: 'category,platform'`) entirely. It was writing to a column (`router_chains.system_prompt`) that `chainRouter.ts` never reads — confirmed dead in this session's investigation, unrelated to the static prompt files that actually drive chain prompts.

## 5. Logs and Feedback admin pages

- `src/app/admin/logs/actions.ts`: `getMessageExchanges`'s `platform` option and its `.eq`/`.is`/`.not` filtering on `telegram_id` are removed — the function always returns all messages regardless of origin. `Exchange.platform` field is removed from the returned shape.
- `src/app/admin/logs/LogsTable.tsx`: remove the app/telegram/all filter button group; `Filters.platform` is removed from local state.
- `src/app/admin/bot/feedback/actions.ts`: remove the `platform: l?.telegram_id ? 'telegram' : 'app'` derivation from the returned log shape.
- `src/app/admin/bot/feedback/FeedbackClient.tsx`: remove the `log.platform === 'app'` conditional badge/label rendering.

`message_logs.telegram_id` itself is untouched — only the UI surfaces derived from it are simplified, since a real classifier may still be useful later but the current 3-way toggle isn't earning its keep before the Telegram connector redesign.

## Testing

- Manual: Router Matrix page loads, shows all 12 categories with working Default/Pro toggle, same as current behavior minus the platform grouping.
- Manual: creating a new Pro override chain still works (regression check against the constraint bug fixed earlier this session).
- Manual: Logs page loads and lists messages without a platform filter; Feedback page loads without a platform badge.
- Unit/integration: verified (via `grep -rln "platform" --include="*.test.ts" src/`) that no existing test file references `platform` — no test updates needed as part of this change.
