User request: "instead of this pallete. show empty circle and if color is picked, show color dot"

## 0. Date and time of the request
21.07.2026, 05:30

## 1. User request
User request: "instead of this pallete. show empty circle and if color is picked, show color dot"

## 2. Objective Reconstruction
Replace the `Palette` icon in the text Selection Toolbar with a dynamic indicator. It should display an empty circle border by default, and change to a filled dot with the corresponding color when the user selects a specific text color.

## 3. Strategic Reasoning
- The `SelectionToolbar` previously used a static Lucide `Palette` icon for the text color trigger. To make this dynamic, we need to track the active color of the currently selected text.
- The `checkFormatting` function runs on selection changes and tracks active styles via `document.queryCommandState`. We can expand this to traverse the DOM selection's ancestors and look for explicit `style.color` declarations applied by our text color picker.
- This computed color is stored in an `activeColor` state and used to render either an empty CSS circle (`border-current`) or a solid color dot with `backgroundColor: activeColor`.

## 4. Detailed Blueprint
- `src/components/editor/SelectionToolbar.tsx`:
  - Add state `const [activeColor, setActiveColor] = useState<string | null>(null);`.
  - In `checkFormatting`, grab `window.getSelection()`, get the `commonAncestorContainer`, and iterate up its parents looking for `node.style.color`. Stop traversing if we hit the block-level container boundary (`data-block-content`).
  - Update `setActiveColor(currentHtmlColor)`.
  - In the JSX render, replace `<Palette />` with a conditional render: if `activeColor` exists, render a `<div style={{ backgroundColor: activeColor }} />` dot. Otherwise, render an empty ring `<div className="border border-current" />`.

## 5. Operational Trace
- Replaced the `Palette` icon JSX inside the Tooltip trigger button.
- Replaced the top declarations and `checkFormatting` function block to include the `activeColor` state and selection DOM traversal logic.

## 6. Status Assessment
Completed. The text color selection button now dynamically reflects the currently active inline text color using an elegant dot instead of a generic palette icon.
