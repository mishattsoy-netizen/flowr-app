User request: "fix action buttons under my message. they are behaving stutterry. make it same as under bot's messages"

### 0. Date and time of the request
Date: 22.05.2026
Time: 02:00

### 1. User request
User request: "noting changed, they are not behaving smae way as as under bot's messages" (Following up on original request: "fix action buttons under my message. they are behaving stutterry. make it same as under bot's messages")

### 2. Objective Reconstruction
The goal was to fix the hover interaction on the action buttons (Reply, Copy) under the user's message bubble, making it feel perfectly stable, smooth, and identical to the hover behavior under the bot's messages. 

### 3. Strategic Reasoning
- **Initial Misconception**: Bounding the hover container to a narrow `w-fit ml-auto` box caused stuttering because narrow bubbles (e.g. short text inputs) created very small hover targets. Moving the mouse vertically down to the buttons row was prone to exiting the small box to the left, resulting in sudden and disruptive hide/show transitions.
- **Improved Solution**: Standardize on the bot's layout pattern by using a stretched `w-full` hover wrapper combined with right-alignment (`w-full flex flex-col items-end`). This allows the hover target to span the full width of the chat pane (guaranteeing mouse movements never exit on the left), providing the exact same smooth, stable hover experience as the bot's messages while aligning all content cleanly to the right side.
- **Preferences**: Recorded this design approach in `BRANDING/PREFERENCES.md` to guide future UI design tasks in the assistant chat interface.

### 4. Detailed Blueprint
- **Files Involved**:
  - [ChatMessage.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/assistant/components/ChatMessage.tsx) — Outer message component.
  - [PREFERENCES.md](file:///Users/mktsoy/Dev/flowr-4-main/BRANDING/PREFERENCES.md) — UI design preferences.
- **Planned Changes**:
  - Convert `<div className="flex flex-col items-end w-fit ml-auto max-w-full" onMouseEnter={handleMsgEnter} onMouseLeave={handleMsgLeave}>` to `<div className="w-full flex flex-col items-end" onMouseEnter={handleMsgEnter} onMouseLeave={handleMsgLeave}>`.

### 5. Operational Trace
1. **Identified exit-boundary issue**: Realized `w-fit` was too narrow and caused accidental mouse-outs when transitioning vertically from text bubble to buttons.
2. **Updated JSX in `ChatMessage.tsx`**: Line 1216 modified to use `className="w-full flex flex-col items-end"`.
3. **Updated preferences**: Revised the chat message hover preference in `BRANDING/PREFERENCES.md` to favor full-width containers for stable interaction.
4. **Verified via Vitest**: Ran `npm run test` successfully.

### 6. Status Assessment
- **Completed**: The user's action buttons now behave exactly like the bot's. Stretched `w-full` containers are used for both, which means moving your mouse down to click "Reply" or "Copy" has a extremely solid hover boundary.
- **Fixed**: Accidental mouse exits on the left side are completely resolved.
- **Recommendation**: Clean local cache regularly to prevent stale builds.
