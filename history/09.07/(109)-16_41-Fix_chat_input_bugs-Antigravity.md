User request: "when i create add mention pil in the messagebar, all text afterit gets deleted. Also Ask Flowr AI placeholder dissapears sometimes, it must be ALWAY present when there are not characters in the messagebar or there are empy characters like space. Also "/" doesnt open ACTIONS popup mid sentence, only if its in first written character."

### 2. Objective Reconstruction
The user reported three distinct bugs in the chat input area (`ChatInputEditable`):
1. **Mention wiping text:** Selecting an entity from the `@` mention popup deletes any text trailing the cursor.
2. **Disappearing placeholder:** The "Ask Flowr AI" placeholder disappears prematurely if the input only contains spaces or whitespace characters.
3. **Slash command triggering:** The `/` actions popup only activates when `/` is the very first character of the input, restricting mid-sentence usage.

### 3. Strategic Reasoning
- **Mentions:** The previous logic replaced everything from the last `@` up to the very end of the string using a Regex matcher (`/@([^@]*)$/`), causing trailing text to be overwritten. I updated this to find the last `@` before the current cursor position, safely preserving any string chunk that follows the cursor.
- **Placeholder:** Replaced `value.length === 0` with `value.trim().length === 0` so whitespace-only inputs continue showing the placeholder.
- **Slash command mid-sentence:** Updated `isCommandTriggered` to use `/(?:^|\s)\/[^\s\/]*$/.test(cursorText)`. This allows the command popup to appear when `/` is typed after a space. I also updated the `handleCommandSelect` to safely splice the selected command prefix into the string without deleting trailing text, just like the mention fix.

### 4. Detailed Blueprint
- Modify `ChatInputEditable.tsx` placeholder logic to check for `value.trim().length === 0`.
- Modify `AIAssistant.tsx` to redefine `isCommandTriggered`.
- Modify `AIAssistant.tsx` to handle command selection safely, using `cursorText.lastIndexOf("/")` to splice in the command action/prefix.
- Modify `AIAssistant.tsx` mention enter-key and click handlers to use `cursorText.lastIndexOf("@")` for safe splicing.

### 5. Operational Trace
- Replaced `assistantInput.startsWith("/")` with regex testing `cursorText` for command menus.
- Swapped `replace(/@([^@]*)$/)` with `assistantInput.slice` string splicing to insert the mention label right before the cursor and preserve suffix text.
- Replaced `value.length === 0` with `value.trim().length === 0` in `ChatInputEditable`.

### 6. Status Assessment
The chat input behaves robustly now. Trailing text is preserved during autocompletions (both mentions and commands), the placeholder persists for empty spaces, and slash commands can be triggered contextually anywhere in the string. The fixes are tested and ready in the development server.
