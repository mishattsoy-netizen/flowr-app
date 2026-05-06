User request: "fix overlaping text and fix answer"

### Objective Reconstruction
Two issues visible in the screenshot:
1. Text overflowing horizontally past the chat bubble boundary (no word wrapping on monospaced reasoning text).
2. The `gemma-4-31b-it` model completely ignoring the `<answer>` tag instruction and dumping raw bullet-point reasoning directly into the chat.

### Strategic Reasoning
1. **Text Overflow Fix:**
   - Added `overflow-hidden` to the outer bubble container.
   - Wrapped message content in a `<div>` with `break-words`, `overflow-wrap-anywhere`, and CSS utility selectors for `pre` and `code` blocks to prevent any child element from exceeding the container width.

2. **Answer Extraction — Heuristic Fallback:**
   - `gemma-4-31b-it` doesn't reliably follow `<answer>` tag instructions. It outputs internal reasoning as markdown bullet points (e.g., `* The user said "hey"`, `* I should answer directly`, `* Keep it concise`).
   - Added a PRIORITY 3 heuristic after the tag-based extraction fails:
     - Scans lines for reasoning patterns (`/^\s*[*-•]\s*(The user|I should|Therefore|This is|Keep it|...)/i`)
     - If detected, splits the response into paragraphs and keeps only the non-bullet paragraphs (the actual conversational answer).
     - This catches the pattern where the model dumps its CoT reasoning as bullets and then writes the real answer as a normal paragraph at the end.

### Detailed Blueprint
- `src/components/admin/roadmap/PlanningAssistant.tsx`: Added overflow protection to chat bubbles.
- `src/lib/bot/roadmapRouter.ts`: Added PRIORITY 3 heuristic reasoning stripper.

### Operational Trace
- Chat bubbles now enforce word-wrapping at all levels (including monospaced text).
- The cleaning pipeline now has 3 layers: (1) `<answer>` tag extraction, (2) `</thought>` splitting, (3) bullet-point reasoning heuristic.

### Status Assessment
Both the visual overflow and the reasoning leak are addressed. The heuristic covers models that ignore tag instructions entirely.
