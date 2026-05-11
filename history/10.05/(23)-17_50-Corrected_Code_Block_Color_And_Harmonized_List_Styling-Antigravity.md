User request: "fix blue code blocks, inconssitant list styles"

## 1. Objective Reconstruction
Eliminate foreign design conflicts by purging explicit blue background tints (#0d1117) from application code blocks and synchronizing divergent list system alignments. Target: Unify list system indentation, extend the signature orange accent theme to all list indicators (Note bullets and Chat ordered markers), and reconcile block containers to a seamless neutral dark shade (#0e0e0e).

## 2. Strategic Reasoning
The legacy #0d1117 palette injected cold navy contrast which violated the warmer organic #141413 workspace background. Swapping to #0e0e0e ensures blocks remain separated from underlying page chrome without introducing tonal drift. For hierarchy, standardizing Unordered Lists on `pl-5` brings parity to current Ordered List positioning, thereby reactivating visual nesting behaviors.

## 3. Detailed Blueprint
- **Code Blocks:** Substitute hardcoded `#0d1117` / `#0D1117` constants in `BlockRenderer.tsx` and `ChatMessage.tsx` with deep neutral `#0e0e0e`.
- **Editor Lists:** Modify static background classes for standard bullet elements in the note engine from generic bone-grey to semantic `bg-accent`.
- **Chat Lists:** Overhaul the local Markdown renderer definitions, equalizing left-padding on `ul` containers and injecting `marker:text-accent` on `ol` declarations to theme system numerals.

## 4. Operational Trace
- Modified `src/components/editor/BlockRenderer.tsx`:
    - Swapped background logic for `mono` style resolver mapping from `#0D1117` to `#0e0e0e`.
    - Switched standard `bulletList` inline marker rendering logic from `bg-bone-60` to theme-standard `bg-accent`.
- Modified `src/components/assistant/components/ChatMessage.tsx`:
    - Updated primary markdown code block container replacement map from `bg-[#0d1117]` to `bg-[#0e0e0e]`.
    - Adjusted custom `ul` definition padding from `pl-1` to `pl-5` to standardize indent scaling.
    - Injected dynamic CSS styling `marker:text-accent` onto `ol` renderer element for theme continuity.

## 5. Status Assessment
Correction sequence successful. Visual contrast issues corrected across note content and chatbot feeds. List hierarchies now appropriately indent deeper tiers, and legacy navy colors are phased out.
