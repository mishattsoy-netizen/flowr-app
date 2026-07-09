User request: "wdym Synced Telegram conversations (stored with null space_id values) are now loaded in the sidebar when querying 'ws-personal' workspace using a PostgREST .or('space_id.eq.ws-personal,space_id.is.null') filter.. it means that telegram session only apear in default worksapce ws-personal?"

### Date and Time
09.07.2026, 15:02

### Objective Reconstruction
Make newly created/synced Telegram bot conversations inherit the user's current `profiles.active_space_id` database field value, enabling workspace routing for Telegram chats.

### Strategic Reasoning
- The user pointed out that defaulting synced chats to `null` `space_id` would lock them into the `'ws-personal'` default space sidebar, even if they switch active spaces.
- By querying the user's `active_space_id` from their profile during webhook updates/inserts, newly created chats are saved directly to the user's currently active workspace.

### Detailed Blueprint
- **[route.ts](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/app/api/telegram/webhook/route.ts)**: Fetch `active_space_id` from `profiles` in `syncTelegramMessages` and `startNewSession` and bind it to the `space_id` database column.

### Operational Trace
1. Updated `syncTelegramMessages` and `startNewSession` to read `active_space_id` and map it during conversation insert.
2. Verified TypeScript compilation and Vitest test suite pass successfully.

### Status Assessment
- **Completed**: Telegram chats are synced to the active space dynamically.
