User request: "in the setgings modal in the connectors add section with ability to connect telegram and if connected show status connected"

### 2. Objective Reconstruction
The user requested adding a "Telegram" integration block inside the "Connectors" tab of the Settings Modal/Page. It needs to check if the user's Telegram account is linked and display the connection status ("Connected as @username" or instructions to connect via the bot). It should also include the ability to disconnect.

### 3. Strategic Reasoning
I added a new server action `getTelegramConnectionStatus` in `src/app/auth/telegram-link/actions.ts` to fetch the current user's Telegram connection status directly from the `telegram_users` table without needing complex RLS policies (since the server action uses `supabaseAdmin`).
I then built a new `TelegramConnector.tsx` client component with a modern UI matching the rest of the settings panels. It uses the server action to show the connected state or instructions for linking (`/link` via the bot). Finally, I integrated this new component into both `SettingsModal.tsx` and `SettingsPage.tsx` under the Connectors tab, replacing the empty placeholder text.

### 4. Detailed Blueprint
- Add `getTelegramConnectionStatus` server action returning connected state, ID, and username.
- Create `src/components/settings/TelegramConnector.tsx` with a loading state, connected status, and a "Disconnect" button hooked up to `unlinkTelegramAccount`.
- Update `src/components/modals/SettingsModal.tsx` to render `<TelegramConnector />`.
- Update `src/components/settings/SettingsPage.tsx` to render `<TelegramConnector />`.

### 5. Operational Trace
- Added the server action.
- Wrote the React component `TelegramConnector` using SVG icons and matching Tailwind styles.
- Replaced the placeholder empty states in the settings views with the new component.

### 6. Status Assessment
The Connectors tab now fully features a functional and aesthetically integrated Telegram connector UI, displaying real-time connection status and allowing disconnection.
