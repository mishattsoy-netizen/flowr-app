# 20.06 at 04:43

User request: "wtf is this? why did you change source/button style in chat?"

## Objective Reconstruction
Revert the trigger style of links inside the chatbot messages (`LinkWithPopup` component) back to the capsule button style with favicons, keeping it separate from the inline text links in the editor.

## Strategic Reasoning
The previous update mistakenly replaced the capsule button trigger format of `LinkWithPopup` with standard text-based links inside the chat panel. The user wants link styles in the chat view to remain as capsule buttons with favicons, and only differentiate them when content is copied to the editor notes. Reverting the style of the trigger in `LinkWithPopup` to its original HTML layout resolves the styling regression.

## Detailed Blueprint
1. Modify [ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx):
   - Replace the `LinkWithPopup` trigger's `className` and children to restore capsule button container, padding, border-radius, background, and favicon layout.

## Operational Trace
1. Updated [ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/components/ChatMessage.tsx):
   - Restored original classes on the link anchor tag.
   - Restored image tag rendering if `faviconUrl` exists.

## Status Assessment
- **Completed:** Restored capsule button appearance for links inside chat bubbles.
- **Fixed:** Reverted unintended styling regression in the chat view.
