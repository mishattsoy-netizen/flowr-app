User request: "change hover of these butotns to dark not bone"

### 0. Date and time of the request
Completed on: 25.05.2026 at 04:20

### 1. User request
"change hover of these butotns to dark not bone"

### 2. Objective Reconstruction
Modify the hover backgrounds of the interactive prompt action buttons at the bottom of the chat panel. 
Specifically:
- Plus button (`+`)
- Command slash button (`[/]`)
- Switch Model selector dropdown button (`DEFAULT ^`)
- Microphone voice input button (`[microphone]`)

Instead of resolving to a lighter, semi-transparent bone highlight overlay (`bg-white/5`), their backgrounds should change to a premium, dark, recessed background highlight (`bg-dark`, resolving to `#121212` in dark mode) when hovered.

### 3. Strategic Reasoning
- **Deep-Recessed Dark Contrast**: In the dark gray prompt bar background panel (`#262626` base), using off-white/bone highlights (`white/5`) stands out excessively and breaks the dark color uniformity. Replaced these highlights with a dark highlight (`bg-dark`/`#121212`) which creates a beautiful, premium recessed/indented visual feedback effect upon hover.
- **Unified Consistency**: Made sure all 4 active bar buttons are altered to the same hover style to preserve complete UX consistency.

### 4. Detailed Blueprint
- `src/components/assistant/AIAssistant.tsx`: Locate each of the four button declarations in the Action Bar at the bottom of the prompt container and replace `hover:bg-white/5` with `hover:bg-dark`.

### 5. Operational Trace
- **Modified `src/components/assistant/AIAssistant.tsx`**:
  - Plus upload button changed to `hover:bg-dark` inside standard JSX.
  - Slash command button changed to `hover:bg-dark` inside conditional class helper.
  - Switch Model button changed to `hover:bg-dark` inside conditional class helper.
  - Microphone button changed to `hover:bg-dark` inside conditional class helper.
- **Verified Codebase**: Executed `npx tsc --noEmit` to ensure TypeScript compilation succeeded with zero errors.

### 6. Status Assessment
- **Status**: 100% completed and verified.
- **Unresolved Items**: None.
