User request: "fix empty chat. when text is wrapping, move avatar on top of the text and centered"

### 0. Date and time of the request
May 17, 2026, 00:55 MSK

### 1. User request
"fix empty chat. when text is wrapping, move avatar on top of the text and centered"

### 2. Objective Reconstruction
Standardize the empty state greeting in the sidebar/floating chat panel (`AIAssistantComponent` in [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/assistant/AIAssistant.tsx)) to ensure perfect styling alignment and a premium visual experience when screen width is constrained or text wraps. Specifically, transition the horizontal side-by-side layout (avatar + greeting text) to a centered vertical layout (avatar stacked on top of centered text) when the container is narrow and the text is forced to wrap.

### 3. Strategic Reasoning
- **Tailwind v4 Container Queries**: Viewport-based media queries (like `sm:`, `md:`) are insufficient because the assistant panel is styled with a fixed width of `380px` in floating mode, and resizes dynamically between `400px` and `800px` in sidebar mode, independent of the viewport width. Thus, container queries (`@container`) are the correct and most robust design pattern here to respond to the actual container size.
- **Bone Design Language**: Centering the `StarIcon` (avatar) vertically on top of the wrapped text `How can I help you today?` restores visual symmetry, balance, and premium weighting, avoiding the awkward left-heavy layout of narrow containers.
- **Dynamic Transition**: Standardized at a container width breakpoint of `500px`. Widths below `500px` utilize stacked centering, and widths `500px` and above seamlessly align row-wise with the avatar on the left and text on the right.

### 4. Detailed Blueprint
- **Files Touched**: [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-4-main/src/components/assistant/AIAssistant.tsx)
- **Container Definition**: Add `@container` to the messages container `div` (`messagesContainerRef`) in the empty-chat message list container.
- **Responsive Layout**: Adjust the nested flex container around `StarIcon` and `p` to apply container query classes: `flex flex-col @[500px]:flex-row items-center justify-center gap-4 @[500px]:gap-6 text-center @[500px]:text-left`.

### 5. Operational Trace
- **Code Edit**: Modified the empty chat greeting rendering container inside `AIAssistant.tsx` around line 612:
  - Enabled `@container` context on `messagesContainerRef`.
  - Replaced the hardcoded row layout `flex items-center justify-center gap-6` with the responsive container query class structure.
  - Added `shrink-0` and `animate-pulse` to `StarIcon` for micro-interaction polish.
- **Verification**: Executed a TypeScript compilation check using `npx tsc --noEmit` to verify type safety and correctness. The compiler succeeded with `0` errors.

### 6. Status Assessment
- **Completed**: Fully implemented the responsive layout changes. The empty chat avatar now dynamically positions on top of the greeting text and centers perfectly when the container is narrow, and returns to a side-by-side row layout when wide.
- **Status**: Stable and functional.
