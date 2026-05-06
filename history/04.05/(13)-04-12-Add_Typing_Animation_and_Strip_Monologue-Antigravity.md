User request: "fix answer and add same streaming animation like in flowr ai"

### Objective Reconstruction
The user requested two related fixes for the Roadmap Planning Assistant:
1. Strip out the "inner monologue" and strict prompt instructions from the AI's response so that only the final conversational reply is shown (similar to the Zero-Monologue rule).
2. Implement a streaming typing animation for the AI's response, identical to the visual effect used in the main Flowr AI Assistant.

### Strategic Reasoning
1. **Inner Monologue Stripping:** 
   - The roadmap chain was returning the raw output from the AI models, which often included `<think>`, `<thought>`, or prompt preamble structural headers before the actual reply.
   - Updated `runRoadmapChain` in `src/lib/bot/roadmapRouter.ts` to actively regex strip these tags (`<think>`, `<answer>`, `<thought>`) and common preamble markers (e.g., `Role:`, `User Request:`) before sending the payload to the client.
2. **Streaming Animation:**
   - Instead of migrating the entire `/api/admin/roadmap/chat` to a streaming architecture (which would break the custom `ROADMAP_ACTION` JSON parsing flow), I implemented a client-side fake-streaming effect.
   - Created a new `TypewriterMessage` component in `PlanningAssistant.tsx` that uses `requestAnimationFrame` to rapidly reveal text character-by-character.
   - Leveraged custom ReactMarkdown components to attach the `ai-cursor-inline` block (`█`) specifically to the trailing text node while typing, exactly replicating the visual effect seen in `AIAssistant.tsx`.

### Detailed Blueprint
- `src/lib/bot/roadmapRouter.ts`:
  - Intercept the raw `response` before returning it.
  - Apply regex replacements to remove `<think>...</think>`, `<thought>...</thought>`, and prompt preambles.
- `src/components/admin/roadmap/PlanningAssistant.tsx`:
  - Add `TypewriterMessage` wrapper component containing the `requestAnimationFrame` render loop.
  - Update `renderContent` to pass `isLastAssistantMessage` boolean.
  - Conditionally render `TypewriterMessage` for the most recent assistant message, and fallback to static `ReactMarkdown` for older messages to save client resources.

### Operational Trace
- Successfully isolated the clean response payload on the server-side.
- Implemented and tuned the typewriter effect in the roadmap chat UI to match the speed and aesthetic of Flowr AI.

### Status Assessment
The Planning Assistant chat UI is now polished. Responses are direct, conversational, and visually dynamic, completing the "Flowr AI" aesthetic integration into the Roadmap Hub.
