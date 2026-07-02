# Canvas Production-Ready — Excalidraw-Grade Interactions + .flowr File Format

**Date:** 2026-07-02
**Status:** Approved (design), pending spec review

## Summary

Finalize and polish the canvas so it is production ready. Four core reworks — arrow↔shape binding that actually works (Excalidraw's three binding modes), Excalidraw-style transparent auto-sizing text with labels inside shapes and on arrows, frames simplified to Excalidraw-style sections, comments removed — plus an eraser tool, curved-arrow toggle, interaction polish, and codebase cleanup.

Foundation decision: the canvas data model aligns with the **Excalidraw element schema**, and canvases persist to local files as **`.flowr`** — a Flowr-branded file whose content is Excalidraw-compatible JSON. This makes canvases first-class vault files (like `.md` notes), instantly readable/writable by any AI, and visualizable outside Flowr (rename to `.excalidraw` → opens on excalidraw.com, Obsidian, VS Code).

No data migration: there are no production users with canvas data. Legacy paths are deleted, not migrated.

---

## Approach

Rework in place (keep the custom React/SVG canvas, Zustand store, Supabase sync, Framer-style UI). Adapt Excalidraw's MIT-licensed geometry algorithms selectively for the hard parts: arrow-to-outline intersection for rectangle/ellipse/diamond, and focus-based edge sliding.

**Rejected alternatives:**
- Embed `@excalidraw/excalidraw` — discards existing UI, store, sync; re-skinning is painful (re-affirmed from 2026-05-06 spec)
- Custom `.flowr` JSON schema unrelated to Excalidraw — other AIs/tools would not understand it without schema docs in every prompt; no external viewer

---

## 1. Data Model — Excalidraw-Aligned Elements

Canvas block fields in the store are aligned with Excalidraw element conventions so serialization is near-lossless. Canonical element types:

`rectangle` | `ellipse` | `diamond` | `line` | `arrow` | `freedraw` | `text` | `image` | `frame` (UI name: **Section**)

**Removed types/fields:**
- `comment` block type — deleted everywhere (render branch, toolbar, `C` shortcut, store, sync)
- `connection` block type and legacy `fromId` / `toId` / `fromSide` / `toSide` fields; `legacyEndpoint()` in `resolvePoints.ts` deleted
- `video` remains supported in-app but serializes as an `image`-like embed with `customData.flowr.kind = "video"` (Excalidraw has no video type)
- frame `autoLayout` and Figma-style innermost-frame logic — deleted; frame clipping becomes always-on

**Key element fields (Excalidraw names):**

| Field | Notes |
|---|---|
| `id`, `type`, `x`, `y`, `width`, `height`, `angle` | `angle` in radians (internal rotation converts) |
| `strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `strokeStyle`, `opacity` | replaces `canvasStyleExt` naming |
| `groupIds: string[]` | replaces single `groupId` |
| `frameId: string \| null` | replaces `parentId` for section membership |
| `points: [x,y][]` | arrow/line/freedraw, relative to element `x,y` |
| `startBinding` / `endBinding` | `{ elementId, focus, gap, fixedPoint? }` |
| `startArrowhead` / `endArrowhead` | `'arrow' \| 'triangle' \| null` etc. |
| `roundness` | arrows: null = straight, `{type: 2}` = curved; shapes: corner radius |
| `boundElements: [{id, type:'text'}]` | shape/arrow → its label |
| `containerId` | text → the shape/arrow it labels |
| `text`, `fontSize`, `fontFamily`, `textAlign`, `verticalAlign` | text elements |
| `locked`, `zIndex` (internal; serialized as array order) | z-order = element order in `elements[]`, matching Excalidraw |
| `customData.flowr` | reserved object for Flowr-only extras (e.g. video kind, future AI annotations) |

Zustand store keeps `EditorBlock` as the runtime shape but its canvas fields are renamed/typed to the above. `canvasSync.ts` (Supabase) columns map 1:1.

---

## 2. .flowr File Format + Vault Sync

**File content** (valid Excalidraw JSON + one extra key):

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "flowr",
  "elements": [ ...Excalidraw-schema elements... ],
  "appState": { "viewBackgroundColor": "#141413" },
  "files": { "<fileId>": { "dataURL": "...", "mimeType": "image/png" } },
  "flowr": { "formatVersion": 1, "entityId": "...", "title": "..." }
}
```

- Renaming `.flowr` → `.excalidraw` opens the file on excalidraw.com / Obsidian / VS Code (unknown `flowr` key is ignored by Excalidraw).
- Images embed as dataURLs in `files` (Excalidraw convention). Large media: if the media lives in the vault, `customData.flowr.src` keeps the relative path and the dataURL may be omitted (file still validates; Excalidraw shows a placeholder).

**Serializers:** `src/lib/canvas/flowrFile.ts` — `serializeCanvas(entity, blocks): string` and `parseFlowrFile(json): { elements, flowr }`. Round-trip must be lossless for all supported element types (unit-tested).

**Vault integration:** canvases participate in local-file sync exactly like `.md` notes, following the existing sync-mode pipeline (`fileVault.ts` / `vaultSyncBridge.ts` / `syncFileScan.ts` patterns from the 2026-07-01 syncmode spec): canvas entity ↔ `<vault>/<title>.flowr`, debounced write on change, file-scan import on external change. Conflict resolution follows the same last-write rule as notes.

**AI-readiness (foundation only, tools out of scope):** the `.flowr` element schema is the contract future AI canvas tools will write. No tool work in this pass; the format is designed so a model can generate valid canvases without custom schema docs.

---

## 3. Arrow Binding — Excalidraw's Three Modes

**Creation UX:** no more permanent connection-dot grid. With the arrow/line tool active:
- Hovering a bindable element highlights its outline
- Side-center dots appear on the hovered element only (mode 1 affordance)
- Draw from/to anywhere; on release the endpoint binds based on where it landed

**The three binding modes:**
1. **Side-center dot** → binding with `focus` at that side's midpoint. Endpoint slides along the element edge as either end moves, keeping a small `gap` (~4px) outside the outline.
2. **Point inside the shape** → `fixedPoint` binding (relative offset). The arrow stays aimed at that exact interior point; the visible endpoint still clips to the outline with gap (the line "points at" the fixed point).
3. **Free point on the edge** → `focus` binding at that perimeter position. The endpoint slides along the outline only — it never crosses into the shape; if the geometry pulls it around, it resolves to the nearest outline point aimed at the focus target.

**Resolution geometry** (`src/lib/geometry/binding.ts`, rewritten; algorithms adapted from Excalidraw, MIT):
- Per-shape outline intersection: rectangle (with corner radius), ellipse, diamond. Arrow endpoint = intersection of the arrow's last segment with the outline, offset by `gap`.
- Bound arrows re-resolve whenever either bound element moves/resizes/rotates.

**Editing:**
- Dragging an arrow endpoint re-enters binding mode (highlight + rebind/unbind on release)
- Deleting a bound element unbinds its arrows in place (arrow keeps its last resolved endpoint as a free point)
- Bindings survive undo/redo and sync

---

## 4. Text — Excalidraw Behavior

**Standalone text:**
- Text tool (`T`) click, or **double-click empty canvas** → in-place editor at the click point
- No background, no border, no box — transparent text on canvas
- Auto-sizes: width grows as you type, height grows with lines; committed on blur/Escape
- Style panel: font size presets S/M/L/XL (+ numeric), `textAlign`, color; app font family (serialized as `fontFamily` code)
- Double-click existing text → edit in place

**Bound labels (`containerId`):**
- Double-click a shape → creates/edits its label: centered (H+V), wraps to container width minus padding; if text exceeds container height, the container grows vertically (Excalidraw behavior)
- Double-click an arrow → label at the arrow midpoint with a canvas-background chip behind it for readability; follows the midpoint as the arrow moves
- Labels move/rotate/duplicate/delete with their container; deleting the label alone leaves the container
- Labels are real text elements (full styling), replacing the old `content`-string-in-shape rendering

**Removed:** the old boxed text block (`bg-background border rounded-xl`) and its fixed-size textarea.

---

## 5. Sections (frames, simplified)

- UI rename: **Section** (tool shortcut `F` retained)
- Label above the top-left corner, editable on double-click; child count badge removed
- **Containment:** an element belongs to a section iff fully inside it on drop → `frameId` set; dragging a section moves its members; dragging an element out clears `frameId`
- **Clipping:** always on — members render clipped at the section border (no toggle)
- **No nesting** (a section cannot contain another section), **no auto-layout** — `computeAutoLayout` and related code deleted
- Selection: clicking a member selects the member; clicking section border/label selects the section (Excalidraw convention)

---

## 6. Eraser Tool

- Toolbar + shortcut `E`
- Drag over elements: hit elements turn translucent (marked); release deletes all marked; Escape cancels
- Hit-testing uses element outlines (stroke proximity for lines/arrows/freedraw, area for filled shapes)
- One undo step per eraser gesture

## 7. Curved Arrows

- Style panel toggle per arrow/line: straight ↔ curved (`roundness: null` ↔ `{type: 2}`), reusing the existing spline rendering in `VectorPath`
- Bindings and labels work identically in both modes

## 8. Interaction Polish

- **Alt+drag** duplicates selection (drag starts on the copy)
- **Arrow keys** nudge selection 1px, **Shift+arrows** 10px (one undo step per burst)
- **Double-click empty canvas** → new text (see §4)
- Cursor feedback: crosshair for drawing tools, text cursor over text, move/resize cursors consistent
- Escape reliably exits: editing → selection → nothing

## 9. Codebase Cleanup

- Delete: `comment` + `connection` types, `fromId/toId` paths, `legacyEndpoint()`, auto-layout, connection-dot grid, old boxed-text rendering
- Split `CanvasPage.tsx` (~1,900 lines) into focused units: viewport/pan-zoom hook, tool-state hook, pointer-routing hook, eraser hook, binding-drag hook, bottom bar + toolbar components. Target: no file over ~500 lines
- `CanvasBlock.tsx` sheds comment/frame complexity accordingly

---

## Error Handling

- `parseFlowrFile`: invalid JSON or unknown `type` → entity flagged unreadable in UI, file never overwritten by the app (same protective rule as note sync)
- Unknown element types/fields on import → preserved in memory and re-serialized untouched (forward compatibility)
- Binding to a deleted/missing `elementId` at load → binding dropped, arrow endpoint becomes free at last serialized position

## Testing

- **Unit:** binding resolution per shape (rect/ellipse/diamond × 3 modes × gap), outline intersections, `.flowr` serialize→parse round-trip losslessness, eraser hit-testing, focus math
- **Component/integration:** create-bind-move-rebind arrow flow; label create/wrap/grow; section containment on drop; nudge/duplicate; text auto-size
- **Manual QA checklist:** the full §3–§8 behaviors on a real canvas, plus `.flowr` file renamed to `.excalidraw` opening correctly on excalidraw.com

## Out of Scope

- AI canvas tools (create/edit elements via Flowr AI) — next project, builds on this format
- Real-time multi-user editing changes (existing sync behavior retained)
- Mobile/touch support
- Nested sections, auto-layout (removed deliberately)
- Migration of existing canvas data (none in production)
