# ULTIMATE RESTORATION MASTERPLAN — SYSTEM-WIDE RECOVERY

This is the absolute source of truth enumerating every user-directed frontend enhancement lost in the May 9th hard regression event. Verified via forensic traces of history logs `(1)` through `(108)`.

---

## 🟢 Phase 1: Global Core & Layout (High Leverage)
Restoring baseline styles that impact uniform consistency across all views.

- [ ] **Fix 1.1: Global Brand Blue Injection (`globals.css`)**
  - Define `--color-brand-blue: #2A78D6` and `--brand-blue: #2A78D6` inside `:root`.
  - Modify active state for `.toggle-switch` to use background and border colors of `#2A78D6`.
- [ ] **Fix 1.2: Header "Cloud Pill" Styling (`HeaderBar.tsx`)**
  - Remove border utilities (`border`, `border-accent/20`).
  - Change corner profile from `rounded-full` to `rounded-[var(--radius-small)]`.
  - Adopt base transparency backgrounds: `bg-[var(--bone-6)]`.
- [ ] **Fix 1.3: Popover Persistent Hover State**
  - Update `ProviderSelector.tsx` and `RowOptionsDropdown` to inject `isOpen && "bg-white/5 text-bone-100"` on the trigger buttons so they retain active highlights while popups sit open.

---

## 🔵 Phase 2: The Canvas Module (Excalidraw-Lite Functional Overhaul)
Reinstating both visual designs AND the entire advanced SVG spline architecture.

### 2A: Visual Refinement
- [ ] **Fix 2.1: Excalidraw "Floating Text" Conversion (`CanvasBlock.tsx`)**
  - Replace text-block standard background card wrappers with `bg-transparent border-0 p-0 shadow-none`.
  - Introduce dashed selector outlines: `border-dashed border-[var(--bone-100)] rounded-sm`.
- [ ] **Fix 2.2: System Blue Highlight Migration**
  - Swap `border-blue-500` handles in `ResizeHandle.tsx` to `border-brand-blue`.
  - Update active selection classes inside `CanvasBlock.tsx` targeting standard Tailwind blue to brand-blue.
- [ ] **Fix 2.3: Marquee Selection Colors (`CanvasPage.tsx`)**
  - In multi-selection and drawing calculations, update direct RGB from orange to brand blue `rgba(42, 120, 214)`.
- [ ] **Fix 2.4: Background Geometry Overhaul**
  - Restore the "Squares" grid canvas background generation logic.

### 2B: Logical Spline Engine (HIGH PRIORITY LOGIC RECOVERY)
- [ ] **Fix 2.5: Click-and-Flow Spline Infrastructure**
  - Declare `isDrawing`, `currentPath`, and `mousePosition` hooks in `CanvasPage.tsx`.
  - Bind global Esc/Enter/Right-Click routines to commit active segments into DB.
  - Implement Catmull-Rom spline curve generation inside `SmartArrowEdge.tsx` utilizing user-defined `pathPoints`.
- [ ] **Fix 2.6: Proximity Snapping & Dynamic Pinning**
  - Inject `findClosestBlockHandle` utility inside `CanvasPage.tsx` with `120px` proximity threshold.
  - Map `fromId`, `fromSide`, `toId`, and `toSide` snapping identifiers into connection persistence payload.
  - Condition-gate `SmartArrowEdge` to automatically dynamic-override path terminus points with shape coordinates on drag.
- [ ] **Fix 2.7: Connection Hitbox Selection Layer**
  - Set `pointer-events: auto` on transparent shadow hitboxes for paths in `SmartArrowEdge.tsx` connecting to global `onSelect` handler.
  - Add multiple custom color `<marker>` definitions inside `CanvasConnections.tsx` `<defs>` container to permit colored arrowheads matching styled line colors.

---

## 🟣 Phase 3: The Tracker Module
Refactoring the task management engine back into its high-density refined modal view.

- [ ] **Fix 3.1: Circular Color Header Picker (`TrackerPage.tsx`)**
  - Swap the header checkbox element for the `<Popover>` circular palette component using `localColor`.
- [ ] **Fix 3.2: Footer Advanced Actions Sub-Layout**
  - Destroy the dual-column Workspace/Color selector in the modal body; collapse to single column.
  - Implement the new footer action group: contextual Primary Action button alongside Caret-Triggered status menu overrides (`Restore`, `Reschedule`, `Complete`).
- [ ] **Fix 3.3: Persistence Handlers**
  - Ensure `autoSave` unmount lifecycle triggers function correctly preserving task state when switching tabs or closing the expander panel.

---

## 🟠 Phase 4: Chat Interface (Detailed UI/UX Restorations)
Rescuing the detailed Claude-tier formatting attributes inside `ChatMessage.tsx`.

- [ ] **Fix 4.1: Case-Sensitive Pipeline Status Labels**
  - Purge `.toLowerCase()` filter on `activeStep.goal` processing logic.
- [ ] **Fix 4.2: Double-Tiered Bold/Italic Parser**
  - Re-implement ReactMarkdown strong parser intercepting `__text__` string offsets for dynamic Semibold vs. Heavy-Bold Weight toggling.
- [ ] **Fix 4.3: The "InTableContext" Adaptive Handler**
  - Re-inject the React context provider wrapping standard markdown `table`.
  - Update markdown `code` block to conditional-check this context and render ultra-compact inline code styles when residing inside a table column.
- [ ] **Fix 4.4: Non-Crimson Font Inhibit**
  - Block Crimson Text family cascading inside table-specific containers to retain Sans reading clarity.
- [ ] **Fix 4.5: Global Typography Density Control**
  - Globally enforce `leading-[133%]` on all paragraphs, list items, and blockquotes.
  - Tighten list layout flow to `space-y-[0.3rem]`.
- [ ] **Fix 4.6: Assistant Width Threshold (99%)**
  - Expand base flex container limit from `max-w-[97%]` to absolute boundary `max-w-[99%]`.
- [ ] **Fix 4.7: Brand Blue Loading Indicators (`AIAssistant.tsx`)**
  - Shift circular SVG progress token tracker from generic tailwind palette to absolute `text-brand-blue`.

---

## 🔴 Phase 5: Note Editor (Rich Content Integrity)
Resuscitating the programmable formatting safeguards and unique block types inside `BlockRenderer.tsx`.

- [ ] **Fix 5.1: Programmatic Copy Interception Root Cause**
  - Force `const lastTypedContent = useRef<string | null>(null)` back into existence.
- [ ] **Fix 5.2: Monospace "Card" Rendering Architecture**
  - Elevate standard styling condition to proper isolated container view: `bg-black/40`, `overflow-x-auto`, hard whitespace locks.
  - Overlay dynamic absolute-positioned "Copy" utility top-right.
- [ ] **Fix 5.3: Link-Button Component Creation**
  - Re-declare `BlockType.link` and render explicit 8px-pill clickable buttons integrating favicon resolution.
- [ ] **Fix 5.4: 2px Baseline Grid Shift**
  - Rescale text steps: Title (30px), Heading (26px), Subheading (22px), Body/Lists (19px), Mono (15px).
- [ ] **Fix 5.5: Slash Command Shortcut UI Refinements**
  - Restore `medium` weight caps and zero-border visual caps into the hotkey badges mapped inside `SlashCommandMenu.tsx`.
- [ ] **Fix 5.6: Markdown Inline Pre-Parsing Logic**
  - Reinject `inlineMarkdownToHtml` sanitation gates into state saving utilities preventing syntax injection leaks.

---

## 🟡 Phase 6: Router Administration UX
- [ ] **Fix 6.1: RPD Compact Number Display**
  - Inject custom numeral formatting utility (e.g., "1.5k") rather than direct integer rendering in the quota column.
- [ ] **Fix 6.2: Router Row Item Gaps**
  - Compress flex gap configurations from `gap-2.5` down to `gap-1.5` to prevent action overflows.
- [ ] **Fix 6.3: Full Provider Slug Visibility**
  - Remove `capitalize` filters on OpenRouter routing selectors to strictly convey the accurate programmatic slug name (e.g., `google-ai-studio`).
