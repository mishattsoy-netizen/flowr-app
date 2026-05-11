User request: "phase 4"

### 1. Objective Reconstruction
Execute the Phase 4 operations: Chat Interface & Formatting. The primary goal is resolving systemic visual layout regressions mirroring rigorous Claude aesthetics, deploying intelligent dropdown reasoning viewers, fixing pipeline casing string representations, and stopping hidden block leaks.

### 2. Strategic Reasoning
An overarching overhaul of `ChatMessage.tsx` was mandated. Since multiple markdown elements required conditional interaction (e.g. `strong` fonts inside `tables`, or compacting `code` snippets contextually), establishing an `InTableContext` react hook architecture was crucial to elegantly cascade states. The `<think>` rendering logic required memoized intercepts pulling tags directly from raw stream blocks, combined with conditional state flags tied to global configuration layers guaranteeing adherence to user settings.

### 3. Detailed Blueprint
- Intercept `<system-notes>` blocks explicitly within `sanitizeContent`.
- Remove `.toLowerCase()` coercion from running pipeline goals.
- Impose standard font-size constants (`28px, 24px, 20px`) overriding auto-calculators on H1-H3 headers.
- Extend `max-w` constraints on bot bubbles from 97% to 99% for better table reflow handling.
- Establish `InTableContext` propagating down to `code` blocks converting monolithic `pre` wrappers into ultra-dense inline pills when housed inside table bodies.
- Apply `__` string detection to `strong` tags applying explicit `font-semibold` mapped overrides bypassing fallback 700-weight bounds.
- Restrict `Crimson Text` cascading into table grids keeping them `mono`/`sans` respectively.
- Deploy the "Show thinking" Dropdown triggered by the `<Brain>` icon. Wire globally to `useStore(s => s.thinkingEnabled)`. 

### 4. Operational Trace
- Edited `src/components/assistant/components/ChatMessage.tsx` comprehensively.
- Embedded `React.createContext` wrapped across native `table:` markdown configurations.
- Refactored `code:` and `strong:` mapping logic intercepting the local table context and rendering contextual classes matching strict audit criteria.
- Implemented `<think>` parsing blocks caching inner reasoning strings natively outside of standard display arrays.
- Rendered the toggle accordion immediately above `ReactMarkdown` injections displaying dynamic thinking loops safely behind `hasThinking` flags.
- Patched animation loop firing early completions by adding explicit `if (targetContent.length === 0)` timeout blocks.

### 5. Status Assessment
All Phase 4 UI and Chat Interface refinements have been fully successfully integrated and mapped perfectly against desired outcomes. Ready to proceed with the next actions in the queue.
