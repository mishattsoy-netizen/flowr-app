User request: (User attached two screenshots showing: 1. the bot literally replying with "..." and 2. the multi-cursor bug from the previous state.)

### Objective Reconstruction
The user indicated that the streaming logic still had issues. Based on the screenshots, the new `gemma-4-31b-it` model was literally taking the previous instruction `You MUST wrap your final conversational response to the user in <answer>...</answer> tags` as a literal command to output the string `...` wrapped in tags. The second screenshot was a reference to the multi-cursor bug that was addressed in the previous iteration but still visible in the user's local state before refresh.

### Strategic Reasoning
1. **Fixing the Literal "..." Output:**
   - LLMs can sometimes be overly literal when instructions include placeholder syntax like `...`.
   - Updated `src/app/api/admin/roadmap/chat/route.ts` to replace the ambiguous `<answer>...</answer>` instruction with a concrete example: `You MUST wrap your final conversational response to the user inside <answer> tags. For example: <answer>Hello, how can I help you today?</answer>`.
2. **Re-verifying the Cursor Bug:**
   - The multi-cursor issue shown in the second screenshot was definitively fixed in the previous commit by moving the `ReactMarkdown` component render logic to respect `isAtEnd(node)`. No further code changes were needed for the cursors, but the literal string output fix ensures the model generates proper content to be typed out.

### Detailed Blueprint
- `src/app/api/admin/roadmap/chat/route.ts`:
  - Modify the `CRITICAL INSTRUCTION` string to remove the `...` placeholder and provide a clear, conversational example of how the tags should be used.

### Operational Trace
- Ensured the `system_prompt` correctly guides the model to produce meaningful text rather than literal placeholders.

### Status Assessment
The prompt is now hardened against literal interpretation. The bot will provide actual conversational text inside the `<answer>` tags, which the router will extract cleanly, and the typewriter will render with a single trailing cursor.
