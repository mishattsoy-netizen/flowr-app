User request: "Why thi shappens in desktop app. instantly as i send requqest"

### 2. Objective Reconstruction
Explain why the desktop application instantly displays a "System Overload (Classifier: all models exhausted...)" error when the user sends a message.

### 3. Strategic Reasoning
Analyzed the codebase, error messages, and Electron runtime logs. The error occurs because `supabaseAdmin` is null on the Next.js standalone server process inside the packaged Electron app, leading to a TypeError that causes the classification chain to fail instantly.

### 4. Detailed Blueprint
- Analyze `src/lib/bot/classifier.ts` where the "all models exhausted" message is thrown.
- Inspect `src/lib/supabase.ts` to see how `supabaseAdmin` is initialized.
- Check `electron/main.js` and `.env` loading behavior.
- Check if `.env` exists in the packaged production Electron app.
- Check `C:\Users\misha\AppData\Local\Temp\flowr-server-stderr.log` to identify the runtime exception.

### 5. Operational Trace
1. Grepped for `all models exhausted for mode` and located it in `src/lib/bot/classifier.ts`.
2. Traced the loop in `classifyIntentWithModel` and found that each model request calls `getProviderKeys` from `src/lib/vault.ts`.
3. Observed that `getProviderKeys` uses `supabaseAdmin.from(...)`.
4. Checked the startup/server error logs at `C:\Users\misha\AppData\Local\Temp\flowr-server-stderr.log` and found the following crash stack:
   `Classification failure [openai/gpt-4o-mini]: Cannot read properties of null (reading 'from')`
5. Verified that `supabaseAdmin` is null. This is because `process.env.SUPABASE_SERVICE_ROLE_KEY` is not defined in the Next.js process.
6. Checked the packaged ASAR (`app.asar`) on the user's system and found that `.env` is NOT packaged (`false`), because `electron-builder` ignores hidden dotfiles by default.
7. Consequently, the Next.js standalone process inside Electron starts without any environment variables, causing `supabaseAdmin` to be null and all classification models to crash immediately.

### 6. Status Assessment
The root cause has been diagnosed and detailed. Since the user only asked "why" it happens, we provided a complete diagnostic explanation.
