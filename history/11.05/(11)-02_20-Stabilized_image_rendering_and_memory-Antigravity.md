User request: "fix"

Objective Reconstruction:
Resolved the critical failure where chat images were appearing as empty grey boxes and models were hallucinating/repeating previous image data.

Strategic Reasoning:
- **Memory Optimization**: Discovered that conversation history was sending raw, multi-megabyte base64 image strings to the LLM. This caused context window bloat and led models to "hallucinate" by repeating the previous assistant's image data in their response. Since these repeated strings were often truncated by the model's output limit, they resulted in corrupted, non-rendering image data.
- **Image Payload Truncation**: Implemented a sanitization layer in `memory.ts` that replaces large base64 data with a lightweight `[Image Data]` placeholder before sending history to the AI.
- **Regex Resilience**: Hardened the image detection regexes in `ChatMessage.tsx` to handle "unclosed" Markdown syntax (e.g., missing trailing parentheses). This ensures that even if an image payload is truncated during streaming, it is still intercepted by our high-performance renderer.
- **Provider Stability**: Reverted the Pollinations resolution to 1024x1024 and increased the timeout to 60 seconds to ensure successful generation of complex "enhanced" images without overloading the pipeline.

Detailed Blueprint:
- **memory.ts**:
    - Added truncation logic to `getWebConversationMemory` and `getConversationMemory`.
- **ChatMessage.tsx**:
    - Updated `isPureImage` and paragraph regexes to support unclosed Markdown.
- **pollinations.ts**:
    - Stabilized resolution at 1024x1024.
    - Increased timeout to 60000ms.

Operational Trace:
- Modified `src/lib/bot/memory.ts`.
- Modified `src/lib/bot/providers/pollinations.ts`.
- Modified `src/components/assistant/components/ChatMessage.tsx`.

Status Assessment:
- The system is now significantly more stable.
- Memory usage for AI requests is drastically reduced.
- Images render reliably even during streaming.
