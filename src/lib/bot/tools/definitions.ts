/**
 * Native Tool Definitions for Flowr AI (Function Calling)
 * The "Utility Pack" Expansion.
 */
export const FLOWR_TOOLS = [
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
  }
]
