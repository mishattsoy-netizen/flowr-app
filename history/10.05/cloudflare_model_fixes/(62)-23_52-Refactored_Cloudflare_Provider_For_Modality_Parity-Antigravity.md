User request: "fin out why cloudflare models dont work"

### Objective Reconstruction
The goal was to diagnose and fix the failure of Cloudflare Workers AI models within the Flowr system. Analysis revealed that the Cloudflare provider was incorrectly hardcoding image parameters (width/height) for all requests, including text models, and was failing to provide conversation history or system prompts to the Cloudflare API.

### Strategic Reasoning
Cloudflare Workers AI has distinct requirements for different model modalities:
- **Text Models**: Highly prefer the `messages` array format and often reject additional parameters like `width` or `height`.
- **Image Models**: Require a flat `prompt` and specific resolution parameters.
- **Error Transparency**: The previous implementation had generic error handling that masked specific API error messages from Cloudflare.

### Detailed Blueprint
1.  **Refactor Provider**: Updated `runCloudflare` to accept `system_prompt`, `history`, and `category`.
2.  **Modality Switching**: Implemented logic to choose between the `messages` schema (text) and the `prompt` schema (image) based on the task category or model ID hints.
3.  **Clean Payload**: Removed hardcoded image dimensions from text requests to prevent 400 Bad Request errors.
4.  **Enhanced Error Handling**: Updated the JSON response parser to extract and report specific error codes and messages from Cloudflare's `errors` array.
5.  **Chain Integration**: Updated both `chainRouter.ts` (chat) and `pipeline.ts` (multi-step) to pass full context to the Cloudflare provider.

### Operational Trace
-   **Modified**: `src/lib/bot/providers/cloudflare.ts` - Complete rewrite of payload construction and response parsing.
-   **Modified**: `src/lib/bot/chainRouter.ts` - Passed `system_prompt`, `history`, and `category` to the provider.
-   **Modified**: `src/lib/bot/pipeline.ts` - Passed `systemPrompt` and `chainType` to the provider.

### Status Assessment
Cloudflare models are now correctly configured. Text models will receive conversation context (history + system instructions) via the standard `messages` format, while image models will continue to receive image-specific parameters. Errors from Cloudflare are now transparently reported in the logs and UI.

### Next Recommendation
Advise the user to test both a Cloudflare chat model (e.g., Llama 3) and an image model (e.g., Stable Diffusion) to verify that the routing and payload construction are now working correctly.
