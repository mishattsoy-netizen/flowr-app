User request: "also text color to bone 70"

### 0. Date and time of the request
- Date: 18.05.2026
- Time: 22:15

### 1. User request
User request: "also text color to bone 70"

### 2. Objective Reconstruction
To change the foreground text color of monospace pills (`[m]...[/m]`) inside chat messages to be exactly `var(--bone-70)` (which resolves to `rgba(233, 233, 226, 0.70)`), providing a refined, slightly dimmed text presentation.

### 3. Strategic Reasoning
Applying `--bone-70` text color to the custom monospace pills integrates them exceptionally well with the system's "Digital Instrument" UI design rules. The bone-70 color has a slightly lower contrast compared to the stark white `--bone-100` color, which keeps the text inside the pill looking clean, warm, and highly readable without drawing excessive visual attention.

### 4. Detailed Blueprint
- Target: `/Users/mktsoy/Dev/flowr-4-main/src/components/assistant/components/ChatMessage.tsx`
- Location: `renderContentWithStyles` helper function, line 118.
- Modification: Add `text-[var(--bone-70)]` to the className list for the `isMono` span.

### 5. Operational Trace
- Edited `ChatMessage.tsx` to add `text-[var(--bone-70)]` to the mono pill styling.

### 6. Status Assessment
- Fully completed. Text color inside the monospace pill is styled as `var(--bone-70)`.
