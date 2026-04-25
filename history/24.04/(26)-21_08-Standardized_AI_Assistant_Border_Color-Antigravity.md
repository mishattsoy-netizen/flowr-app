User request: "use same for chatbot outer border"

### 2. Objective Reconstruction
The user requested that the outer border color of the chatbot (`AIAssistant`) be standardized to match the sidebar's border color (`var(--bone-15)`), ensuring visual harmony across the different sections of the application shell.

### 3. Strategic Reasoning
I identified the border color definition for the floating mode of the `AIAssistant` component in `src/components/assistant/AIAssistant.tsx`. I updated it from `var(--bone-10)` to `var(--bone-15)`. Since the extended (sidebar) mode of the AI Assistant in `Shell.tsx` was already using `var(--bone-15)`, this change completes the unification of the primary vertical and container borders in the app.

### 4. Detailed Blueprint
- Identify the floating `AIAssistant` container in `AIAssistant.tsx`.
- Update the `border` class to use `var(--bone-15)`.
- Keep the `hover:border-[var(--bone-30)]` for interactive feedback.
- Log the consistency fix.

### 5. Operational Trace
- Modified `src/components/assistant/AIAssistant.tsx`.
- Changed `border-[var(--bone-10)]` to `border-[var(--bone-15)]` on line 400.

### 6. Status Assessment
The chatbot now shares the same border aesthetic as the sidebar, creating a more cohesive shell design.
