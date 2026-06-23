User request: "make message bar shorow softer. i said fill with dark on hover(pills)"

### 0. Date and time of the request
01.06.2026, 18:05

### 1. User request
User request: "make message bar shorow softer. i said fill with dark on hover(pills)"

### 2. Objective Reconstruction
Incorporate two final aesthetic refinements to the welcome interface layout:
1. Soften the shadow surrounding the centered message input bar by migrating the card wrapper from a heavy, high-contrast overlay to a subtle depth shadow.
2. Correct the hover background color on the quick access suggestion pills to fill with a rich, solid dark color (`var(--app-dark)`).

### 3. Strategic Reasoning
Replacing `shadow-2xl` with `shadow-md` on the embedded `<AIAssistant />` card prevents harsh edge contrast, enabling the input card to nest smoothly and look much softer on the charcoal canvas. Swapping the suggestions hover class from `hover:bg-[var(--bone-6)]` (which is a soft gray) to `hover:bg-[var(--app-dark)]` satisfies the specific branding requirement to fill with a deep solid dark gray on hover.

### 4. Detailed Blueprint
- **[AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx)**:
  - Locate the unified message bar container at [L784](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx#L784) and change `shadow-2xl` to `shadow-md`.
- **[ChatConversation.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/chat/ChatConversation.tsx)**:
  - Locate the quick access pill item button at [L122](file:///Users/mktsoy/Dev/flowr-app/src/components/chat/ChatConversation.tsx#L122) and swap `hover:bg-[var(--bone-6)]` with `hover:bg-[var(--app-dark)]`.

### 5. Operational Trace
- Replaced the high-contrast overlay class `shadow-2xl` with the softer `shadow-md` in `AIAssistant.tsx`.
- Updated the suggestion button hover state class inside the `ChatConversation.tsx` render loop to use the core theme solid dark color `hover:bg-[var(--app-dark)]`.

### 6. Status Assessment
- Overwrites and style polishes complete. Both changes are active and staged.
