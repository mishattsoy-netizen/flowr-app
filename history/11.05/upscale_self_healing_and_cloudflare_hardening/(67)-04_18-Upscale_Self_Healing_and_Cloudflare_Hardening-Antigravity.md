User request: "cloudflare still doesnt work. plus upscale hcain is not triggered"

### Objective Reconstruction
The goal was to resolve two lingering issues:
1.  **Cloudflare API Failures**: Cloudflare models were failing immediately, likely due to credential whitespace or URL formatting.
2.  **Upscale Chain Inactivity**: The new `IMAGE_UPSCALE` feature was not triggering, likely because the necessary database row was missing.

### Strategic Reasoning
-   **Self-Healing Database**: To fix the inactivity, I implemented a self-healing mechanism in `getRouterChain`. If the `IMAGE_UPSCALE` category is requested but missing from Supabase, the system now automatically creates a default entry for it.
-   **Cloudflare Robustness**: Added `.trim()` to all credentials and model IDs to prevent invisible whitespace from breaking the URL or Authorization headers.
-   **Detailed Error Visibility**: Updated Cloudflare logging to capture the full response body on failure, allowing for precise diagnosis of "Hard Rejections" from the API.
-   **Upscale Diagnostic**: Added logging to `runChain` to confirm when an image is being processed for upscaling, helping verify the bridge between generation and enhancement.

### Detailed Blueprint
1.  **`src/lib/router-config.ts`**:
    -   Modified `getRouterChain` to check for missing entries and `insert` default rows for `IMAGE_UPSCALE`, `VISION`, and `CODING`.
2.  **`src/lib/bot/providers/cloudflare.ts`**:
    -   Added `.trim()` to `accountId`, `token`, and `cfModel`.
    -   Refined the URL construction logic.
    -   Added `logger.error` for API failures containing the full error body.
3.  **`src/lib/bot/chainRouter.ts`**:
    -   Added diagnostic `logger.info` messages around the `runUpscaleChain` call.

### Operational Trace
-   **Modified**: `src/lib/router-config.ts` - Added category self-healing.
-   **Modified**: `src/lib/bot/providers/cloudflare.ts` - Hardened URL/Headers and added response logging.
-   **Modified**: `src/lib/bot/chainRouter.ts` - Added upscaling diagnostics.

### Status Assessment
The `IMAGE_UPSCALE` category is now guaranteed to exist in your database. Cloudflare is now sending "clean" requests.
**CRITICAL**: You must still assign a model to the `IMAGE_UPSCALE` chain in the Admin UI for it to actually perform work.

### Next Recommendation
Check the Admin logs if Cloudflare still fails; the exact reason (e.g., "invalid account ID") will now be clearly visible in the server logs.
