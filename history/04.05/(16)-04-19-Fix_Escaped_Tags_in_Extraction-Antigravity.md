User request: "fix text outside of the bubble"

### Objective Reconstruction
The user attached a screenshot showing the AI's internal reasoning block and literal `</thought>` tags spilling into the final chat UI. The goal was to fix the text extraction logic so that ONLY the final response is displayed, regardless of how the model formats its internal tags.

### Strategic Reasoning
1. **Diagnosis of Extraction Failure:**
   - The screenshot revealed that the AI (`gemma-4-31b-it`) was HTML-escaping its tags in its raw output (e.g., `&lt;answer&gt;` instead of `<answer>`).
   - The regex filters in `roadmapRouter.ts` were strictly looking for literal `<answer>` and `</thought>` bracket characters. When the model escaped them, the regex failed to find a match.
   - Because the match failed, the router fell back to returning the entire raw string, which ReactMarkdown then conveniently unescaped and rendered visually as `</thought>` on the screen, creating the illusion that the regex missed a perfectly valid tag.
2. **Robust Tag Handling:**
   - Updated the extraction regexes in `src/lib/bot/roadmapRouter.ts` to account for both literal `<` / `>` brackets as well as `&lt;` / `&gt;` encoded variations. 
   - Refined the primary `answerMatch` regex to lazily capture everything after the opening tag up to the closing tag OR the end of the string (`(?:(?:<|&lt;)\/answer(?:>|&gt;)|$)`), ensuring that even if the model forgets to close the `<answer>` block completely, the response will still be cleanly extracted.

### Detailed Blueprint
- `src/lib/bot/roadmapRouter.ts`:
  - Modify `answerMatch` regex: `/(?:<|&lt;)answer(?:>|&gt;)\s*([\s\S]*?)(?:(?:<|&lt;)\/answer(?:>|&gt;)|$)/i`
  - Modify fallback `splitResponse` regex: `/(?:<|&lt;)\/thought(?:>|&gt;)/i`

### Operational Trace
- Hardened the server-side payload extraction against common LLM Markdown-escaping behaviors.

### Status Assessment
The chat response will now perfectly isolate the intended answer text, cleanly ignoring all HTML-escaped internal thought blocks and unclosed tags. The chat bubble will only contain the final conversational output.
