User request: "still see it"

### 0. Date and time of the request
01.06.2026, 03:28

### 1. User request
User request: "still see it"

### 2. Objective Reconstruction
The user reported that the floating chatbot avatar trigger button was still visible on the settings page, even after a previous fix had tried to hide the floating assistant from the main shell layout.

### 3. Strategic Reasoning
Although the previous step added a condition to the `<AIAssistant />` instantiation in `Shell.tsx`, `AIAssistant.tsx` is actually always mounted to handle background states, and renders its own floating trigger button (the chatbot diamond avatar) internally when `isAIAssistantOpen` is false. Consequently, the button was still displaying. The correct fix is to conditionally check `activeEntityId !== 'settings'` directly inside the avatar render block in `AIAssistant.tsx`.

### 4. Detailed Blueprint
- Modify [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx#L473) to include `activeEntityId !== 'settings'` in the avatar container render condition.

### 5. Operational Trace
- Edited [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx) to prevent rendering of the floating trigger button when on the Settings page.

### 6. Status Assessment
- Completed successfully. The chatbot avatar is now completely hidden when navigating to the Settings page.
