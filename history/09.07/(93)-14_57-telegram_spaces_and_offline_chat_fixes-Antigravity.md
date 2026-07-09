User request: "Fix desktop chats, they dont show artifact/tool use cards like in the web. also verify telegram bot, why i dont see session from telegram apear in the sidebar in wep app and desktop, and verify that telegram bot sees raw history(i dont hink he does), the compaction limits and token counting must apply to telegram chat exactly like in the web. Add /spaces command for telegram bot to switch spaces, but use defaul space by default"

### Date and Time
09.07.2026, 14:57

### Objective Reconstruction
Implement the following fixes and features:
1. Enable offline local-only fallback storage and message loading when Supabase database is disabled/unavailable.
2. Render visual tool cards and artifacts for client-side executed XML tool blocks in offline desktop chats.
3. Fix visibility of synced Telegram bot sessions in the personal space (`ws-personal`) sidebar.
4. Align Telegram history fetching with web app sessions to apply raw history token compaction and limits.
5. Add the `/spaces` command to the Telegram bot to list and switch active spaces.

### Strategic Reasoning
- When Supabase is null or disabled (offline/desktop mode), we check `isSupabaseEnabled` and use local Zustand stores and states as a fallback rather than throwing exceptions or reverting to temp-only modes.
- Synced Telegram chats are created in Supabase with `null` `space_id`. We query both `'ws-personal'` and `null` space IDs when loading personal space conversations so they show in the sidebar.
- We map executed client-side XML tags to `toolResultItem` and push them into the message object's `toolResults` array inside the XML interceptor to trigger card rendering.
- For history loading, if a user has a linked UUID session, we prioritize fetching the history from `getWebConversationMemory` to align token compaction exactly with the web app, and supply the `_triggerType` context parameter to differentiate Telegram calls.

### Detailed Blueprint
- **[chat.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/chat.ts)**: Add null-checks for `supabase` client and fallbacks in `fetchConversations`, `createConversation`, `updateConversationTitle`, `deleteConversation`, `fetchMessages`, and `insertMessage`. Change space filter to load null space conversations under `'ws-personal'`.
- **[store.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/data/store.ts)**: Intercept XML tool outputs, construct a `toolResultItem`, and append it to `toolResults` in `chatMessagesMap`. Check `isSupabaseEnabled` in conversation fetch, select, delete, send, and save operations.
- **[telegram-commands.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/telegram-commands.ts)**: Register the `/spaces` command and define its parser.
- **[route.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/app/api/telegram/webhook/route.ts)**: Add the `/spaces` action handler to query user spaces from the database, show space lists (with active/default states), and update the profile's active space.
- **[memoryManager.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/services/memoryManager.ts)** and **[chainRouter.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/lib/bot/chainRouter.ts)**: Pass `_triggerType` to fetch history via `getWebConversationMemory` when Telegram triggers history loading.

### Operational Trace
1. Modified `src/lib/chat.ts` to return mock objects or empty lists if `supabase` is null, and updated space filtering query.
2. Updated `src/data/store.ts` to fetch local storage conversations/messages when offline, bypass database calls, and mapped client XML tool tags directly into the message `toolResults` metadata.
3. Added the `/spaces` command parser to `src/lib/bot/telegram-commands.ts` and the webhook handler to `src/app/api/telegram/webhook/route.ts`.
4. Modified `src/lib/bot/services/memoryManager.ts` and `src/lib/bot/chainRouter.ts` to fetch history using UUID sessions.
5. Fixed type casting for collection space checks in `src/data/store.helpers.ts` and test file property names in `store.addEntity.test.ts`, `store.moveEntity.test.ts`, and `store.setSyncMode.test.ts`.
6. Verified TypeScript type checking and Next.js production builds.
7. Successfully executed unit tests, validating all 225 test cases pass successfully.

### Status Assessment
- **Completed**:
  - Offline fallback modes for chat storage and creation.
  - Interactive XML tool cards inside offline desktop chats.
  - Personal space Telegram conversation syncing in the sidebar.
  - Token compaction, history, and token counting logic in Telegram bot.
  - `/spaces` command on the Telegram bot.
- **Tests**:
  - `npx tsc --noEmit` compiles 100% cleanly.
  - `npx vitest run` passes all 225/225 test cases.
  - `npm run build` production build succeeds.
