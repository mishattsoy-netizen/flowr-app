# 🏛️ THE ABSOLUTE MONOLITHIC RECONSTRUCTION MASTERPLAN

This document aggregates ALL specific action items from explicit user-provided report lists (May 7th, 8th, and 9th). It contains 100% standalone coding directives allowing full application recovery without past context.

---

## 🌍 PHASE 1: CORE LAYOUT & GLOBAL DESIGN

- [ ] **Fix 1.1:** Global Brand Blue Theme Injection `(Report 49)`
  - **File:** `src/styles/globals.css`
  - **Action:** Inside `:root`, explicitly declare `--color-brand-blue: #2A78D6` and `--brand-blue: #2A78D6`. Modify `.toggle-switch:checked` to reference `var(--brand-blue)`.
- [ ] **Fix 1.2:** Header "Cloud Pill" Styled Borderless with Small Corners `(Report 6)`
  - **File:** `src/components/layout/HeaderBar.tsx`
  - **Action:** Remove border classes (`border`, `border-accent/20`). Change outer corner from `rounded-full` to `rounded-[var(--radius-small)]`. Use `bg-[var(--bone-6)]`.
- [ ] **Fix 1.3:** Fix Sidebar Content Disappearance / Cloud Sync Violations `(Report 50)`
  - **File:** `src/lib/hooks/useWorkspaceState.ts`
  - **Action:** Stop auto-background cleanup cycles from clearing state buckets when cycling tabs by strictly gating deletions to the active workspace index.
- [ ] **Fix 1.4:** Deploy Page-Specific Cloud Sync Isolation `(Report 51)`
  - **File:** `src/app/dashboard/page.tsx`
  - **Action:** Add explicit `.eq('workspaceId', currentWorkspaceId)` filtering directly into Firestore/DB data fetches to prevent active state leaks.
- [ ] **Fix 1.5:** Persistent Hover Background Highlight on Active Popups `(Report 76)`
  - **File:** `src/components/ui/ProviderSelector.tsx`
  - **Action:** Add standard check: `className={cn("...", isOpen && "bg-white/5 text-bone-100")}` locking background fill while popovers remain mounted.
- [ ] **Fix 1.6:** Unify 16px (`rounded-2xl`) Border Radius Across Artifacts `(Report 94)`
  - **Files:** `tailwind.config.ts`, `ChatMessage.tsx`
  - **Action:** Worldwide replace arbitrary `rounded-xl` (12px) with strict `rounded-2xl` (16px) for user bubbles, markdown tables, and markdown container cards.
- [ ] **Fix 1.7:** Global Font Weight Shift to Medium (500) `(Report 51 from 07.05)`
  - **File:** `src/app/globals.css`
  - **Action:** Append global override `@layer base { body { font-weight: 500; } }` and specifically set tailwind helpers `.font-thin, .font-extralight, .font-light, .font-normal { font-weight: 500 !important; }` to completely ban thin typography weights system-wide.
- [ ] **Fix 1.8:** Restore Triple-Pane Wide Layout Alignment `(Visual Audit)`
  - **Files:** `src/app/dashboard/page.tsx`, `MainLayout.tsx`
  - **Action:** Confirm flex/grid registry allows full screen expansion exposing Left Workspace Navigation, Center Multi-column Note Editor viewport, and Right Floating Agent chat panel concurrently matching visual desktop reference.

---

## 🎨 PHASE 2: THE CANVAS SYSTEM (EXCALIDRAW-LITE)

- [ ] **Fix 2.1:** Multi-Element Drawing Shape & Multi-Selection Logic Fixes `(Report 1)`
  - **File:** `src/components/canvas/CanvasPage.tsx`
  - **Action:** Patch selection rect boundary tracking logic to eliminate cumulative recursive reference overflows on selection reset.
- [ ] **Fix 2.2:** Synchronized Multi-Element Dragging `(Report 2)`
  - **File:** `src/components/canvas/CanvasPage.tsx`
  - **Action:** In `onPointerMove`, calculate relative translation vector `dx = cur.x - start.x` once, applying the exact linear delta uniformly to the absolute coords of ALL items inside `selectedElements` array.
- [ ] **Fix 2.3:** Sidebar Layout and Spacing / Corner Profile Restorations `(Report 3)`
  - **File:** `src/components/canvas/CanvasSidebar.tsx`
  - **Action:** Audit internal padding classes replacing `p-4` generic utilities with brand dynamic minimums identified in layout audit logs.
- [ ] **Fix 2.4:** Background Grid Changed to "Squares" Rendering `(Report 4)`
  - **File:** `src/components/canvas/CanvasBackground.tsx`
  - **Action:** Transition generation engine from rendering repeated SVG `<circle>` tags into interlaced geometric `<pattern>` intersecting lines creating squares.
- [ ] **Fix 2.5:** Set Grid Pattern Background to absolute `bone-3` Color depth `(Report 5)`
  - **File:** `src/components/canvas/CanvasBackground.tsx`
  - **Action:** Force mapping line colors directly targeting hex string representative of `bone-3` background tier.
- [ ] **Fix 2.6:** Re-enable Bot-Triggered Canvas Block Creation Handlers `(Report 43)`
  - **File:** `src/lib/bot/executeTool.ts`
  - **Action:** Reconnect direct switch branch linking incoming LLM calls specifying `target: "canvas"` directly into DB creation dispatches.
- [ ] **Fix 2.7:** Layout Fix correcting Flowchart Object Overlap `(Report 44)`
  - **File:** `src/lib/bot/layoutEngine.ts`
  - **Action:** Introduce minimum relative step generator (250px displacement vectors) enforcing distinct physical slots on grid when spawning concurrent shapes via AI.
- [ ] **Fix 2.8:** Remove the Background Container Box on Text Blocks `(Report 45)`
  - **File:** `src/components/canvas/CanvasBlock.tsx`
  - **Action:** Branch render paths: for block type 'text', fully disable visual background `bg-transparent border-0`. Only trigger visible `dashed` border outlines upon explicitly checking `isSelected`.
- [ ] **Fix 2.9:** Enable DblClick Edit Lock preventing inadvertent drag operations `(Report 46)`
  - **File:** `src/components/canvas/CanvasBlock.tsx`
  - **Action:** Bind guard `if (isEditingText) return;` to generic cursor interaction handlers inhibiting inadvertent node movement while typing inside shapes.
- [ ] **Fix 2.10:** Blue Selection Box Overlay with Circular Interaction Handles `(Report 47)`
  - **File:** `src/components/canvas/ResizeHandle.tsx`
  - **Action:** Rebuild standard rectangle handles into circular discs using standard `rounded-full` and colorize explicitly referencing `border-brand-blue`.
- [ ] **Fix 2.11:** Canvas Module Custom Brand Blue Theme Injection `(Report 48)`
  - **File:** `src/components/canvas/CanvasPage.tsx`
  - **Action:** Perform total purge of arbitrary tailwind native blue shades (`blue-500`) swapping to dynamic variable `var(--brand-blue)`.
- [ ] **Fix 2.12:** Selection Box Dash Border Style Calibration `(Report 52)`
  - **File:** `src/components/canvas/CanvasPage.tsx`
  - **Action:** On the active marquee overlay SVG rect element, fix literal parameter `strokeDasharray="5 5"`.
- [ ] **Fix 2.13:** Solidify Selection Box Border Width to absolute 2px `(Report 53)`
  - **File:** `src/components/canvas/CanvasPage.tsx`
  - **Action:** Standardize fixed dimension attribute `strokeWidth="2"` replacing implicit one-pixel defaults.
- [ ] **Fix 2.14:** Click-and-Flow Multi-Segment Spline Path Drawing Logic `(Report 58)`
  - **Files:** `src/components/canvas/CanvasPage.tsx`, `SmartArrowEdge.tsx`
  - **Action:** Initialize specialized `drawPath` workflow saving sequential pointer click nodes. Feed dynamic coordinate arrays into Catmull-Rom interpolation generator producing continuous smoothed curved vector strings.
- [ ] **Fix 2.15:** Dynamic Connection Pinning to Object Center Dots and Edge Faces `(Report 59)`
  - **File:** `src/components/canvas/CanvasPage.tsx`
  - **Action:** Implement math check during drag release. Calculate Euclidean distance against blocks. Set hard threshold `120px`. If met, dynamically force spline anchor attachment to boundary midpoint caching `fromId` / `toId`.
- [ ] **Fix 2.16:** Precise Spline Arrow Selection & Anchor Point Editing `(Report 60)`
  - **File:** `src/components/canvas/SmartArrowEdge.tsx`
  - **Action:** Overlay the primary path with a transparent path (`stroke="transparent"`) using massively thicker bounding weight (`strokeWidth={20}`) handling high-sensitivity click collision resolution.
- [ ] **Fix 2.17:** Restore Canvas Object Hydration Logic inside standard `applyCanvas` hooks `(Report 104)`
  - **File:** `src/lib/bot/hooks/useAIActions.ts`
  - **Action:** Patch standard interceptor function ensuring parsed JSON blocks from AI are pushed into local store hydrate method `applyCanvasUpdate` saving them permanently to DB.

---

## ✅ PHASE 3: TRACKER & MODAL ENGINE

- [ ] **Fix 3.1:** Ensure Modal Unmount AutoSave & Task Completion Persistence Toggles `(Report 35)`
  - **File:** `src/components/tracker/TrackerModal.tsx`
  - **Action:** Embed synchronous save API dispatchers in component standard `useEffect` cleanup function safely persisting pending inputs to database on close.
- [ ] **Fix 3.2:** Strip explicit "Description" Header Label inside the modal body `(Report 36)`
  - **File:** `src/components/tracker/TrackerModal.tsx`
  - **Action:** Terminate explicit redundant title labels reducing modal noise footprint.
- [ ] **Fix 3.3:** Remove the "No Subtasks Added Yet" fallback indicator text `(Report 37)`
  - **File:** `src/components/tracker/TrackerModal.tsx`
  - **Action:** Delete the redundant ternary string rendering placeholder text when array count hits zero.
- [ ] **Fix 3.4:** Restore functional Unselection for Priority Levels `(Report 38)`
  - **File:** `src/components/tracker/TrackerModal.tsx`
  - **Action:** Enhance button callback: toggling a currently active priority level now writes a literal `null` reset flag into state.
- [ ] **Fix 3.5:** Reinject the "New Task" Direct Action Button inside the Modal Header `(Report 39)`
  - **File:** `src/components/tracker/TrackerPage.tsx`
  - **Action:** Reinstall top-header quick-action button triggering immediate fresh creation loop.
- [ ] **Fix 3.6:** Circular Header Color Selector Swap & Advanced Footer Secondary Action Drawer `(Report 40)`
  - **File:** `src/components/tracker/TrackerModal.tsx`
  - **Action:** Merge generic color picker into circular palette popover. Move archive/delete utilities down into standardized footer action popover hidden beneath explicit caret button.
- [ ] **Fix 3.7:** Core Tracker Card Embedded Subtasks & Data-Clamping `(Report 32 from 08.05)`
  - **File:** `src/components/tracker/TaskCard.tsx`
  - **Action:** Redesign cards to instantly expose checklist data. Clamp description lines strictly to 2 rows (`line-clamp-2`). Expose max-height limit displaying ONLY the first 3 subtasks visually on card, followed by "+X more" text marker.
- [ ] **Fix 3.8:** Standardize Task Modal/Card Corners strictly to 16/12 `(Report 33 from 08.05)`
  - **Files:** `TrackerPage.tsx`, `TaskCard.tsx`
  - **Action:** Hard-lock modal wrapper element to `rounded-[16px]`. Set the draggable Kanban board cards container and the dynamic dropping shadow placeholder both to exactly `rounded-[12px]`.
- [ ] **Fix 3.9:** Implement Local Input States preventing Modal Focus-Loss Reset `(Report 31 from 08.05)`
  - **File:** `src/components/tracker/TrackerPage.tsx`
  - **Action:** Decouple live text inputs from direct Zustand hooks to eliminate typing reset lag. Introduce `localTitle` and `localNote` inside modal React closure. Synchronize back to main store ONLY upon controlled save events or focus drop.
- [ ] **Fix 3.10:** Rearrange Modal Flow & Sidebar Context Layout `(Report 34 from 08.05)`
  - **File:** `src/components/tracker/TrackerPage.tsx`
  - **Action:** Total internal DOM reorganization matching ordered schema: (1) Edit Title Input, (2) Multi-line Description Box, (3) Subtasks Widget, (4) Side-by-side row for DueDate + Priority badges, (5) Side-by-side row containing direct Workspace Popover switch and Custom Circle Colors.
- [ ] **Fix 3.11:** Restore Schema Compatibility for Dual Property write (Note / Description) `(Report 31 from 08.05)`
  - **File:** `src/components/tracker/TrackerPage.tsx`
  - **Action:** Verify task update methods maintain compatibility by writing active text states into BOTH duplicate schema attributes `note` and `description` concurrently.
- [ ] **Fix 3.12:** Resolve Clsx Missing Reference runtime panic `(Report 30 from 08.05)`
  - **File:** `src/components/tracker/TrackerPage.tsx`
  - **Action:** Prepend absolute missing core module load `import clsx from 'clsx';` resolving direct runtime ReferenceErrors.
- [ ] **Fix 3.13:** Final Visual UI Reconciliation of Task Modal from Reference Image `(Visual Confirmation)`
  - **File:** `src/components/tracker/TrackerPage.tsx`
  - **Action:** Audit modal layout against target image. **Header:** Circular checkbox left, Title center-left, Square framed 'X' top-right. **Body:** Huge description input block first with `Write description or notes...`. **Subtasks:** Label icon + `SUBTASKS` text capitalized, beneath it a composite input holding `Add new subtask...` integrated beside a standalone encapsulated `+` button. **Rows:** Two identical stacked flex rows holding paired groups: (Due Date | Priority Buttons group) and (Workspace Dropdown | Category Color circular swatches). **Footer:** Fixed static action bar presenting red `Delete Task` (icon+text) pushed far bottom-left, and standard weight `Done` button aligned far bottom-right.

---

## 💬 PHASE 4: CHAT INTERFACE & FORMATTING

- [ ] **Fix 4.1:** Correct Meta Instructions / Hidden Block Content Leak Logic `(Report 41)`
  - **File:** `src/lib/bot/sanitize.ts`
  - **Action:** Secure regex processing pipelines strictly scanning and intercepting explicit tags like `<system-notes>` preventing unparsed backend guidance leaking into user-facing bubbles.
- [ ] **Fix 4.2:** Correct Assistant Pipeline Status Message Position & Theme `(Report 67)`
  - **File:** `src/components/assistant/components/PipelineStepDisplay.tsx`
  - **Action:** Center the dynamic floating action text label in standard flex layout instead of raw overlapping absolute positioning.
- [ ] **Fix 4.3:** Honor strict Pipeline Object Casing throughout Step Tracking `(Report 86)`
  - **File:** `src/components/assistant/components/PipelineStepTracker.tsx`
  - **Action:** Cut explicit function `.toLowerCase()` occurring in status text print output loop, letting raw dataset case preserve natively.
- [ ] **Fix 4.4:** Realign UI code parsing strictly matching Claude Formatting Styles `(Report 87)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Re-baseline parser mappings to mirror aesthetic layout densities utilized in standard Claude style outputs documented in audit.
- [ ] **Fix 4.5:** Restore Character-Cycle Typing Animation & Synchronous Error View Logic `(Report 90)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Inject conditional block `if (targetContent.length === 0) return;` enforcing standard guard preventing 1.5s safety timeouts triggering early completion switches. Connect runtime error streams to absolute display override ensuring visible feedback.
- [ ] **Fix 4.6:** Inject Double-Underscore Lookup supporting Semibold text variants `(Report 91)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Inspect markdown node source text lookup `raw.substr(start, 2) === '__'`. Map dual underscore string tags precisely onto `font-semibold` weight (600) bypassing fallback to generic bold tag (700).
- [ ] **Fix 4.7:** Pass `InTableContext` ensuring Code-in-Cell aesthetic degrades gracefully `(Report 92)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Declare `React.createContext(false)` as InTable state. Wrap markdown mapping for `<table>` tag with generic Provider setting `value={true}`. Update markdown components for `code` check subscription; if true, return ultra-compact flex pill instead of standardized full-block card.
- [ ] **Fix 4.8:** Lock Text-Line Heights to `133%` and List Gaps to `0.3rem` `(Report 93)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Append global styling classes `leading-[133%]` for all generic text tags, inject `space-y-[0.3rem]` explicitly onto `ul`, `ol` container elements.
- [ ] **Fix 4.9:** Relax Bot Bubble Max-Width container constraints to `99%` `(Report 95)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Modify central horizontal container definitions forcing boundary ceiling upwards strictly from `97%` to absolute maximum `99%`.
- [ ] **Fix 4.10:** Impose Static Header Scaling: H1=28px, H2=24px, H3=20px `(Report 96)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Inside component lookup dict for h1-h3, strictly configure inline literal styles utilizing exact pixel constants bypassing auto-calculators.
- [ ] **Fix 4.11:** Tighten Chat Table Row Padding Density `(Report 97)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Reduce existing vertical row spacing constants strictly from 12px to new constrained 10px (`py-2.5`).
- [ ] **Fix 4.12:** Clamp and block Crimson Font cascades specifically within Table Grid bodies `(Report 99)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Within `strong` tag component, read Context Hook `inTable`. If active, block crimson font activation allowing clean inherited typography cascade to succeed.
- [ ] **Fix 4.13:** Gemini-Style sleek "Show thinking" dropdown accordion `(Report 21 from 08.05)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Re-implement gorgeous dropdown. Extract `<think>` blocks using memoized regex. Replace raw dev-checkbox-steps list with aesthetic `Brain` link trigger, displaying reasoning using italic text, elegant left accent border, and a subtle pulse animation on running step labels.
- [ ] **Fix 4.14:** Hide Thinking Dropdown when mode disabled globally `(Report 22 from 08.05)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Fetch global `thinkingEnabled` state via store hook and modify `hasThinking` Boolean equation strictly to `thinkingEnabled && (...)`, masking UI indicators 100% if global toggle is OFF.
- [ ] **Fix 4.15:** Deploy Live "Screen Context" Sharing & Suggestion Action Cards `(Report 28 from 08.05)`
  - **Files:** `AIAssistant.tsx`, `ChatMessage.tsx`, `store.ts`
  - **Action:** Inject glowing `Monitor` toggle button next to prompt toolbar. Set `isSharingScreenContext` boolean. If true, `sendAIMessage` bundles deep layout JSON for canvas (coords, layers) and notes, sending as `screenContext` in API payload. In frontend, map special AI output blocks ```apply-canvas``` and ```apply-note``` to custom React component Cards offering beautiful glowing single-click "Apply Changes" buttons.
- [ ] **Fix 4.16:** Build Telegram-style Reply/Mention Interface with scrolling highlights `(Report 40 from 07.05)`
  - **Files:** `ChatMessage.tsx`, `AIAssistant.tsx`, `globals.css`
  - **Action:** Insert hover-reveal curved reply action button on messages. Create a floating Reply Preview Banner bar locking text inside it above the input panel. Clicking text fires specific `scrollIntoView` trigger targeting HTML ID `msg-row-${id}` and applies CSS class `pulse-highlight` triggering brief background glow.
- [ ] **Fix 4.17:** Refined Pipeline Thinking stabilization and default Keyword maps `(Report 7 from 08.05)`
  - **Files:** `chainRouter.ts`, `classifier.ts`
  - **Action:** Define robust `DEFAULT_KEYWORDS` (research, search, code) backing up DB to prevent routing drops. Prepend `classifier:` labels so logs recognize step mappings. Add safety logic that falls back from empty `DEEP_RESEARCH` arrays instantly into `WEB_SEARCH`.
- [ ] **Fix 4.18:** Restore Bot Persona 4-Pointed Gold Star Signature `(Visual Audit)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Inject a persistent absolute-positioned 4-pointed golden star icon positioned top-left of incoming bot response bubbles, setting distinct visual speaker anchor.
- [ ] **Fix 4.19:** Deploy Sticky Viewport Up/Down Navigation Arrows `(Visual Audit)`
  - **File:** `src/components/assistant/AIAssistant.tsx`
  - **Action:** Reinstall floating navigational pair (twin Chevron-Up / Chevron-Down) anchored rigidly in visual stack above lower right toolbar corners mapped to `scrollIntoView` anchors.
- [ ] **Fix 4.20:** Populate Message Footer Statistics Meta Pill `(Visual Audit)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Inside bot interaction footer loop, render aesthetic fixed pill containing calculated tokens and duration text e.g., `[MODEL] 13.2S - 5000 TOKENS` set to uppercase compact mono weights.

---

## 📝 PHASE 5: NOTE EDITOR & SLASH COMMANDS

- [ ] **Fix 5.1:** Expose Raw Markdown Shortcuts inside Slash Command Dropdowns `(Report 80)`
  - **File:** `src/components/editor/SlashCommandMenu.tsx`
  - **Action:** Inject dedicated mapping key `shortcut: string` into static data array (e.g. containing values `#`, `##`, `-`).
- [ ] **Fix 5.2:** Fine-Tune Shortcut Badge Weight constraints `(Report 81)`
  - **File:** `src/components/editor/SlashCommandMenu.tsx`
  - **Action:** Set static weights inside rendered shortcut capsules to specific constant `font-medium` (500).
- [ ] **Fix 5.3:** Purge explicit borders from the Shortcut indicator boxes `(Report 82)`
  - **File:** `src/components/editor/SlashCommandMenu.tsx`
  - **Action:** Completely strip border utility tokens replacing them with subtle semi-translucent fill backdrops.
- [ ] **Fix 5.4:** Containerize Monospace Code Blocks locking text scroll and background `(Report 83)`
  - **File:** `src/components/editor/BlockRenderer.tsx`
  - **Action:** Force the specialized block template to hold background `#0D1117` with absolute locked `overflow-x-auto` styling properties.
- [ ] **Fix 5.5:** Overlay the Dynamic Floating "Copy" trigger onto Monospace Cards `(Report 84)`
  - **File:** `src/components/editor/BlockRenderer.tsx`
  - **Action:** Inside main block render block, add absolute-position child `<button>` containing icon located `top-2 right-2`, applying mouseover visibility transition hooks.
- [ ] **Fix 5.6:** Normalize Pasted Code Styles handling explicit horizontal overflow `(Report 85)`
  - **File:** `src/components/editor/BlockRenderer.tsx`
  - **Action:** Set wrapper to strict `whitespace-pre` to preserve manual formatting strictly bypassing generic wrapping mechanics.
- [ ] **Fix 5.7:** Block copy failures by piping text through Sanitizer `(Report 98)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Inside copy handler wrapper logic, ensure text data intercepts helper function `sanitizeContent(text)` prior to being transferred to markdown parser.
- [ ] **Fix 5.8:** Resolve Root Cause of intermittent Empty-Note copy generation `(Report 100)`
  - **File:** `src/components/editor/BlockRenderer.tsx`
  - **Action:** Refactor static ref instantiation `useRef(block.content)` to `useRef<string | null>(null)`. This enforces standard validation failure on initial mount, forcing `useEffect` to successfully execute `innerHTML = block.content` rather than falsely assuming content is already synchronized.
- [ ] **Fix 5.9:** Synchronize Note block theme with Chat and restore Link-Block variant `(Report 101)`
  - **File:** `src/components/editor/BlockRenderer.tsx`
  - **Action:** Reconstruct render handler for `BlockType.link` specifically building out stylized specialized hyperlink capsule UI element.
- [ ] **Fix 5.10:** Fix Markdown Syntax Bleed regarding bold tags / Crimson application `(Report 102)`
  - **File:** `src/lib/parser/inlineMarkdown.ts`
  - **Action:** Double check standard markdown-to-html replacement loops guarding strictly against unbalanced bold tag cascade leaks into normal text.
- [ ] **Fix 5.11:** Scale baseline Note Content font heights up by 2px `(Report 103)`
  - **File:** `src/styles/editor.css`
  - **Action:** Impose absolute additive CSS expansion shift scaling baseline 17px text upward strictly to 19px standard and bumping associated titles.
- [ ] **Fix 5.12:** Deploy "Copy to Note" Split-Button Topology into Chat Message Loop `(Report 100)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Inject absolute custom Button Group directly beneath standard Markdown render blocks. Primary button executes `handleCopyToNote(false)` updating active notes, secondary caret dropdown exposes `New Note` executes `handleCopyToNote(true)`. Map through `addEntity` and `updateEntityContent` store dispatches safely.
- [ ] **Fix 5.13:** Re-build Note Metadata Info Box (Last Modified / Tags) `(Visual Audit)`
  - **File:** `src/components/editor/NoteEditor.tsx`
  - **Action:** Insert specialized block beneath main title rendering stacked metadata grids: `LAST MODIFIED` header beside `TAGS +New` interactive container sharing contained radius rounding.
- [ ] **Fix 5.14:** Restore Native Editor Table Row/Column Control Adders `(Visual Audit)`
  - **File:** `src/components/editor/BlockRenderer.tsx`
  - **Action:** Within functional table components, inject visual `+ Add Row` / `+ Add Column` ghost triggers along base and right-edge perimeters maintaining live expandable structures.

---

## 🧭 PHASE 6: ROUTER CONFIGURATION & DISCOVERY

- [ ] **Fix 6.1:** Fully enable Paid Model support routines within standard Router `(Report 61)`
  - **File:** `src/data/store.ts`
  - **Action:** Wire the dynamic boolean gate permitting paid provider visibility cascades enabling full feed data generation.
- [ ] **Fix 6.2:** Correct display precision on Model Cost Formatting columns `(Report 62)`
  - **File:** `src/components/models/DiscoveryPage.tsx`
  - **Action:** Insert explicit scaling method enforcing absolute fixed decimal truncation counts during money rendering loops.
- [ ] **Fix 6.3:** Impose absolute `max_tokens: 2000` protection cap saving credit lockout `(Report 64)`
  - **File:** `src/lib/bot/providers/openrouter.ts`
  - **Action:** Directly inject manual overrides inside the constructed fetch body payload hardcoding limit key `max_tokens: 2000` for non-fallible API safety.
- [ ] **Fix 6.4:** Deploy OpenRouter "Routing Provider Selection" popup selector triggers `(Report 68)`
  - **File:** `src/components/models/ModelRow.tsx`
  - **Action:** Construct interactive configuration icon mounting on the model component that actives target override setter triggers.
- [ ] **Fix 6.5:** Targeted OpenRouter Routing Popup Component creation `(Report 71)`
  - **File:** `src/components/models/ProviderSelectionPopup.tsx`
  - **Action:** Assemble small independent component displaying specific array of provider identity strings supporting direct click injection handler callback.
- [ ] **Fix 6.6:** Dedicated Model Row Options Dropdown Drawer `(Report 72)`
  - **File:** `src/components/models/RowOptionsDropdown.tsx`
  - **Action:** Instantiate global popover component responsible for triggering direct state modifications specific to standard single row index.
- [ ] **Fix 6.7:** Implement Compact "K/M" numeral rounding shorthand for RPD quota displays `(Report 73)`
  - **File:** `src/lib/utils.ts`
  - **Action:** Fabricate small helper func checking `val >= 1000` and generating rounded numeric string suffixed by specific capital suffix marker "K". Return literal "∞" constant for infinity flags.
- [ ] **Fix 6.8:** Restore OpenRouter Row Alignment Spacers fixing width collapse bugs `(Report 74)`
  - **File:** `src/components/models/ModelRow.tsx`
  - **Action:** Inject specialized invisible fixed dimensional containers functioning as static width anchors ensuring conditional element swaps don't trigger visual reflow.
- [ ] **Fix 6.9:** Compress horizontal flex gaps between model row items to prevent wrap `(Report 75)`
  - **File:** `src/components/models/ModelRow.tsx`
  - **Action:** Direct CSS adjustment shifting raw item gaps downward from specific class `gap-2.5` to highly compacted `gap-1.5`.
- [ ] **Fix 6.10:** Reveal explicit Unfiltered Full Provider IDs in manual routing selectors `(Report 77)`
  - **File:** `src/components/models/ProviderSelector.tsx`
  - **Action:** Render static string literal returned by API directly, suppressing aesthetic capitalization logic generators.
- [ ] **Fix 6.11:** Ensure deletion operations cleanly drop custom OpenRouter providers `(Report 78)`
  - **File:** `src/data/store.actions.ts`
  - **Action:** Guarantee local deletion dispatcher safely iterates active selection caches clearing custom provider mappings prior to model entity removal completion.
- [ ] **Fix 6.12:** Hardcode `allowFallbacks: false` override whenever specialized provider routing is activated `(Report 105)`
  - **File:** `src/lib/bot/providers/openrouter.ts`
  - **Action:** Add specific safety predicate inside fetch prep handler logic dynamically applying the false boolean lock should active target preferred provider tags manifest.
- [ ] **Fix 6.13:** Resolve key classification logic regarding the Advisor chain mapping `(Report 106)`
  - **File:** `src/lib/bot/chainRouter.ts`
  - **Action:** Reconfirm the specific routing logic table holds explicit active entries directing classified advisory intents into precise execution stream.

---

## 🛠️ PHASE 7: SYSTEM INTEGRITY & CODE HEALTH

- [ ] **Fix 7.1:** Fix specific dynamic `.require()` edge-case bug interfering with model calling `(Report 63)`
  - **File:** `src/lib/bot/orchestrator.ts`
  - **Action:** Terminate the error-prone dynamic resolver replacing routine with fully reliable declarative explicit map pointers ensuring runtime lock stability.
- [ ] **Fix 7.2:** Resolve residual Typescript/Build compilation errors in router setup `(Report 69)`
  - **File:** `src/data/store.types.ts`
  - **Action:** Patch existing Interface dictionaries integrating optional metadata strings (e.g. `targetedProviderId`) satisfying static type check definitions.
- [ ] **Fix 7.3:** Clear Stale Debug Environment / IDE Caches maintaining operational health `(Report 70)`
  - **Action:** Command line terminal executions iterating physical cache directory tree wipes enabling clean boot synchronization state.
- [ ] **Fix 7.4:** Fix root parsing crash inside `markdownToBlocks` logic handler `(Report 79)`
  - **File:** `src/lib/parser/markdownToBlocks.ts`
  - **Action:** Defend against recursive search loops adding conditional empty string handlers ensuring stack safety prevents master system crash.
- [ ] **Fix 7.5:** Re-inject strict formatting rules into live system Prompts file tree `(Report 88)`
  - **Files:** `mode-default.txt`, `mode-pro.txt`
  - **Action:** Re-baseline files by pasting final production structural guidelines regulating formatting tone recovered from history audit files.
- [ ] **Fix 7.6:** Cleanly extract internal workflow `# SYNC BLOCK` hints from production prompts `(Report 89)`
  - **Files:** `mode-default.txt`, `mode-pro.txt`
  - **Action:** Cleanse final distribution text files by purging specific system hint string blocks intended strictly for developer orientation.
- [ ] **Fix 7.7:** Direct fix for `ChatMessage` UTF16 decode and corruption causing load breakage `(Report 107)`
  - **File:** `src/components/assistant/components/ChatMessage.tsx`
  - **Action:** Absolute rewrite of local bytes strictly locking valid UTF-8 character encodings preventing trailing corruption bytes crashing React compilers.
- [ ] **Fix 7.8:** Expand All History Windows to explicit 10-Turn (20 message) limits `(Report 59 from 07.05)`
  - **Files:** `src/lib/bot/orchestrator.ts`, `advisor.ts`, `classifier.ts`, `thinkChain.ts`
  - **Action:** Update multiple occurrences of `messages.slice(-6)` replacing parameter limits with higher fidelity ceiling `messages.slice(-20)`. Ensure correct propagation loop inside `executePipeline` so intermediate chain steps are granted standard 20-message histories.
- [ ] **Fix 7.9:** Fix Gemini Key Rotation & API Error Bubble Logic `(Report 24 from 08.05)`
  - **File:** `src/lib/bot/providers/google.ts`
  - **Action:** Refactor inner catch handler. Inspect error payload string. If triggering regex `/(quota|429|details)/`, execute `throw err;` to force bubbling out into master loop ensuring key-rotator cycles cleanly to NEXT active key rather than failing early.
- [ ] **Fix 7.10:** Parse Gemini Grounding Citations and propagate in standard API response `(Report 25 from 08.05)`
  - **File:** `src/lib/bot/providers/google.ts`
  - **Action:** Inside API response parse logic, capture explicit object path `response.candidates[0]?.groundingMetadata?.groundingChunks`. Map unique web `uri` items to strings and package as `{ content: resText, citations: uniqueArray }` so chat displays source links.
- [ ] **Fix 7.11:** Enable Dynamic Multi-File Prompts System without hardcoded strings `(Report 27 from 08.05)`
  - **File:** `src/lib/bot/compilePrompt.ts`
  - **Action:** Import native Node filesystem `fs`. Replace internal large object strings with active dynamic reader calls `fs.readFileSync(path.join(process.cwd(), 'pipeline-web-search.txt'))` pulling standard files directly from absolute project root.
- [ ] **Fix 7.12:** Inject Context Date Dynamic Block to Advisor and Thinking `(Report 26 from 08.05)`
  - **Files:** `advisor.ts`, `thinkChain.ts`, `compilePrompt.ts`
  - **Action:** Implement standard function injecting current DateTime strings wrapped in explicit tags like `[CURRENT CONTEXT]` prepending them explicitly into the first position of the `systemPrompt` text array construction workflow.
- [ ] **Fix 7.13:** Point AI Manager Database Queries to explicit 'mode=default' rows `(Report 36 from 07.05)`
  - **Files:** `src/app/api/ai/brain/manage/route.ts`, `analyze/route.ts`
  - **Action:** Correct target selector method. Replace specific filter `.eq('id', 1)` with mandatory lookup `.eq('mode', 'default')` satisfying real DB relational mappings and delivering correct backend model selection.
- [ ] **Fix 7.14:** Fully enable Cloudflare Workers Text Generation capabilities `(Report 37 from 07.05)`
  - **File:** `src/lib/bot/providers/cloudflare.ts`
  - **Action:** Enhance native response listener checking `application/json` payloads. Add handlers parsing `res.result.response` or `res.result.text` as pure string results permitting non-binary generation pipelines.
- [ ] **Fix 7.15:** Dynamic Category Trace parsing inside Admin Logs Table view `(Report 39 from 07.05)`
  - **File:** `src/app/admin/logs/LogsTable.tsx`
  - **Action:** Refactor hard-indexed parser loops. Loop through log parts array checking `if (KNOWN_CATEGORIES.has(str))`. Split slice logic cleanly at the returned dynamic index variable guaranteeing robust separation of pre-classification and post-routing paths with ZERO phantom key drift.
- [ ] **Fix 7.16:** Vision Capability awareness injection across modes `(Report 42 from 07.05)`
  - **Files:** `mode-default.txt`, `mode-pro.txt`, `mode-think.txt`
  - **Action:** Inject standard explicit rule blocks informing text-only models that native Vision routers are mounted, directing them to encourage users attaching files/photos.
- [ ] **Fix 7.17:** Conceptualize Intent Routing and Delete Hardcoded Capability Templates `(Report 43-46 from 07.05)`
  - **Files:** `mode-default.txt`, `mode-pro.txt`, `mode-think.txt`
  - **Action:** Full conceptual restructuring. Force model to route "Conversational Questions ABOUT Capabilities" down conversational tiers rather than trigger overrides. Purge fixed rigid capability bullet lists completely enabling context-aware flexible explanations.

---

## ⚙️ PHASE 8: ADMIN ROUTER DASHBOARD ENHANCEMENTS

- [ ] **Fix 8.1:** Card Repositioning & Sortable Layout via Dnd-Kit `(Report 47 from 07.05)`
  - **File:** `src/app/admin/router/actions.ts`, `page.tsx`
  - **Action:** Implement standard `@dnd-kit` sortable layout context wrapping grid. Build `saveRouterOrder` RPC handling database state sync maintaining user specific priority matrix visually.
- [ ] **Fix 8.2:** Stabilize Grid Overlay preventing card stretching during Drag `(Report 48 from 07.05)`
  - **File:** `src/components/admin/SortableRouterGrid.tsx`
  - **Action:** Introduce direct `<DragOverlay>` handling active visual render outside static layouts. Force generic wrapper using CSS `items-start` blocking implicit browser tall-alignment behavior.
- [ ] **Fix 8.3:** Unify Icon Mappings across all Router Chain Headers `(Report 49 from 07.05)`
  - **File:** `src/components/admin/RouterManager.tsx`
  - **Action:** Synchronize master dictionary linking categories (`VISION`, `CODING`, `RESEARCH`) to absolute graphic icon pointers and shift drag-anchor component to top-right safety zones.
- [ ] **Fix 8.4:** Replicate Global "Option Popups" Visual Styles & Iconography `(Report 52-53 from 07.05)`
  - **Files:** `ModelDropdown.tsx`, `ProviderSelector.tsx`
  - **Action:** Standardize layout paddings to exact `p-1.5` and intra-item gaps to `3px`. Prepend leading `Cpu` and `Star` icons duplicating exact system context menu aesthetic DNA.
- [ ] **Fix 8.5:** Portal Solution fixing popup overlap stacking issues `(Report 55 from 07.05)`
  - **File:** `src/components/admin/RouterManager.tsx`
  - **Action:** Wrap Prompt/Preset popover render trees inside core method `createPortal(children, document.body)`. Set ultimate high absolute index `z-[9999]` ensuring they strictly bypass sorting grid clip boundaries.
- [ ] **Fix 8.6:** Hydration Safety Gates with Stable Hook Preservation `(Report 56-58 from 07.05)`
  - **File:** `src/components/admin/SortableRouterGrid.tsx`
  - **Action:** Declare `isMounted` tracking boolean inside `useEffect`. Place logic lock `if (!isMounted) return null;` AFTER standard hook declaration suite, effectively securing correct render order stack while safely blocking server/client mismatches.

---
*(ULTIMATE MASTER DOCUMENT LOCKED. Absolute system parity derived from 100% comprehensive legacy history archives.)*
