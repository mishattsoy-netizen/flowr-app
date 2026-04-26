User request: "remove 3 dont in the and and keep only text: Thinking..."

### Objective Reconstruction
The user requested to remove the three animated dots at the end of the "Thinking..." status indicator in the chat, keeping only the static text "Thinking...".

### Strategic Reasoning
The "Thinking..." status was being rendered using a `StatusTyping` component, which appended three animated dots to any text it received. Since the text passed to it was already "Thinking...", it resulted in "Thinking... ...". Removing the animated dots from the `StatusTyping` component ensures that only the intended text is displayed, simplifying the UI and following the user's preference for a cleaner look.

### Detailed Blueprint
- **Component**: `StatusTyping.tsx`
- **Action**: Remove the `span` containing the three animated circles.
- **Affected Text**: "Thinking..." and "Preparing tool..." statuses in the chat.

### Operational Trace
- Modified `src/components/assistant/components/StatusTyping.tsx` to remove the animated dots `span`.
- Verified that `ChatMessage.tsx` passes "Thinking..." (with dots) to the component, so the final output will be exactly as requested.

### Status Assessment
Completed. The animated dots are removed, and only the text "Thinking..." (and other status texts) will be shown.

### Next Recommendation
None.
