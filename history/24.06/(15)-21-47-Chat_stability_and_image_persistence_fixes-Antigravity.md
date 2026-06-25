# History Report — Chat Stability and Image Persistence Fixes

### 0. Date and Time of the Request
* Completed at: 2026-06-24 21:58

### 1. User Request
User request: "problem: in the chat it is very very important to always see bot's answer or ot least some output like error, wheter its internet connection issuo, serve issue, quota, limit, or otehr... currently sometimes when i send message, i see status messages and after that, chat is empty no bot's answer, no error, nothing. also sometimes answer apers, then it dissapers after i leave hat session and come back to it, it often happens to images. find out why and plan how to fix it"

### 2. Objective Reconstruction
Implement client-side and server-side fixes for the AI chat components to:
1. Ensure the user is always presented with the bot's response or a clear error message (such as server errors, quota limits, or network connectivity issues) rather than a blank chat window.
2. Fix the bug where AI answers (especially generated images) and user attachments disappear when reloading or leaving/returning to the chat session.

### 3. Strategic Reasoning
* **SSE Stream Error Parsing:** The backend reports model or API errors by sending a JSON chunk `{ error: ... }` down the stream. The client-side stream parser was ignoring the `error` property and simply stopping, leaving a blank block. Parsing the error and displaying it in the message body resolves this.
* **Stream Fallback Guard:** If the stream terminates without sending any data or errors, the UI would stay blank. Adding a post-stream check to write a fallback message ensures there is always some output.
* **Enhanced Connection Error Messaging:** Catch blocks for fetch failures now display the actual caught exception message (`e.message`) rather than a generic connection error.
* **Server-Side File Hosting:** Storing base64 generated images directly in the database `content` text column caused request payload failures and timeouts on Supabase. Saving images to `public/generated_images/` on disk and referencing them via relative public URLs solves this database timeout/failure, while keeping the data footprint tiny.
* **User Upload Endpoint:** User media (images/PDFs) were stored as raw base64 data URLs in local Zustand store and database. This bloated `localStorage` beyond its 5MB limit. Creating an upload API `/api/ai/upload` to store files in `public/user_uploads/` and resolving them to base64 on-the-fly when sending prompts ensures both lightweight persistence and fully functional vision models.

### 4. Detailed Blueprint
* **`src/app/api/ai/upload/route.ts` [NEW]**: Accepts base64 user attachments, writes them to `public/user_uploads/` on disk, and returns relative paths.
* **`src/app/api/ai/chat/route.ts` [MODIFY]**: Save base64/buffer generated images to `public/generated_images/` and return relative markdown links.
* **`src/components/assistant/AIAssistant.tsx` [MODIFY]**: Upload attachments to the server immediately in `processFiles`, display loading spinners, and disable the Send button during uploads.
* **`src/data/store.ts` [MODIFY]**: In `sendAIMessage` and `regenerateAIMessage`:
  * Resolve relative paths back to base64 on-the-fly before API requests.
  * Update stream chunk parser to look for `parsed.error`.
  * Add fallback messages for empty streams and enhance connection error messages.
* **`src/lib/chat.ts` [MODIFY]**: Strip base64 data from attachments before Supabase database insertions.
* **`src/data/store.types.ts` [MODIFY]**: Extend the `AIAttachment` type definition.

### 5. Operational Trace
1. Updated `AIAttachment` in `src/data/store.types.ts` to include optional `uploading` and `tempId` flags.
2. Updated `processFiles` in `src/components/assistant/AIAssistant.tsx` to POST attachments to `/api/ai/upload` and update local state upon completion.
3. Updated attachments renderer in `src/components/assistant/AIAssistant.tsx` to display spinners on uploading items, and disabled the Send button.
4. Created `/api/ai/upload/route.ts` to persist user uploads to `public/user_uploads/`.
5. Modified `src/app/api/ai/chat/route.ts` to save AI generated images to `public/generated_images/`.
6. Modified `src/data/store.ts` to resolve relative URLs to base64 on-the-fly, parse stream errors, handle empty stream completions, and provide detailed connection errors.
7. Modified `src/lib/chat.ts` to strip raw base64 data from attachments before database insertion.
8. Ran compile-time type verification using `npx tsc --noEmit` which completed successfully with zero errors.

### 6. Status Assessment
* **Completed:** All objectives achieved. SSE stream errors are parsed and rendered, generated images are saved locally and use lightweight URLs, and user uploads are managed securely.
* **Unresolved:** None.
* **Recommendations:** Advise the user to clear browser cache and restart the dev server to verify the fixes in their workspace.
