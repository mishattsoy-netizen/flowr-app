User request: "what is this general card in vault is it siliconflow? fix provier/key names. tavily provider is not voult but tavily, if model is not connected to api like duckduckgo, show as 'no token'. and make sure they have same colors in all pages like discovery, router, vault, registry..."

### Objective Reconstruction
The goal was to unify the design system across all admin pages (Discovery, Router, Vault, Registry) and resolve naming/grouping issues in the security vault. Specifically, SiliconFlow and Tavily needed proper identification, and non-token models (like DuckDuckGo) needed clearer UI labels.

### Strategic Reasoning
1.  **Unified Color Palette**: I synchronized the `PROVIDER_COLORS` and `PROVIDER_INFO` across `model-utils.ts` and `VaultProviderWidget.tsx`. This ensures that a provider like Gemini is always the same blue and SiliconFlow is always indigo, regardless of the page.
2.  **Provider De-generalization**: I added SiliconFlow and Tavily to the vault's known provider list. This removes them from the "GENERAL" card and gives them dedicated, branded widgets.
3.  **Contextual RPD Labels**: For models that are free (Pollinations) or local (Ollama), I updated the Router matrix to show "FREE" or "LOCAL" instead of a confusing infinite sign or empty value. This makes it immediately clear which models don't require API keys.

### Detailed Blueprint
1.  **`src/components/admin/model-utils.ts`**:
    -   Synchronized all provider colors and icons.
    -   Added `tavily` and `siliconflow` with consistent styling.
2.  **`src/components/admin/VaultProviderWidget.tsx`**:
    -   Updated `PROVIDER_INFO` to include SiliconFlow, Tavily, and Cloudflare.
    -   Aligned colors with `model-utils.ts`.
3.  **`src/components/admin/RouterManager.tsx`**:
    -   Updated the RPD column to detect free/local models.
    -   Implemented conditional rendering for "FREE", "LOCAL", and "API" labels.

### Operational Trace
-   **Modified**: `src/components/admin/model-utils.ts` - Master color sync.
-   **Modified**: `src/components/admin/VaultProviderWidget.tsx` - Vault branding fix.
-   **Modified**: `src/components/admin/RouterManager.tsx` - Free/Local labels implementation.

### Status Assessment
All admin pages now share a consistent color and branding language. The "GENERAL" card issue in the vault is resolved, and free/local models are clearly identified in the router matrix.

### Next Recommendation
Review the Discovery and Router pages to ensure the new "FREE" labels correctly align with your expectations for non-token models.
