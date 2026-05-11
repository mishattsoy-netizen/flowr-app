User request: "image 1 is how modal is supposed to look like image 2 is how it looks right now"

### Objective Reconstruction
Redesign the `NewTaskModal` component to achieve 1:1 visual parity with the provided target mockup (Image 1), adhering to the project's "Bone" design aesthetic (dark, premium, minimalist glassmorphism).

### Strategic Reasoning
I performed a side-by-side comparison of the current state and the target image. The main differences were in structural framing (description box), iconography (Priority and Workspace icons), typography (uppercase tracking), and interactive element styling (circular toggles, square close buttons). I used the project's established "Bone" design tokens (`--bone-5` to `--bone-100`) and the `PREFERENCES.md` guidelines to ensure the new design felt integrated. Key changes included moving the subtask addition logic into a unified square-button layout and simplifying the footer to use text-based primary actions.

### Detailed Blueprint
- **Global Structure**: Reduced `max-w` to 520px and switched to `bg-panel/95 backdrop-blur-xl`.
- **Header**: Implemented a thin decorative top bar, a custom circular completion toggle, and a square-boxed close button.
- **Description**: Wrapped the textarea in a framed `bg-[var(--bone-5)]` container with a subtle border.
- **Subtasks**: Refined the "Add subtask" section to use a unified input + square `+` button layout.
- **Iconography**: 
    - Switched "Priority" icon to `AlertCircle`.
    - Switched "Workspace" icon to `Folder`.
- **Typography**: Applied `text-[11px] font-semibold tracking-[0.06em]` to section labels.
- **Interactive Elements**: Updated priority buttons and color picker dots to match the ring-style selection indicators in the mockup.
- **Footer**: Removed the filled "Done" button in favor of a clean, text-only "Done" action on the right.

### Operational Trace
1.  **Modified `src/components/modals/NewTaskModal.tsx`**: 
    - Updated container classes for width and backdrop blur.
    - Redesigned the header section (Title input, completion circle, close button).
    - Refactored the description area into a framed block.
    - Updated subtask list and composer styling.
    - Corrected icons for Priority (`AlertCircle`) and Workspace (`Folder`).
    - Standardized labels and spacing.
    - Redesigned the footer layout and "Done" button style.
2.  **Cleaned up imports**: Removed unused `Flag` and `Briefcase` icons.

### Status Assessment
- **Completed**: The `NewTaskModal` now matches the visual hierarchy and stylistic details of Image 1.
- **Verified**: All icons, colors, and layouts are aligned with the "Bone" aesthetic and the specific mockup provided.
