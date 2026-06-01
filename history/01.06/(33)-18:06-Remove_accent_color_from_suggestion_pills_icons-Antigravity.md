User request: "dont use accent color for icons in pills"

### 0. Date and time of the request
01.06.2026, 18:06

### 1. User request
User request: "dont use accent color for icons in pills"

### 2. Objective Reconstruction
Remove the orange accent color fill (`text-accent/80`) from the suggestion pills' Lucide icons, allowing them to dynamically inherit and transition with the parent buttons' text colors.

### 3. Strategic Reasoning
Explicitly assigning `text-accent/80` forced the SVG icons to remain orange. Deleting this class name allows the SVGs to inherit the parent button's text properties. The icons will now rest at `var(--bone-70)` gray when idle and turn to bright `var(--bone-100)` white on hover alongside the label text, producing a cohesive mono-aesthetic.

### 4. Detailed Blueprint
- **[ChatConversation.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/chat/ChatConversation.tsx)**:
  - Remove `text-accent/80` from the `pill.icon` span at [L124](file:///Users/mktsoy/Dev/flowr-app/src/components/chat/ChatConversation.tsx#L124).

### 5. Operational Trace
- Replaced `<span className="text-accent/80 shrink-0">{pill.icon}</span>` with `<span className="shrink-0">{pill.icon}</span>` inside `ChatConversation.tsx`.

### 6. Status Assessment
- Successfully corrected. Icons now match the button text state colors perfectly.
