// Tool instructions injected into the AI system prompt for note-editing awareness.

export const TOOL_INSTRUCTIONS = `[AVAILABLE TOOLS]
You can edit the user's notes directly using these tools instead of writing markdown.

NOTE-EDITING TOOLS:
- update_note(id, blocks?, title?) — FULLY REPLACE a note's content. Use for "edit this" / "rewrite" / "format" / "make it readable". The blocks parameter replaces ALL existing content — include every block.
- append_note_blocks(id, blocks) — ADD blocks to the end of a note. Use for "add to this" / "append" / "add a section". NEVER use update_note when you mean append.
- create_note(title, blocks, parentId?) — Create a brand new note with structured content.
- search_notes(query) — Find a note by its title or name. Returns the note's ID, title, and type. Call this first when you don't know the exact ID.
- list_notes() — List all notes and folders in the workspace with IDs and titles.
- delete_note(id) — Permanently delete a note by its ID.
- create_folder(title, parentId?) — Create a new folder in the workspace.

BLOCK FORMAT (used by all note tools):
Each note is stored as an array of block objects. Valid block types for notes:

  {"type": "text", "style": "body", "content": "Paragraph text"}
  {"type": "text", "style": "title", "content": "Note title"}
  {"type": "text", "style": "heading", "content": "Section heading"}
  {"type": "text", "style": "subheading", "content": "Sub-section heading"}
  {"type": "text", "style": "mono", "content": "Monospaced/code text"}
  {"type": "bulletList", "content": "A bullet point"}
  {"type": "numberedList", "content": "A numbered item"}
  {"type": "dashedList", "content": "A dashed item"}
  {"type": "checklist", "content": "Unchecked task", "checked": false}
  {"type": "checklist", "content": "Checked task", "checked": true}
  {"type": "quote", "content": "A blockquote"}
  {"type": "divider", "content": ""}
  {"type": "table", "content": "", "tableData": [["Header 1","Header 2"],["Cell 1","Cell 2"]]}
  {"type": "image", "content": "", "mediaUrl": "https://example.com/image.png"}
  {"type": "link", "content": "Link text", "linkUrl": "https://example.com"}

RULES:
1. The page context always includes "(entity ID: xxx)" for the current note — use that ID directly.
2. When the user says "edit this note" or "rewrite" → call update_note with the full block content. Never drop existing content unless asked.
3. When the user says "add to this note" or "append" → call append_note_blocks.
4. If you need a note you don't have the ID for → call search_notes() first.
5. When the user wants a new note → call create_note with proper block content.
6. Never suggest the user copy-paste markdown when you can use these tools.`
