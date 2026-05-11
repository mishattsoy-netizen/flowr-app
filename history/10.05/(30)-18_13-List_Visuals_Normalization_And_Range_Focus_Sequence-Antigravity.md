User request: "fix list styles. the bullet point or number must be inside the block sentered with the text row, when i click enter in list block, create and switch to new list row below. if i click shift+enetr in any block taht has text in it, create new empty row block below and switch focus to it"

## 1. Objective Reconstruction
Remediate editor presentation and UX regressions impacting text lists and creation events. Tasks include: (1) Neutralizing absolute positioning drift affecting list markers and container folding nodes to eliminate gutter clipping, and (2) Upgrading node focus cycles to enforce dynamic caret deployment via the native DOM Selection framework ensuring true cursor activation upon both continuous-list continuation and explicit Shift-Enter insertions.

## 2. Strategic Reasoning
Investigation verified that list markers were forcibly extruded into the absolute gutter via `left-[-32px]`, leading to the observed overlap errors. Switching them to inline-flex items naturally resolves the visual alignment constraint. Analysis of insertion failures revealed that while generic element `.focus()` was active, user browsers were not successfully bootstrapping the internal text insertion caret. By manually setting node content ranges and range collapsing, I enforced hard focus activation. Finally, patching an omitted type proxy ensured Enter keystrokes reliably perpetuate list nodes rather than falling back to the system's raw text defaults.

## 3. Detailed Blueprint
- **BlockRenderer.tsx**:
    - Deleted negative-absolute positions on list Marker and Fold-Arrow divs.
    - Inserted specific margin-spacing tokens to maintain row rhythm.
    - Modified List insertion branch to forward current block type.
- **NoteEditor.tsx**:
    - Injected native DOM `Range` instantiation sequence into block-insertion focus listener.

## 4. Operational Trace
- Modified `BlockRenderer.tsx`:
    - Converted `absolute left-[-32px]` to static `mr-2.5`.
    - Converted `absolute left-[-24px]` to static `mr-1.5`.
    - Changed proxy signature `onInsertAfter(block.id)` to `onInsertAfter(block.id, block.type)`.
- Modified `NoteEditor.tsx`:
    - Replaced elementary `.focus()` with full `document.createRange()` text range selection workflow.

## 5. Status Assessment
Visual alignments secured. List progression mechanics restored and verified. Focus engine fortified ensuring high-reliability typing continuity on all newly-generated row blocks.
