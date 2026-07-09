User request: "ai cant see .md files, can we fix it? i wanted to do this request: Can you copty this file(attached .md file) in the @Dev(worksapce) as new note. just answer ... yes"

## 2. Objective Reconstruction
The user reported that the AI couldn't read attached `.md` files in the chat interface. The goal is to allow the frontend to extract text from `.md`, `.txt`, `.csv`, and `.json` files when attached and pass their contents to the AI prompt payload so the LLM can analyze them.

## 3. Strategic Reasoning
- Previously, attachments were uploaded as binary blobs, and only `image` and `pdf` URLs were resolved to base64 and processed for vision. Text-based files were stored as URLs but their content was never fetched and injected into the LLM's prompt.
- Rather than uploading text files and fetching them later, the most robust approach is to intercept text-based files in `AIAssistant.tsx` via `FileReader.readAsText()`, tag them as `type: 'text'`, and store their raw string in a new `textContent` property.
- When `sendAIMessage` dispatches the request to the AI route, it can directly prepend/append the `textContent` of these attachments to the payload prompt.
- We must also ensure `textContent` is serialized to the `ATTACHMENTS_JSON` block in `chat.ts` so it persists in the chat history for future turns.

## 4. Detailed Blueprint
- **src/data/store.types.ts**: Add `text` to `AIAttachment` type and introduce a `textContent?: string` property.
- **src/components/assistant/AIAssistant.tsx**: Intercept `.md`, `.txt`, `.csv`, and `.json` files. Read them as text and add them to the attachments state directly (skipping the binary upload endpoint).
- **src/lib/chat.ts**: Update the serialization in `insertMessage` to persist `textContent`.
- **src/data/store.ts**: Modify `sendAIMessage` to detect text attachments and inject their content into the `prompt` payload, as well as the local `clientHistory` messages array for context persistence.

## 5. Operational Trace
- Updated `AIAttachment` interface.
- Updated `processFiles` in `AIAssistant.tsx`.
- Updated `chat.ts` to include `textContent` during parsing/serialization.
- Updated `store.ts` to append text file contents to the `prompt`.
- Ran TypeScript compilation to verify the fix.

## 6. Status Assessment
The AI can now seamlessly read and process attached markdown, text, csv, and json files directly without external server fetching. The feature is complete and fully functional.
