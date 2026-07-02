/**
 * Native Tool Definitions for Flowr AI (Function Calling)
 * The "Utility Pack" Expansion.
 */
export const FLOWR_TOOLS = [
  {
    name: "set_sync_mode",
    description: "Changes the sync mode of a note or folder.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Entity ID" },
        mode: { type: "string", enum: ["cloud-only", "local-only", "full-sync"] }
      },
      required: ["id", "mode"]
    }
  },
  {
    name: "get_crypto_price",
    description: "Fetches the current price of a cryptocurrency in USD.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "The cryptocurrency symbol (e.g., BTC, ETH)." }
      },
      required: ["symbol"]
    }
  },
  {
    name: "fetch_web_page",
    description: "Retrieves the text content of a specific URL/web page.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full URL of the web page to fetch." }
      },
      required: ["url"]
    }
  },
  {
    name: "tavily_search",
    description: "Performs a broad web search for real-time information and current events.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." }
      },
      required: ["query"]
    }
  },
  {
    name: "exa_search",
    description: "Performs a web search using Exa for real-time information with deep content extraction.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." }
      },
      required: ["query"]
    }
  },
  {
    name: "get_weather",
    description: "Provides current weather and 1-day forecast for a given location.",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name or coordinates." }
      },
      required: ["location"]
    }
  },
  {
    name: "convert_currency",
    description: "Converts an amount from one currency to another.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "number", description: "The amount to convert." },
        from: { type: "string", description: "Source currency code (e.g., USD, EUR)." },
        to: { type: "string", description: "Target currency code (e.g., GBP, JPY)." }
      },
      required: ["amount", "from", "to"]
    }
  },
  {
    name: "get_stock_price",
    description: "Fetches current stock price and daily change for a ticker symbol.",
    parameters: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Stock ticker (e.g., TSLA, AAPL)." }
      },
      required: ["symbol"]
    }
  },
  {
    name: "set_reminder",
    description: "Schedules a reminder for the user. Example: 'In 2 hours to check the oven'.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "What to remind the user about." },
        time_duration: { type: "string", description: "When to remind (e.g., '2 hours', ' tomorrow at 10am', '15 minutes')." }
      },
      required: ["text", "time_duration"]
    }
  },
  {
    name: "create_note",
    description: "Creates a new note in the workspace.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the note." },
        parentId: { type: "string", description: "ID of the parent folder (optional)." },
        blocks: {
          type: "array",
          description: "Structured block content for the note (REQUIRED - always pass blocks for any formatted content).",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "Block type (e.g. bulletList, numberedList, checklist, text, heading)." },
              content: { type: "string", description: "Text content of the block." },
              style: { type: "string", description: "Text style for text blocks (e.g. body, heading, subheading)." },
              checked: { type: "boolean", description: "Whether a checklist item is checked." },
              children: {
                type: "array",
                description: "Nested child blocks.",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    content: { type: "string" },
                    style: { type: "string" },
                    checked: { type: "boolean" }
                  }
                }
              }
            },
            required: ["type"]
          }
        }
      },
      required: ["title"]
    }
  },
  {
    name: "update_note",
    description: "Updates the content or title of an existing note.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the note to update." },
        title: { type: "string", description: "New title for the note (optional)." },
        blocks: {
          type: "array",
          description: "Structured block content to replace the note's content. Use this instead of content for rich formatting (lists, headings, checklists, etc.).",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "Block type (e.g. bulletList, numberedList, checklist, text, heading)." },
              content: { type: "string", description: "Text content of the block." },
              style: { type: "string", description: "Text style for text blocks (e.g. body, heading, subheading)." },
              checked: { type: "boolean", description: "Whether a checklist item is checked." },
              children: {
                type: "array",
                description: "Nested child blocks.",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    content: { type: "string" },
                    style: { type: "string" },
                    checked: { type: "boolean" }
                  }
                }
              }
            },
            required: ["type"]
          }
        }
      },
      required: ["id"]
    }
  },
  {
    name: "append_note_blocks",
    description: "Appends structured block content to the end of an existing note.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the note to append to." },
        blocks: {
          type: "array",
          description: "Array of block objects to append to the end of the note.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "Block type (e.g. bulletList, numberedList, checklist, text, heading)." },
              content: { type: "string", description: "Text content of the block." },
              style: { type: "string", description: "Text style for text blocks (e.g. body, heading, subheading)." },
              checked: { type: "boolean", description: "Whether a checklist item is checked." },
              children: {
                type: "array",
                description: "Nested child blocks.",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    content: { type: "string" },
                    style: { type: "string" },
                    checked: { type: "boolean" }
                  }
                }
              }
            },
            required: ["type"]
          }
        }
      },
      required: ["id", "blocks"]
    }
  },
  {
    name: "delete_note",
    description: "Deletes a note from the workspace by its ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "The ID of the note to delete." }
      },
      required: ["id"]
    }
  },
  {
    name: "create_folder",
    description: "Creates a new folder in the workspace.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the folder." },
        parentId: { type: "string", description: "ID of the parent collection or folder (optional)." }
      },
      required: ["title"]
    }
  },
  {
    name: "list_notes",
    description: "Lists all notes and folders in the workspace to find IDs and titles.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "search_notes",
    description: "Finds a note or folder by searching its title. Returns matching IDs, titles, and types.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The title or name to search for (e.g. 'Shopping List', 'Project notes')." }
      },
      required: ["query"]
    }
  }
]
