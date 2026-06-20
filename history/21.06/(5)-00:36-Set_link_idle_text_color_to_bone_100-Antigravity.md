### 0. Date and time of the request
Date: 2026-06-21
Time: 00:36

### 1. User request
User request: "text bone 100 aswell when idle"

### 2. Objective Reconstruction
Refine standard markdown link text color inside the assistant chat pane to be full bone highlight (`var(--bone-100)`) when idle, instead of mid-tone `var(--bone-70)`. Underlines remain at `var(--bone-30)` when idle and transition to `var(--bone-100)` on hover.

### 3. Strategic Reasoning
To make inline text links more visible while keeping a minimal style without utilizing accent colors, we set the link text color to the full foreground color `var(--bone-100)` when idle, while keeping the underline color faded at `var(--bone-30)`. On hover, only the underline opacity increases to `var(--bone-100)`.

### 4. Detailed Blueprint
- `src/components/assistant/components/ChatMessage.tsx`:
  - Change standard ReactMarkdown `a` link class text color from `text-[var(--bone-70)]` to `text-[var(--bone-100)]`.
  - Change Markdown container's `prose-a` classes to use `prose-a:text-[var(--bone-100)]` in both idle and hover states.

### 5. Operational Trace
1. Updated link classes in ReactMarkdown custom renderers to use `text-[var(--bone-100)]` when idle.
2. Verified the design compiles and updates correctly.

### 6. Status Assessment
The inline link styling is fully updated to render bone-100 text when idle and hover, with a transition for underline color from bone-30 to bone-100.
