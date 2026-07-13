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
    text: { type: "string" },
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
        status: { type: "string", description: "For tasks: 'todo' | 'in-progress' | 'done' | 'today' | 'overdue'. Defaults to 'todo'." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "For tasks: priority level." },
        tag: { type: "string", description: "For tasks: custom tag. Leave empty or omit if no tag is needed. Do not use 'none'." },
        dueDate: { type: "string", description: "For tasks: due date/time. If a user asks for a 'start date', put it here." },
        endDate: { type: "string", description: "For tasks: end date/time. If a user asks for a 'start date' and an 'end date', put the end date here." },
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
    description: "Update an existing note or task by ID. For notes, 'content'/'blocks' FULLY REPLACE the body — this requires explicit user confirmation the same way delete_content does: call without confirmed first to get a dry-run preview, then again with confirmed: true and the SAME id after the user agrees. Use this when the user asks to integrate new information, adapt the context of a report, or change existing sections. For small edits to large notes, prefer 'patch' instead (no confirmation needed).",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID of the note or task to update. REQUIRED." },
        // Shared
        type: { type: "string", enum: ["task", "note", "canvas", "folder"],
                description: "Entity type. Include 'task' when updating a task. Omit for auto-detection." },
        title: { type: "string", description: "New title." },
        // Note fields
        content: { type: "string", description: "For notes: Markdown body. FULLY REPLACES the existing content. Requires confirmed:true after a dry-run — see tool description." },
        blocks: {
          type: "array",
          items: blockItemSchema,
          description: "For notes: structured block array (alternative to content, also fully replaces). Requires confirmed:true after a dry-run — see tool description."
        },
        confirmed: {
          type: "boolean",
          description: "Only relevant when 'content' or 'blocks' is provided (full replace). Omit or false initially to get a dry-run preview. Set to true ONLY if the user's PREVIOUS message explicitly confirmed the replacement. Must match a dry-run this exact session already issued for this exact id."
        },
        patch: {
          type: "array",
          items: {
            type: "object",
            properties: {
              find: { type: "string", description: "Exact existing text to locate in the note's Markdown body." },
              replace: { type: "string", description: "Text to replace it with." }
            },
            required: ["find", "replace"]
          },
          description: "For notes: surgical edit — array of {find, replace} ops applied to the CURRENT body instead of resending the whole note. Use this for small edits to large notes. Max 20 ops. All-or-nothing: if any 'find' text isn't found, nothing is changed and an error is returned. Ignored if 'content' or 'blocks' is also provided (those take priority as a full replace)."
        },
        // Task fields
        assignedWorkspaceId: { type: "string", description: "For tasks: reassign task to a different workspace." },
        status: { type: "string", description: "For tasks: 'todo' | 'in-progress' | 'done' | 'today' | 'overdue'." },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "For tasks: priority level." },
        tag: { type: "string", description: "For tasks: custom tag. Leave empty or omit if no tag is needed. Do not use 'none'." },
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
    description: "ADD content to the END of an existing note. Does NOT overwrite existing content. Use ONLY when the user wants to blindly tack text onto the end. Do NOT use this if the user asks to integrate new information, adapt context, or rewrite the document—use update_content instead.",
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
    name: "delete_content",
    description: "Permanently delete one or more items by ID. Supports notes, folders, canvases, canvas blocks, and tasks.\n\nCRITICAL SAFETY RULES — you MUST follow these exactly:\n1. Get PERMISSION FIRST: call this tool WITHOUT confirmed (or confirmed: false) first — this returns a dry-run list of what will be deleted. This is enforced server-side; a confirmed: true call with no matching prior dry-run this session will be rejected.\n2. You must show this list to the user and AWAIT EXPLICIT CONFIRMATION.\n3. ONLY when the user explicitly confirms (e.g., 'yes', 'delete', 'proceed') to your exact list, call this tool again with `confirmed: true` and the SAME ids.\n4. Folders cascade: When a folder is deleted, ALL its children (notes, sub-folders, etc.) are also permanently deleted — note this in your list.\n\nIf the user corrects or adjusts the list, present the new list (by calling without confirmed again) for re-confirmation before deleting.",
    parameters: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs of items to permanently delete. Supports entity IDs (notes, folders, canvases) and task IDs (prefixed 'task-'). Canvas block IDs also accepted."
        },
        type: {
          type: "string",
          enum: ["note", "task", "folder", "canvas"],
          description: "Optional type hint for display in the confirmation list."
        },
        confirmed: {
          type: "boolean",
          description: "Omit or set to false initially to get a dry-run list of items. Set to true ONLY if the user's PREVIOUS message explicitly confirmed the exact list (e.g., 'yes', 'delete', 'remove it', 'proceed'). Must match a dry-run this exact session already issued for these exact ids — the server rejects a confirmed:true call with no matching dry-run."
        }
      },
      required: ["ids"]
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
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of exact entity/task IDs to fetch directly."
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
            status: { type: "string", description: "'todo' | 'in-progress' | 'done'" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            dueDate: { type: "string", description: "Date string or 'today' / 'overdue'." },
            dueAfter: { type: "string", description: "Only tasks with due_date on or after this ISO date (inclusive). Use for ranges like 'this week'." },
            dueBefore: { type: "string", description: "Only tasks with due_date on or before this ISO date (inclusive)." },
            tag: { type: "string", description: "Custom tag to filter by." }
          }
        }
      }
    }
  },

  {
    name: "manage_memory",
    description: "Manage facts and details about the user to build a long-term profile. Use this to remember things the user tells you about themselves, their preferences, or their environment. Do not memorize irrelevant chat messages. Hard cap of 20 memories.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["add", "update", "delete"], description: "Action to perform." },
        id: { type: "string", description: "ID of the memory to update or delete. Required for 'update' and 'delete'." },
        title: { type: "string", description: "Short title for the memory. Required for 'add' and 'update'. Not injected into prompt, used only for UI cards." },
        content: { type: "string", description: "The factual detail to remember. Required for 'add' and 'update'." }
      },
      required: ["action"]
    }
  }
]
