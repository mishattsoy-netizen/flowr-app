User request: "change modes button style and animations to same as tools button"

### 0. Date and time of the request
May 19, 2026, 00:23

### 1. User request
"change modes button style and animations to same as tools button"

### 2. Objective Reconstruction
Unify the aesthetic design and interactive states of the model mode selector button with the tools button in the chat assistant input bar, making both buttons borders-free and giving them matching background hover, active click, and font weight states.

### 3. Strategic Reasoning
- Previously, the mode selector (DEFAULT) button possessed an explicit border (`border-[var(--bone-12)]`) and slightly different font weight (`font-bold`), which contrasted with the cleaner border-less design and `font-semibold` of the Tools button.
- Removing borders and aligning background hover classes (`hover:bg-white/5` and `bg-white/10 text-foreground`) creates a unified and harmonious control bar design as requested.
- Keeping the chevron transition allows smooth orientation changes on click while conforming style and visual state changes to the Tools button.

### 4. Detailed Blueprint
- **Files Involved**: `src/components/assistant/AIAssistant.tsx`
- **Class and Style updates**:
  - Remove `border` and `border-[var(--bone-12)]` classes from the mode button.
  - Standardize text and active states: change `text-bone-100` / `text-bone-70 hover:text-bone-100` to `text-foreground` / `text-bone-70 hover:text-foreground hover:bg-white/5`.
  - Adjust label span font weight from `font-bold` to `font-semibold`.

### 5. Operational Trace
- **Modified mode selector button**:
  - Replaced the `className={cn(...)}` block of the mode selector button starting at line 883.
  - Adjusted the button inner span tracking and font-weight class from `font-bold` to `font-semibold`.
- **Validation**:
  - Successfully ran `npm run build` compilation checks to confirm the compilation was perfect with no TypeScript or syntactic errors.

### 6. Status Assessment
- **Completed**: Borderless, unified mode selector matching the Tools button design.
- **Verification**: Verified successfully via compiling checks.
