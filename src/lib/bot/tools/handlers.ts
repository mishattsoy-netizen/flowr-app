import { logger } from '../../logger'
import { supabaseAdmin } from '../../supabase'

/**
 * Execution logic for the Flowr Utility Pack.
 */
export const toolHandlers: Record<string, (args: any, context?: any) => Promise<any>> = {
  /**
   * Crypto Price via CoinGecko
   */
  async get_crypto_price({ symbol }: { symbol: string }) {
    try {
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`)
      const data = await response.json()
      const price = data[symbol.toLowerCase()]?.usd
      return price ? { price, currency: 'USD', symbol } : { error: 'Symbol not found' }
    } catch (e) {
      return { error: 'Failed to fetch crypto price' }
    }
  },

  /**
   * Web Scraper
   */
  async fetch_web_page({ url }: { url: string }) {
    try {
      const response = await fetch(url)
      const html = await response.text()
      const text = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 3000)
      return { content: text, source: url }
    } catch (e) {
      return { error: 'Failed to fetch web content' }
    }
  },

  /**
   * Tavily Search
   */
  async tavily_search({ query }: { query: string }) {
    const { searchWeb } = await import('../providers/tavily')
    const results = await searchWeb(query)
    return { results }
  },

  /**
   * Weather via Open-Meteo (Zero Key)
   */
  async get_weather({ location }: { location: string }) {
    try {
      // 1. Geocoding
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`)
      const geoData = await geoRes.json()
      if (!geoData.results?.length) return { error: `Location '${location}' not found.` }
      
      const { latitude, longitude, name, country } = geoData.results[0]

      // 2. Weather
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`)
      const weatherData = await weatherRes.json()

      return {
        location: `${name}, ${country}`,
        current: weatherData.current_weather,
        forecast_today: {
          max: weatherData.daily.temperature_2m_max[0],
          min: weatherData.daily.temperature_2m_min[0]
        },
        unit: 'Celsius'
      }
    } catch (e) {
      return { error: 'Weather service unavailable' }
    }
  },

  /**
   * Currency Converter via Frankfurter
   */
  async convert_currency({ amount, from, to }: { amount: number, from: string, to: string }) {
    try {
      const response = await fetch(`https://api.frankfurter.app/latest?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`)
      const data = await response.json()
      if (data.error) return { error: data.error }
      return { result: data.rates[to.toUpperCase()], from, to, amount }
    } catch (e) {
      return { error: 'Currency service unavailable' }
    }
  },

  /**
   * Stock Price (Using a reliable free JSON endpoint)
   */
  async get_stock_price({ symbol }: { symbol: string }) {
    try {
      // Note: In production, use Alpha Vantage or Yahoo Finance API keys
      // Placeholder for free pricing logic
      return { error: 'Stock market tool requires an Alpha Vantage API key in the vault to proceed.' }
    } catch (e) {
      return { error: 'Stock service unavailable' }
    }
  },

  /**
   * Set Reminder (Persistent)
   */
  async set_reminder({ text, time_duration }: { text: string, time_duration: string }, context: any) {
    if (!context?.chatId) return { error: 'Unable to identify user session.' }
    
    try {
      // Fast parsing logic for LLM-provided durations
      const now = new Date()
      let remindAt = new Date(now.getTime() + 60 * 60 * 1000) // Default 1h
      
      if (time_duration.includes('minute')) {
        const mins = parseInt(time_duration) || 15
        remindAt = new Date(now.getTime() + mins * 60 * 1000)
      } else if (time_duration.includes('hour')) {
        const hrs = parseInt(time_duration) || 1
        remindAt = new Date(now.getTime() + hrs * 60 * 60 * 1000)
      } else if (time_duration.includes('day')) {
        const days = parseInt(time_duration) || 1
        remindAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
      }

      // 1. Get workspace_id for the user
      const { data: user, error: userError } = await supabaseAdmin
        .from('telegram_users')
        .select('workspace_id')
        .eq('telegram_id', context.chatId)
        .single()
        
      if (userError || !user?.workspace_id) {
        return { error: 'No workspace linked to this Telegram account. Unable to create task.' }
      }

      const taskId = 'task-' + Date.now().toString()

      // 2. Insert into tasks table
      const { data, error } = await supabaseAdmin
        .from('tasks')
        .insert({
          id: taskId,
          workspace_id: user.workspace_id,
          title: text,
          due_date: remindAt.toISOString().split('T')[0], // 'YYYY-MM-DD'
          completed: false,
          created_at: Date.now()
        })
        .select()

      if (error) throw error
      return { success: true, text, due_date: remindAt.toISOString().split('T')[0] }
    } catch (e) {
      logger.error('Failed to set reminder (task):', e)
      return { error: 'Reminder table missing. Please contact admin to run the SQL migration.' }
    }
  }
}
