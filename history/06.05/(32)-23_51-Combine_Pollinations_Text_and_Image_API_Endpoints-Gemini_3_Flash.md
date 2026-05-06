User request: "why is pollinations showing only one model?"

### 1. Objective Reconstruction
The objective of this analysis and fix was to discover why fetching Pollinations only returned exactly one model (`openai-fast`) and modify the fetcher so that all available Pollinations models are fully fetched and listed.

### 2. Strategic Reasoning
- **Endpoint Bifurcation**: Pollinations hosts its free models on two completely separate APIs:
  1. **Text Models**: `https://text.pollinations.ai/models` (currently returns only `openai-fast`).
  2. **Image Models**: `https://image.pollinations.ai/models` (currently returns `sana`).
- **Unified Fetching**: To provide a seamless, rich discovery experience, we updated `fetchPollinations` to query both endpoints in parallel, extract the models safely, eliminate any duplicate IDs, and combine them into a single comprehensive array before returning.

### 3. Detailed Blueprint
- **`src/app/admin/discover/actions.ts`**:
  - Replaced the single-fetch `fetchPollinations` function with a combined dual-fetch system targeting both the text and image endpoints.
  - Implemented automatic modality mapping for image models (returning `['image']` as their output modality).

### 4. Operational Trace
- Queried `https://text.pollinations.ai/models` and `https://image.pollinations.ai/models` to inspect returned payloads.
- Edited `src/app/admin/discover/actions.ts` using `replace_file_content` to apply the combined fetcher.
- Verified successful compilation.

### 5. Status Assessment
- **Completed**: Pollinations now correctly discovers and lists both its text models and its image generation models seamlessly!
