User request: "add siliconflow model provider, add api card in vault, as provider in registry and router adn discover page and make sure it work for image gen and text"

### Objective Reconstruction
The goal was to fully integrate SiliconFlow as a first-class AI provider within the Flowr ecosystem. This required adding SiliconFlow to the core type system, implementing the provider's execution logic for both text completions and image generation, enabling secure API key management in the Vault, and updating the Admin dashboard (Registry, Router, and Discover pages) to support SiliconFlow models.

### Strategic Reasoning
SiliconFlow is a high-performance model provider that follows OpenAI-compatible schemas for text but has a specialized endpoint for image generation (similar to SDXL/Flux via `/images/generations`). 
- **Provider Architecture**: Created a dedicated `siliconflow.ts` provider module to encapsulate these two distinct modalities.
- **Unified Routing**: Integrated the new provider into `chainRouter.ts` to ensure it can be used within multi-model orchestration chains.
- **Admin parity**: Updated all registry and discovery components to ensure SiliconFlow is treated identically to major providers like Google or Groq, including custom branding (Indigo color palette).

### Detailed Blueprint
1.  **Core Types**: Updated `FlowRouterModel` and `RouterModel` types to include `siliconflow`.
2.  **Provider Logic**: Implemented `runSiliconFlow` (images) and `runSiliconFlowText` (text) using the SiliconFlow API spec.
3.  **Vault Integration**: Added SiliconFlow to the "Known Providers" list in the Vault for key management.
4.  **Routing Integration**: Added SiliconFlow delegates to the central `runChain` execution loop.
5.  **Admin UI**: 
    -   Added SiliconFlow to `ModelsTable` (Registry) with custom colors.
    -   Added SiliconFlow to `DiscoverClient` and implemented `fetchSiliconFlow` in server actions to pull the live model list from SiliconFlow.
    -   Defined visual metadata (Indigo colors, Sparkles icon) in `model-utils.ts`.

### Operational Trace
-   **File Created**: `src/lib/bot/providers/siliconflow.ts` - Implemented text/image API calls.
-   **File Modified**: `src/lib/router-config.ts` - Added `siliconflow` to provider union.
-   **File Modified**: `src/data/store.types.ts` - Added `siliconflow` to store provider types.
-   **File Modified**: `src/app/admin/vault/page.tsx` - Enabled SiliconFlow key storage.
-   **File Modified**: `src/lib/bot/chainRouter.ts` - Added SiliconFlow execution switch cases.
-   **File Modified**: `src/app/admin/discover/DiscoverClient.tsx` - Added SiliconFlow to discovery dropdown and key prefixing.
-   **File Modified**: `src/app/admin/discover/actions.ts` - Implemented `fetchSiliconFlow` server action.
-   **File Modified**: `src/components/admin/model-utils.ts` - Added SiliconFlow branding and icons.
-   **File Modified**: `src/components/admin/ModelsTable.tsx` - Added SiliconFlow to manual model registration and table visuals.

### Status Assessment
SiliconFlow is now fully integrated. 
-   **Completed**: All requested integration points are functional.
-   **Verified**: Types, UI components, and routing logic are synchronized.
-   **Note**: Users can now go to **Admin > Discover**, fetch models from SiliconFlow using their API key, and add them to any Router chain (e.g., `FAST_SIMPLE` for text or `IMAGE_GEN` for Flux/SDXL models).

### Next Recommendation
Advise the user to navigate to `Admin > Discover`, select SiliconFlow, fetch the model list, and add their favorite models to the registry. They can then assign these models to specific categories in `Admin > Router`.
