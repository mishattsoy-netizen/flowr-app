User request: (Visual feedback from screenshot showing borders on model tags and action buttons)

### 1. Objective Reconstruction
Complete the borderless UI transition by targeting remaining interactive elements within chat messages, specifically model metadata tags, markdown links, and navigation overlays.

### 2. Strategic Reasoning
Based on visual feedback, several small interactive components still retained their framing. Removing borders from these "micro-elements" ensures a consistent, fluid design language where depth is defined by layer opacity rather than explicit lines. This aligns with the "glassmorphism" goal of the previous tasks.

### 3. Detailed Blueprint
- Update `ChatMessage.tsx` to remove borders from:
    - Markdown links (`a` tag).
    - Model metadata tags (`msg.model` container).
- Update `AIAssistant.tsx` to remove borders from:
    - "Jump to last" navigation button.
    - "Scroll to bottom" navigation button.
- Standardize backgrounds to `bg-white/5` or `var(--bone-6)` for these elements.

### 4. Operational Trace
- **ChatMessage.tsx**: 
    - Removed `border border-white/10` from links.
    - Removed `border border-[var(--bone-10)]/50` from model tags and simplified background to `bg-[var(--bone-6)]`.
- **AIAssistant.tsx**: 
    - Removed borders from floating navigation buttons and updated backgrounds to `bg-[var(--bone-6)]`.

### 5. Status Assessment
- **Completed**: Secondary and nested interactive elements in the chat are now borderless.
- **Result**: Visual cohesion achieved across the entire assistant module.
