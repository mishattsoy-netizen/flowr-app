User request: "block option popup doenst dissaper when i click multiple blocks, also when i select mulstiple blocks whol text between them is hetting selected fix it"

## 1. Objective Reconstruction
Debug and eliminate edge-case behaviors arising from new multi-select logic. Goals include: (1) Force the active Block Options drawer to close immediately if subsequent selections occur, and (2) Block standard browser Shift-selection mechanisms that leak raw text highlights into the document while clicking structural block handles.

## 2. Strategic Reasoning
1. The sticky menu occurred because the specialized multi-select conditional purely appended to the active selection Set, neglecting to clear the visual `activeOptionsMenu` reference. Injecting an explicit nullifier solves this. 
2. The text bleeding was triggered by standard User-Agent response to holding the Shift key during sequential click operations. By invoking `e.preventDefault()` on the capture phase of the grip click handler, we instruct the DOM parser to discard native selection behaviors for that action chain entirely.

## 3. Detailed Blueprint
- **NoteEditor.tsx**: Inject `setActiveOptionsMenu(null)` into the modifier branch of the menu handler.
- **BlockRenderer.tsx**: Inject `e.preventDefault()` into the handle listener to neutralize the OS selection listener.

## 4. Operational Trace
- Modified `NoteEditor.tsx`: Forced menu nullification upon `shiftKey === true`.
- Modified `BlockRenderer.tsx`: Blocked standard Event defaults on the grip element wrapper.

## 5. Status Assessment
Both friction points resolved. Popups now close cleanly on chained selections, and text ranges are fully secured against bleeding during modifier clicks.
