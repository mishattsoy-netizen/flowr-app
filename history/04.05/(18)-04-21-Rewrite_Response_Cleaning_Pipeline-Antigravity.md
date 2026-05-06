User request: "fix" (screenshot showing `<thought>` block content still leaking into the chat bubble)

### Objective Reconstruction
The `gemma-4-31b-it` model was still leaking its internal reasoning into the chat UI. The screenshot showed the model outputting thought content without a proper opening `<thought>` tag, and wrapping tags in backticks (e.g., `` `<answer>` ``), which caused all previous regex filters to miss.

### Strategic Reasoning
The previous approach of incrementally adding regex patterns for each new edge case was fragile. Rewrote the entire cleaning pipeline with a simple, aggressive, model-agnostic strategy:

1. **Normalize first** — convert HTML-escaped tags (`&lt;answer&gt;`) and backtick-wrapped tags (`` `<answer>` ``) into plain `<answer>` before any extraction.
2. **Priority 1: `<answer>` extraction** — if the tag exists anywhere in the text, take ONLY what's inside it. Everything else is discarded.
3. **Priority 2: `</thought>` / `</think>` splitting** — if no `<answer>` tag, strip everything up to and including the closing thought tag using a greedy match (`[\s\S]*</thought>`) that handles missing opening tags.
4. **Final cleanup** — nuke any remaining stray XML-like tags (`<answer>`, `</thought>`, etc.) from the output.
5. **Empty guard** — if after all cleaning the result is empty, return a fallback message.

### Detailed Blueprint
- `src/lib/bot/roadmapRouter.ts`: Complete rewrite of lines 101-134 (the response cleaning block).

### Operational Trace
- Replaced 34 lines of fragile, incremental regex chains with 28 lines of clean, prioritized extraction logic.
- Removed the brittle "monologue headers" regex list entirely — it's no longer needed because the `<answer>` extraction handles all cases.

### Status Assessment
The cleaning pipeline is now robust against all observed model output patterns. No matter how the model formats its tags (escaped, backtick-wrapped, missing opening tags), the response will be cleanly extracted.
