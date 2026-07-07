/**
 * Native Tool Definitions for Flowr AI (Function Calling)
 * Universal Toolset — 5 tools total.
 */

const blockItemSchema = {
  type: "object",
  properties: {
    type: { type: "string", description: "Block type (e.g. text, bulletList, numberedList, checklist, heading, subheading, quote, divider, table, image, link, mono)." },
    content: { type: "string", description: "Text content of the block." },
    style: { type: "string", description: "Style for text blocks (body, title, heading, subheading, mono)." },
    checked: { type: "boolean", description: "For checklist blocks: whether the item is checked." }
  },
  required: ["type"]
}

const subtaskItemSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    completed: { type: "boolean" }
  }
}

export const FLOWR_TOOLS = [



  // ── Universal Content Tools ───────────────────────────────────────────────────

  {
    name: "create_content",
    description: "Create any content: a note, folder, workspace, or task. The 'type' field determines what is created.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["note", "folder", "workspace", "task"],
          description: "What to create. REQUIRED. DO NOT execute dependent creations (like creating a workspace then a note inside it) in a single parallel step. You MUST wait for the parent ID before creating children."
        },
        title: { type: "string", description: "Title of the item. REQUIRED." },
        // Note fields
        content: { type: "string", description: "For notes: raw Markdown body content." },
        blocks: {
          type: "array",
          items: blockItemSchema,
          description: "For notes: structured block array (alternative to content)."
        },
        parentId: { type: "string", description: "For notes/folders: parent workspace or folder ID. Omit to put in unsorted. CRITICAL: If the user provides a natural language name for the destination (e.g. 'Atlantis workspace', 'Personal folder'), you MUST use list_content first to find its ID, even if it's a note. Do NOT omit parentId if the user explicitly asked to place it somewhere." },
        // Task fields
        assignedWorkspaceId: { type: "string", description: "For tasks: ID of the workspace to assign this task to." },
        status: { type: "string", description: "For tasks: 'todo' | 'in-progress' | 'done'. Defaults to 'todo'." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "For tasks: priority level." },
        tag: { type: "string", description: "For tasks: custom tag." },
        dueDate: { type: "string", description: "For tasks: due date/time." },
        endDate: { type: "string", description: "For tasks: end date/time." },
        includeTime: { type: "boolean", description: "For tasks: whether the dates include a specific time." },
        reminder: { type: "string", description: "For tasks: reminder string (e.g., '5 minutes before', 'None')." },
        description: { type: "string", description: "For tasks: longer description or notes." },
        subtasks: { type: "array", items: subtaskItemSchema, description: "For tasks: list of subtasks." }
      },
      required: ["type", "title"]
    }
  },

  {
    name: "update_content",
    description: "Update an existing note or task by ID. For notes, 'content' FULLY REPLACES the body. For tasks, only the fields you pass are updated.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the note or task to update. REQUIRED." },
        // Shared
        title: { type: "string", description: "New title." },
        // Note fields
        content: { type: "string", description: "For notes: Markdown body. FULLY REPLACES the existing content." },
        blocks: {
          type: "array",
          items: blockItemSchema,
          description: "For notes: structured block array (alternative to content, also fully replaces)."
        },
        // Task fields
        assignedWorkspaceId: { type: "string", description: "For tasks: reassign task to a different workspace." },
        status: { type: "string", description: "For tasks: 'todo' | 'in-progress' | 'done'." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "For tasks: priority level." },
        tag: { type: "string", description: "For tasks: custom tag." },
        dueDate: { type: "string", description: "For tasks: due date/time." },
        endDate: { type: "string", description: "For tasks: end date/time." },
        includeTime: { type: "boolean", description: "For tasks: whether the dates include a specific time." },
        reminder: { type: "string", description: "For tasks: reminder string (e.g., '5 minutes before', 'None')." },
        description: { type: "string", description: "For tasks: longer description." },
        subtasks: { type: "array", items: subtaskItemSchema, description: "For tasks: updated subtasks list." }
      },
      required: ["id"]
    }
  },

  {
    name: "append_to_note",
    description: "ADD content to the END of an existing note. Does NOT overwrite existing content. Use this instead of update_content when the user wants to add something to a note.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the note to append to. REQUIRED." },
        content: { type: "string", description: "Raw Markdown to append to the note. REQUIRED." },
        blocks: {
          type: "array",
          items: blockItemSchema,
          description: "Structured blocks to append (alternative to content)."
        }
      },
      required: ["id"]
    }
  },

  {
    name: "move_content",
    description: "Move a note, canvas, or folder to a new location. Folders can be moved between workspaces/folders; their children move with them. Omit parentId to move to unsorted.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the entity to move. REQUIRED." },
        parentId: { type: "string", description: "ID of the destination workspace or folder. Omit to move to unsorted (notes only). If user provides a natural language name, use list_content first to find its ID." }
      },
      required: ["id"]
    }
  },

  {
    name: "list_content",
    description: "Universal tool to fetch, search, and list any app content (entities and tasks). The ONLY reading tool.",
    parameters: {
      type: "object",
      properties: {
        types: {
          type: "array",
          items: { type: "string", enum: ["workspace", "folder", "note", "canvas", "task"] },
          description: "Types of content to fetch. Omit to fetch everything."
        },
        parentId: {
          type: "string",
          description: "ID of a specific workspace or folder. For entities, fetches items inside it."
        },
        assignedWorkspaceId: {
          type: "string",
          description: "For tasks ONLY: fetch tasks assigned to this workspace ID."
        },
        readContent: {
          type: "boolean",
          description: "If true, fetches full body content (note blocks, task description & subtasks). Capped at 40,000 chars. Default: false."
        },
        searchQuery: {
          type: "string",
          description: "Keyword to filter content by title."
        },
        limit: {
          type: "number",
          description: "Max items to return. Auto-capped at 10 when readContent=true, or 100 when false."
        },
        sortBy: {
          type: "string",
          enum: ["recent", "alphabetical", "dueDate"],
          description: "Sort order. Default: 'recent'."
        },
        taskFilters: {
          type: "object",
          description: "Filters applied only to tasks.",
          properties: {
            status: { type: "string", description: "'todo' | 'in-progress' | 'done' | 'overdue'" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            dueDate: { type: "string", description: "Date string or 'today' / 'overdue'." },
            tag: { type: "string", description: "Custom tag to filter by." }
          }
        }
      }
    }
  }
]
