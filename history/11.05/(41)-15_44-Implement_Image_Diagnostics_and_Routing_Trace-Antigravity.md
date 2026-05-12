User request: "fix image rendering, serialization error, and clarify triggered chains in inspector"

## Date and time of the request
11.05.2026 15:43

## User request
"fix image rendering, serialization error, and clarify triggered chains in inspector"

## Objective Reconstruction
Resolve critical serialization issues with image Buffers and enhance the Prompt Inspector to provide high-fidelity visibility into triggered chains and visual outputs.

## Strategic Reasoning
- **Data URIs**: Next.js Server Actions cannot return binary Buffers directly to Client Components without serialization. Base64 is the standard for inline media.
- **Stage Isolation**: The Classifier is a "clean" step—it shouldn't be cluttered with personality prompts it doesn't use. Removing these layers provides a more accurate view of the model's environment.
- **Trace Transparency**: The routing trace is the most important "hidden" part of the logic (keys, fallbacks, providers). Exposing it as a dedicated stage clarifies why a specific model was chosen.

## Detailed Blueprint
- **actions.ts**: Added logic to detect Buffers and wrap them in `data:image/webp;base64` headers.
- **PromptInspector.tsx**:
    - Updated `renderedStages` to include `routing`.
    - Updated `getLayersForStage` to clean up internal stage prompts.
    - Added conditional rendering for `img` tags in the stage output area.
    - Integrated `diagnosticResult.image_description` into the visual preview.

## Operational Trace
- Fixed `Uint8Array` console error.
- Verified image rendering for `IMAGE_GEN` category.
- Verified "Routing Logic" card appears with model/provider details.

## Status Assessment
- [x] Serialization error resolved.
- [x] Images rendered in Inspector.
- [x] Chain triggers clearly visualized.
- [x] Internal step prompt stacks cleaned up.
