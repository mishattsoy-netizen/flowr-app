User request: "i coppied this request from this chat and it got pasted with formatting of this chat, not as text in messagebar, fix it"

## 2. Objective Reconstruction
The user reported that pasting text into the AI chat input (message bar) preserved the rich text formatting (HTML, background colors, styles) from the source instead of pasting as plain text. The objective is to intercept paste events and force plain-text insertion.

## 3. Strategic Reasoning
- The chat input relies on a `contentEditable` `div` (`ChatInputEditable.tsx`) to support rich mentions and dynamic entity tags. By default, browsers paste fully formatted HTML into `contentEditable` elements.
- To resolve this, we need to handle the `onPaste` event directly on the `contentEditable` node.
- The standard, robust way to strip formatting and preserve the undo stack in `contentEditable` is calling `e.preventDefault()`, extracting `'text/plain'` from `e.clipboardData`, and using `document.execCommand('insertText', false, plainText)`.

## 4. Detailed Blueprint
- **src/components/assistant/components/ChatInputEditable.tsx**:
  - Add a `handlePaste` function that intercepts the `onPaste` event.
  - Call `e.preventDefault()` to stop the default HTML insertion.
  - Retrieve plain text using `e.clipboardData.getData('text/plain')`.
  - Insert the text using `document.execCommand('insertText', false, text)`.

## 5. Operational Trace
- Modified `ChatInputEditable.tsx` by introducing the `handlePaste` function and hooking it into the `contentEditable` div.

## 6. Status Assessment
The chat input now correctly strips all styles, colors, and HTML formatting when text is pasted, functioning exclusively as a plain text input while preserving its custom rendering capabilities.
