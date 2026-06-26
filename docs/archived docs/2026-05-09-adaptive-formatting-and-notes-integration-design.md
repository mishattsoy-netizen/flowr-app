# Adaptive Formatting & Notes Integration Design

## Overview
This design outlines the architecture for introducing rich, adaptive AI formatting (similar to Claude) and bridging the gap between chat outputs and the user's workspace notes through a seamless "Copy to Note" feature.

## 1. AI Formatting Engine (Adaptive Richness)
**Implementation:**
- Modify `mode-default.txt` and `mode-pro.txt`.
- Update the `[ANSWER STYLE]` rules to instruct the AI to adapt typography to length. For quick facts, use standard prose. For multi-step logic or complex comparisons, actively use markdown headers (`###`), dividers (`---`), and tables.
- Teach the AI to freely use Notion-style markdown: Blockquotes (`>`), Checklists (`[ ]`), Bullet lists (`-`), and Numbered lists (`1.`).
- Recompile prompts via the existing `compilePrompt.ts` script.

## 2. Context-Aware "Copy to Note" UI
**Implementation:**
- **Trigger:** In `ChatMessage.tsx`, detect if the AI's raw markdown contains rich formatting (`###`, `---`, `|---|`, etc.).
- **UI Component:** Render a Split-Button at the bottom of the chat bubble.
  - **Main Button:** Contextually aware (reads active workspace state).
    - If NO note is open: "Create new note"
    - If YES note is open: "Copy to note" (appends).
  - **Dropdown (Chevron):** Provides secondary actions like "Create as new note instead", "Copy raw markdown", or "Select specific note".

## 3. Markdown-to-Blocks Parser
**Implementation:**
- Create a new utility function `parseMarkdownToBlocks(markdown: string)` to bridge standard markdown to the custom JSON structure of `NoteEditor.tsx`.
- **Supported Elements:**
  - Headings (H1, H2, H3)
  - Paragraphs & Inline formatting (bold, italic)
  - Dividers (`---`)
  - Code/Mono blocks
  - Bulleted Lists (`-`)
  - Numbered Lists (`1.`)
  - To-do Lists (`[ ]` or `[x]`)
  - Quotes (`>`)
  - Tables & Columns (`| Column |`)

## 4. Notion-Style Editor Shortcuts (Input Rules)
**Implementation:**
- Add event listeners to the empty block input handler in the editor (`BlockRenderer.tsx` / `NoteEditor.tsx`).
- Support the following triggers (firing on `Space` after the trigger sequence):
  - `#`, `##`, `###` -> Headings 1, 2, 3
  - `-` -> Bulleted list
  - `1.` -> Numbered list
  - `[]` -> To-do list
  - `"` -> Quote block
  - `---` -> Divider
  - ` ``` ` -> Code block
  - `/table` -> Table block initialization
