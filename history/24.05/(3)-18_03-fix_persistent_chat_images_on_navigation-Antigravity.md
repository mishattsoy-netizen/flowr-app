User request: "i dont see images in chats after i switch pages"

### 0. Date and Time of the Request
- **Date**: 24.05.2026
- **Time**: 18:03 (completion time)

### 1. User Request
"i dont see images in chats after i switch pages"

### 2. Objective Reconstruction
The user reported that uploaded chat images/attachments disappear after navigating away from the chat and returning. When navigating back, the `AIAssistant` mounts and triggers a reload of the conversation from Supabase (`loadConversation` calling `fetchMessages`). Since the database schema has no dedicated `attachments` column, these files were not saved and were thus lost. The objective is to make these attachments persist seamlessly across page navigations without losing any upload data or causing type errors.

### 3. Strategic Reasoning
- **Data Persistence Strategy**: Instead of attempting database schema migrations (which carry risks and require remote Supabase DDL execution privileges), we serialize the message attachments array into a hidden HTML comment at the end of the `content` text field: `\n\n<!-- ATTACHMENTS_JSON:${JSON.stringify(attachments)} -->`.
- **Parsing/Formatting separation**: When retrieving messages from the database, we parse and strip this hidden metadata block before placing the clean string back into the Zustand store's `aiMessages` list. This prevents the raw HTML comment and base64 strings from displaying in the UI or being sent to LLM prompt histories (which avoids token limit overflows).
- **Graceful Fallbacks**: If a message lacks attachments or is incorrectly formatted, the code handles it safely without crashing or throwing runtime exceptions.

### 4. Detailed Blueprint
- **`src/lib/chat.ts`**:
  - Extend the `ChatMessage` interface with `attachments?: any[]`.
  - In `insertMessage`, accept `attachments?: any[]` and serialize it into the payload `content` using the hidden JSON comment block format.
  - In `fetchMessages`, parse the `attachments` back into `ChatMessage.attachments` and remove the comment block from the returned `content` string.
- **`src/data/store.ts`**:
  - In `loadConversation`, include `attachments: m.attachments` in the mapped `aiMessages` state array.
  - In `sendAIMessage`, pass `attachments` as the final parameter to `insertMessage` when persisting user messages.
  - In `saveTempChat`, map `m.attachments` when persisting temporary chat logs to named conversation rows.

### 5. Operational Trace
- Modified `/Users/mktsoy/Dev/flowr-4-main/src/lib/chat.ts` to implement serialization, parsing, and type updates. Corrected strict type error on the implicit `any` parameter inside `fetchMessages` mapping function.
- Modified `/Users/mktsoy/Dev/flowr-4-main/src/data/store.ts` to pass and read `attachments` across the entire chat conversation lifecycles.
- Verified TypeScript compilation successfully via `npx tsc --noEmit` returning exit code `0`.

### 6. Status Assessment
- **Status**: Completed successfully.
- **Verification**: Type checking passed without warnings, ensuring all store actions and DB payloads are strictly compatible.
- **Recommendations**: Clear browser cache and perform a manual verification by uploading an image, switching pages, and verifying it renders perfectly on return.
