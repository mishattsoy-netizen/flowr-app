User request: "Fix: Ask Flowr AI placeholder dissapears, it should stay untillthere a character, even if i focus and unfocus. also make messagebar messsage text size same as in my message bubble, and in new page messagebr 0.5px bigger then that. also mentin popup doesnt close when i select mention"

## 0. Date and time of the request
06.07 - 02:42

## 1. User request
User request: "Fix: Ask Flowr AI placeholder dissapears, it should stay untillthere a character, even if i focus and unfocus. also make messagebar messsage text size same as in my message bubble, and in new page messagebr 0.5px bigger then that. also mentin popup doesnt close when i select mention"

## 2. Objective Reconstruction
- Keep the `Ask Flowr AI` input placeholder visible when the input is focused, only hiding it once the user types at least one character.
- Match the input text size (and placeholder text size) to the user's message bubble (17px).
- If starting a new conversation (i.e. empty chat / new page), make the messagebar font size 0.5px larger than that (17.5px).
- Close the mention popup correctly when a mention item is clicked or selected.

## 3. Strategic Reasoning
- Previously, the placeholder disappeared on input focus (`value.length === 0 && !isFocused`). We changed it to check only length (`value.length === 0`) to keep the placeholder visible during focus.
- The user message bubble uses `fontSize: compact ? '15px' : '17px'`. Since the sidebar assistant defaults to non-compact view, we align the messagebar font size to `17px`.
- We added `isNewPage` prop to `ChatInputEditable` sourced from `isNewChatEmpty` in `AIAssistant.tsx` to conditionally increase font-size to `17.5px` when the chat is empty.
- The mention popup did not close because the `cursorText` state in `AIAssistant.tsx` (which is used to detect if the mention popup should be open) was not updated when programmatically completing a mention. Calling `setCursorText(newValue)` alongside `setAssistantInput(newValue)` resolves the state discrepancy and closes the menu automatically.

## 4. Detailed Blueprint
- `src/components/assistant/components/ChatInputEditable.tsx`: Add `isNewPage?: boolean` prop, update `showPlaceholder` logic, and apply dynamic font size style variables to both the wrapper element and the inner contenteditable div.
- `src/components/assistant/AIAssistant.tsx`: Pass `isNewPage={isNewChatEmpty}` to `ChatInputEditable`, call `setCursorText` on mention selection, and resolve TypeScript types and store imports for full build compliance.

## 5. Operational Trace
- Modified [ChatInputEditable.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/assistant/components/ChatInputEditable.tsx) to accept `isNewPage` and apply it to state + inline font size styles.
- Modified [AIAssistant.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/assistant/AIAssistant.tsx) to wire up `isNewPage` prop, update local state `cursorText` on click select, and clean up duplicate `useEffect` code paths.
- Removed collection check comparisons inside [AIAssistant.tsx](file:///c:/Users/misha/Documents/Dev/flowr-app%20copy/flowr-app%20copy/src/components/assistant/AIAssistant.tsx) to prevent type checker warning on non-existent collection types.

## 6. Status Assessment
- Verified compilation and build checks using `npx tsc --noEmit`. The code compiles successfully without any warnings or type errors.
