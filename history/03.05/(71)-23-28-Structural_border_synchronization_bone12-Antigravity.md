User request: "does chat border looks bone 12?"

### 1. Objective Reconstruction
Synchronize all primary structural borders (both sidebars and chat internal dividers) to the `bone-12` standard to ensure visual consistency across the interface.

### 2. Strategic Reasoning
To answer the user's question about the look of `bone-12`, it is essential that all similar structural elements share the same weight. By standardizing the main sidebar border and the chat dividers to `bone-12`, we eliminate discrepancies (previously `bone-15` for the main sidebar and `bone-6` for chat dividers) that could make the `bone-12` chat border look "wrong" or isolated.

### 3. Detailed Blueprint
- Update `Shell.tsx`:
    - Change left sidebar `border-r` from `bone-15` to `bone-12`.
- Update `AIAssistant.tsx`:
    - Change header `border-b` from `bone-6` to `bone-12`.
    - Change attachment container `border-t` from `bone-6` to `bone-12`.
    - Change footer `border-t` from `bone-6` to `bone-12`.
    - Change mic settings divider `border-t` from `bone-6` to `bone-12`.

### 4. Operational Trace
- **Shell.tsx**: Updated the right border of the left sidebar to `border-[var(--bone-12)]`.
- **AIAssistant.tsx**: Performed a global replacement of `border-[var(--bone-6)]` with `border-[var(--bone-12)]` for all horizontal dividers and settings panels.

### 5. Status Assessment
- **Completed**: Structural border weight synchronized across the entire application shell.
- **Result**: A more cohesive and intentional design where all frame elements share the same subtle density.
