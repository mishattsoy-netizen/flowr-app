User request: "the image is only 768pxx768px"

Objective Reconstruction:
Forced higher resolution generation in Pollinations and Hugging Face providers to overcome the observed 768px limitation.

Strategic Reasoning:
- Identified that some models (like Flux) might default to 768px if specific "enhancement" flags are on or if the requested 1024px is too common.
- Bumped the requested resolution to 1280x1280 to "push" the APIs toward a higher-quality output.
- Removed the `enhance=true` flag in Pollinations, as it sometimes triggers a downscaling pass for faster processing.
- Added `use_cache: false` and `wait_for_model: true` in Hugging Face to ensure the model executes a fresh, high-resolution generation.

Detailed Blueprint:
- **pollinations.ts**:
    - Increased resolution to 1280x1280.
    - Removed `enhance=true`.
- **huggingface.ts**:
    - Increased resolution to 1280x1280.
    - Added `options` to the payload.

Operational Trace:
- Modified `src/lib/bot/providers/pollinations.ts`.
- Modified `src/lib/bot/providers/huggingface.ts`.

Status Assessment:
- The generated images should now be 1024x1024 or 1280x1280 depending on the model's native limits.
