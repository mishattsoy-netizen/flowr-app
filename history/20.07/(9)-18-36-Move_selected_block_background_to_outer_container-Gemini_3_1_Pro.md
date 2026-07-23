User request: "still some inner box in the block"

## 0. Date and time of the request
20.07.2026, 18:36

## 1. User request
User request: "still some inner box in the block"

## 2. Objective Reconstruction
The user indicated that the selection background was still rendering as a tight "inner box" wrapping just the text, instead of applying to the entire block row. The objective is to move the selection background from the inner text wrapper to the outer block container.

## 3. Strategic Reasoning
In the previous fix, I removed the conflicting native text selection highlight, which left only the CSS `.selected-block` style active. However, this style was still targeting the `.flex-1.flex.items-start` child element (the inner text wrapper).
To satisfy the user's requirement of keeping the "block effect" but removing the "inner box", I need to apply the selection styling to the outer `.editor-block` itself. This creates a uniform, full-width background for the selected block (similar to Notion), instead of a background that tightly hugs the text.

## 4. Detailed Blueprint
- Update `globals.css` to modify the `.selected-block` selector.
- Remove the child selectors (`.flex-1.flex.items-start`, `.relative.w-full`) and apply the styles directly to `.editor-block.selected-block`.
- Add `border-radius: var(--radius-medium)` so the outer block has nice rounded corners when selected.

## 5. Operational Trace
- Used `multi_replace_file_content` to modify `globals.css` at line 1295.

## 6. Status Assessment
Completed. The selection background now correctly applies to the full outer block container, eliminating the "inner box" visual.
