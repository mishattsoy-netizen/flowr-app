User request: "upscale doesnt work"

### Objective Reconstruction
The goal was to diagnose and fix why the automatic image upscaling (IMAGE_UPSCALE chain) was failing to execute after a successful image generation.

### Strategic Reasoning
1.  **Chain Inspection**: I checked the `IMAGE_UPSCALE` router chain configuration and found that the primary upscaler (`xinlai/Real-ESRGAN-realesrgan-x4plus`) was incorrectly registered with the `cloudflare` provider instead of `huggingface`.
2.  **Provider Routing**: Since the `cloudflare` provider does not support upscaling in this app's architecture, the `runUpscaleChain` logic (which expects `huggingface` or `siliconflow`) was silently failing or skipping the model.
3.  **Authentication Conflict**: I identified a second bug where `runChain` was passing the generator's API key (e.g., Cloudflare's) to the upscaler. This would cause a 401 error if the upscaler was from a different provider (HuggingFace).

### Detailed Blueprint
1.  **Database Fix**:
    -   Updated the `models` table to correct the provider for `xinlai/Real-ESRGAN-realesrgan-x4plus` to `huggingface`.
    -   Updated the `router_chains` table to ensure the `IMAGE_UPSCALE` list also uses the correct `huggingface` provider.
2.  **`src/lib/bot/chainRouter.ts`**:
    -   Modified the call to `runUpscaleChain` to remove the `aiApiKey` parameter. This allows the upscale models to use their own specific provider keys from the vault (e.g., `HUGGING_FACE_TOKEN`) instead of trying to use the generator's key.

### Operational Trace
-   **Config Check**: Discovered `provider: 'cloudflare'` mismatch for HF model.
-   **DB Update**: Corrected provider in both `models` and `router_chains` tables.
-   **Code Fix**: Removed cross-provider API key leak in `chainRouter.ts`.

### Status Assessment
Upscaling is now correctly routed to HuggingFace and uses the proper authentication tokens. The "ROUTING CHAIN" in the logs should now show `IMAGE_UPSCALE` following `IMAGE_GEN` for images that need enhancement.

### Next Recommendation
Verify that a HuggingFace API token is set in the vault under `HUGGING_FACE_TOKEN` or via the Secure Vault > HuggingFace widget to ensure the upscaler has valid credentials.
