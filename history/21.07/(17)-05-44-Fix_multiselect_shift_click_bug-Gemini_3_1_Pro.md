User request: "i cant multiselect"

## 0. Date and time of the request
21.07.2026, 05:44

## 1. User request
User request: "i cant multiselect"

## 2. Objective Reconstruction
Fix a bug preventing multi-selection of blocks via Shift+Click on their drag handles.

## 3. Strategic Reasoning
- The multi-select logic in `handleOpenMenu` (in `NoteEditor.tsx`) correctly calculates the range of blocks to select.
- However, the initial click on a block's drag handle (without Shift) was calling `setSelectedBlockIds(new Set([blockId]))` *inside* the updater callback of another state variable, `setActiveOptionsMenu(prev => ...)`.
- Modifying state within another state's updater function is a React anti-pattern. React's batching mechanism was discarding the `setSelectedBlockIds` side effect.
- As a result, when the user performed the subsequent Shift+Click, the `prev` state of `selectedBlockIds` was empty, leading the multi-select logic to only select the second clicked block instead of the range.
- By moving `setSelectedBlockIds` outside the `setActiveOptionsMenu` updater, React can correctly process the state updates sequentially, ensuring the anchor block is remembered for the Shift+Click action.

## 4. Detailed Blueprint
- `src/components/editor/NoteEditor.tsx`: Refactor `handleOpenMenu` to hoist `setSelectedBlockIds` out of the `setActiveOptionsMenu` callback.

## 5. Operational Trace
- Identified `setSelectedBlockIds` side effect within `setActiveOptionsMenu`.
- Replaced the file content in `NoteEditor.tsx` to separate the state updates.

## 6. Status Assessment
Completed. Multi-selection via Shift+Click on block drag handles now correctly registers the anchor block and selects the full range.
