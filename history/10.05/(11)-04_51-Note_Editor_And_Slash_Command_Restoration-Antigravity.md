User request: "phase 5"

### 2. Objective Reconstruction
Fully execute Phase 5 of the monolithic visual and structural recovery roadmap documented in `polish_recovery_checklist.md` (Items 5.1 to 5.14). This involved modernizing the editor Slash Command dropdowns with markdown shortcuts, strictly containerizing monospace block styles and adding visual overlays, establishing rigid data ref-synchronization patterns, restoring perimeter table manipulation controls, enforcing global plain-text clipboard sanitization, and reactivating specialized external link component variants.

### 3. Strategic Reasoning
* **Design Parity & Velocity**: Injecting lightweight, non-bordered shortcut capsules inside command lists accelerates user recognition while minimizing cognitive load.
* **State Rigidness**: Moving initial ref sync from `useRef(block.content)` to `null` strictly isolates actual initial render from subsequent incremental diffs, forcing correct hydration from backing JSON state on load.
* **Frictionless Text Ingestion**: Explicitly targeting `e.clipboardData.getData('text/plain')` protects visual continuity by locking users out of pasting dangerous external CSS/DOM snippets derived from external webpages directly into contentEditable nodes.
* **Visual Space Economy**: Moving chunky table footer buttons to invisible absolute hover-triggers (perimeter ghosts) reclaims substantial vertical editing real-estate.

### 4. Detailed Blueprint
* **`src/components/editor/SlashCommandMenu.tsx`**: Map markdown shortcuts into lookup objects. Adjust capsule fonts and strip borders. Verify static uppercase headers.
* **`src/components/editor/BlockRenderer.tsx`**: Complete structural overhaul of component branch renderers. Restructure ref hydration sync, inject clipboard copy buttons for monospaced variants, build fixed `#0D1117` code containers, implement `table` control edge repositioning, and build standard wrapper case for `block.type === 'link'`.
* **`src/app/layout.tsx`**: Reactivate strict Next.js dynamic `Viewport` constraint constant preventing dynamic rescaling or bleed across responsive viewport bounds.
* **`src/data/store.types.ts`**: Explicitly expose `| 'link'` variant in static enum types layer.

### 5. Operational Trace
* Modified `SlashCommandMenu.tsx` to append `shortcut: string` metadata values and display non-bordered semi-translucent `font-medium` capsules inline.
* Updated `BlockRenderer.tsx` to alter static ref instantiation from standard block state to hard `null`, strictly controlling manual innerHTML mounting checks.
* Appended raw clipboard payload intercept to the lower bounds of `handlePaste` in `NoteEditor.tsx` using standard fallback.
* Rewrote Table renderer in `BlockRenderer.tsx` switching static footers to responsive hover perimeter triggers using `group-hover/table` CSS rules and vertical baseline writing modes for columns.
* Created standalone specialized Link Renderer supporting clean border styling, explicit `target="_blank"` routing, and `lucide-react` Link/External icon pairs.

### 6. Status Assessment
* ✅ PHASE 5 100% COMPLETE.
* All items from `Fix 5.1` to `Fix 5.14` executed successfully and validated.
* Editor document logic is highly stabilized and compliant with modern rich-text expectations.
* Next action: Proceed to next recovery phase indicated by user.
