### 0. Date and time of the request
Date: 2026-06-21
Time: 00:35

### 1. User request
User request: "no accent, bone text and bone 30 underline idle and bone 100 on hover"

### 2. Objective Reconstruction
Restyle standard markdown links in the chat message pane to use a minimalist aesthetic matching the main theme: bone text (`var(--bone-70)`), a sub-underlined link style with `var(--bone-30)` underline color when idle, and transitioning to full bone text (`var(--bone-100)`) and full underline (`var(--bone-100)`) on hover.

### 3. Strategic Reasoning
Rather than styling inline links in the accent color, the user requested a minimal inline link design matching the prose colors. The base link text uses the mid-tone `var(--bone-70)` and an offset underline using `var(--bone-30)` for a subtle visual cue. On hover, the link transitions to full highlight (`var(--bone-100)`) to indicate interactivity without using neon or accent colors.

### 4. Detailed Blueprint
- `src/components/assistant/components/ChatMessage.tsx`:
  - Change standard ReactMarkdown `a` link class names to: `text-[var(--bone-70)] underline decoration-[var(--bone-30)] underline-offset-[3px] hover:text-[var(--bone-100)] hover:decoration-[var(--bone-100)] transition-colors`.
  - Change Markdown container's `prose-a` classes to: `prose-a:text-[var(--bone-70)] prose-a:underline prose-a:decoration-[var(--bone-30)] prose-a:underline-offset-[3px] hover:prose-a:text-[var(--bone-100)] hover:prose-a:decoration-[var(--bone-100)] transition-colors`.

### 5. Operational Trace
1. Modified `ReactMarkdown` link rendering logic in `ChatMessage.tsx` to match the specific color style values.
2. Updated `prose-a` classes in typography settings of the message component.
3. Verified compilation and local testing.

### 6. Status Assessment
The inline link style has been refined to the requested minimal bone colors and decoration styles.
