User request: "its same" (referring to 768x768 resolution)

Objective Reconstruction:
Unified and strictly enforced the 1024x1024 resolution across all image providers (Pollinations, Hugging Face, and Cloudflare) to ensure consistent high-quality output.

Strategic Reasoning:
- Realized that requesting 1280px might have caused silent fallbacks to 768px on certain providers (like Hugging Face) that have a 1024px hard limit for free/standard inference.
- Reordered the Pollinations URL parameters to place `width` and `height` at the end, ensuring they are not ignored or overridden by the `model` parameter.
- Added explicit `width` and `height` parameters to the Cloudflare provider to prevent it from defaulting to lower resolutions.
- Standardized all requests to exactly 1024x1024, which is the native sweet spot for Flux and SDXL models.

Detailed Blueprint:
- **pollinations.ts**:
    - Set resolution to 1024x1024.
    - Moved `width`/`height` parameters to the end of the URL.
- **huggingface.ts**:
    - Set resolution to 1024x1024.
- **cloudflare.ts**:
    - Added `width: 1024` and `height: 1024` to the request body.

Operational Trace:
- Modified `src/lib/bot/providers/pollinations.ts`.
- Modified `src/lib/bot/providers/huggingface.ts`.
- Modified `src/lib/bot/providers/cloudflare.ts`.

Status Assessment:
- All providers are now strictly aligned to produce 1024x1024 images.
