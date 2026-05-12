User request: "can you add rule so image gen model is using highest possible resolutin it can for all providers"

### Objective Reconstruction
The goal was to implement a system-wide rule ensuring that all image generation providers (Cloudflare, SiliconFlow, Pollinations, HuggingFace) utilize the highest possible resolution supported by the specific model and provider combination.

### Strategic Reasoning
1.  **Centralization**: I decided to centralize the resolution logic in `src/lib/bot/image-utils.ts` to avoid hardcoding different values in every provider and to make future updates easier.
2.  **Provider Limits**: 
    -   **SiliconFlow**: Supports up to 4MP (2048x2048) for high-end models like Flux.
    -   **Cloudflare/Pollinations**: Generally cap at 1MP (1024x1024) for stability in serverless/edge environments.
    -   **HuggingFace**: SDXL and similar high-end models typically use 1024x1024.
3.  **Dynamic Mapping**: The `getHighestResolution` helper maps model IDs (e.g., those containing "flux", "sdxl") to their optimal high-res settings while providing a safe 512x512 fallback for older models.

### Detailed Blueprint
1.  **`src/lib/bot/image-utils.ts`**:
    -   Added `getHighestResolution(modelId, provider)` helper.
2.  **`src/lib/bot/providers/cloudflare.ts`**:
    -   Integrated `getHighestResolution`.
3.  **`src/lib/bot/providers/pollinations.ts`**:
    -   Integrated `getHighestResolution`.
4.  **`src/lib/bot/providers/siliconflow.ts`**:
    -   Integrated `getHighestResolution`.
5.  **`src/lib/bot/providers/huggingface.ts`**:
    -   Integrated `getHighestResolution`.
6.  **`BRANDING/PREFERENCES.md`**:
    -   Documented the new image generation resolution preference.

### Operational Trace
-   **Created Utility**: Added `getHighestResolution` to `image-utils.ts`.
-   **Refactored Providers**: Systematically updated all 4 image providers to call the utility.
-   **Verified Max Values**: SiliconFlow Flux now uses **2048x2048**, while others use **1024x1024**.
-   **Updated Preferences**: Recorded the rule in `PREFERENCES.md`.

### Status Assessment
All image generation tasks now automatically request the maximum supported resolution. This improvement works in tandem with the existing auto-upscale chain to provide the highest possible quality for generated images.

### Next Recommendation
Monitor generation times for SiliconFlow Flux models, as 2048x2048 generation may take longer than 1024x1024. If users find it too slow, the "highest stable" can be adjusted in the utility.
