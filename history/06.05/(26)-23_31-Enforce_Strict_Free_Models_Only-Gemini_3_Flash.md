User request: "mak esure only free models are fetched"

### 1. Objective Reconstruction
The objective of this refinement was to strengthen the discovery filters to guarantee that ONLY 100% free models are fetched and shown. This is especially critical for OpenRouter, where paid and free models coexist in the same endpoint.

### 2. Strategic Reasoning
- **Safe Float Conversion**: Instead of relying on rigid string matches like `'0'` or `'0.000'`, we transitioned OpenRouter filtering to use `parseFloat()`. This safely parses any numerical format of zero (e.g. `0`, `"0"`, `"0.000000"`) for both prompt and completion pricing.
- **Robust Endpoint Checking**: Expanded ID matching to catch both standard ends-with `':free'` and inline path-based `'/free'` model IDs to guarantee no paid models leak into the registry list.
- **Provider Consistency**: Verified other providers (Google AI Studio, Groq, Pollinations, and HuggingFace) to ensure their filters remain locked to their respective free tiers and public (non-gated) models.

### 3. Detailed Blueprint
- **`src/app/admin/discover/actions.ts`**:
  - Refactored OpenRouter's filter inside `fetchOpenRouter` using safe float parsing on both prompt and completion prices.

### 4. Operational Trace
- Edited `src/app/admin/discover/actions.ts` using `replace_file_content` to apply the updated OpenRouter filter.
- Verified successful compilation.

### 5. Status Assessment
- **Completed**: Strict free-only model filtering is now enforced and robust against varying pricing representations.
