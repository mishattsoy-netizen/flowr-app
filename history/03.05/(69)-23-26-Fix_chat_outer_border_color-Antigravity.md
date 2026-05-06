User request: "fix chat outer border color to bone 12"

### 1. Objective Reconstruction
Standardize the primary container border of the AI Assistant chat window by switching from the accent-themed border to a more subtle "bone 12" variable (`--bone-12`).

### 2. Strategic Reasoning
The user wants to move away from high-contrast accent borders for major containers. Using `--bone-12` (a low-opacity off-white) provides a sophisticated, "ghost-like" boundary that integrates better with the sidebar background while still providing enough definition. Removing the hover-based border intensity change also creates a more stable visual experience.

### 3. Detailed Blueprint
- Locate the main `clsx` block for the AI Assistant's fixed container in `AIAssistant.tsx`.
- Replace `border-accent/25` and `hover:border-accent/45` with `border-[var(--bone-12)]`.

### 4. Operational Trace
- **AIAssistant.tsx**: Modified the container's className to use `border-[var(--bone-12)]` and removed the interactive hover border classes.

### 5. Status Assessment
- **Completed**: Chat outer border updated to bone 12.
- **Result**: Visual noise reduced, following the new "borderless/subtle-border" design direction.
