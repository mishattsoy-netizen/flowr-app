import { logger } from '../../logger'
import { supabaseAdmin } from '../../supabase'
import { parseMarkdownToBlocks, normalizeBlocks } from '../../editor/markdownBlocks'
import type { BlockInput } from '../../editor/markdownBlocks'

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
  async tavily_search({ query }: { query: string }, context?: any) {
    const { runWebSearchChain } = await import('../providers/tavily')
    const results = await runWebSearchChain(query, context)
    return { results }
  },

  /**
   * Exa Search
   */
  async exa_search({ query }: { query: string }, context?: any) {
    const { runExaSearchChain } = await import('../providers/exa')
    const results = await runExaSearchChain(query, context)
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
    if (!context?.chatId && !context?.userId && !context?.activeWorkspaceId) {
      return { error: 'Unable to identify user session.' }
    }

    try {
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

      // Resolve workspace_id: web app passes it directly, Telegram looks it up
      let workspaceId = context.activeWorkspaceId

      if (!workspaceId && context.chatId) {
        const { data: tgUser, error: userError } = await supabaseAdmin
          .from('telegram_users')
          .select('workspace_id')
          .eq('telegram_id', context.chatId)
          .single()
        if (userError || !tgUser?.workspace_id) {
          return { error: 'No workspace linked to this Telegram account.' }
        }
        workspaceId = tgUser.workspace_id
      }

      if (!workspaceId && context.userId && context.userId !== 'anonymous') {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('active_workspace_id')
          .eq('id', context.userId)
          .single()
        workspaceId = profile?.active_workspace_id
      }

      if (!workspaceId) return { error: 'No active workspace found. Please select a workspace first.' }

      const taskId = 'task-' + Date.now().toString()

      const { error } = await supabaseAdmin
        .from('tasks')
        .insert({
          id: taskId,
          workspace_id: workspaceId,
          title: text,
          due_date: remindAt.toISOString().split('T')[0],
          completed: false,
          created_at: Date.now()
        })
        .select()

      if (error) throw error
      return { success: true, text, due_date: remindAt.toISOString().split('T')[0] }
    } catch (e) {
      logger.error('Failed to set reminder (task):', e)
      return { error: 'Failed to create reminder. Please try again.' }
    }
  },

  /**
   * Create Note
   */
  async create_note({ title, content, blocks, parentId }: { title: string, content?: string, blocks?: BlockInput[], parentId?: string }, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (!context?.userId) return { error: 'User not identified' }

    try {
      let workspaceId = context.activeWorkspaceId

      if (context.userId && context.userId !== 'anonymous') {
        const { data: user } = await supabaseAdmin.from('profiles').select('active_workspace_id').eq('id', context.userId).single()
        if (user?.active_workspace_id) workspaceId = user.active_workspace_id
      }

      if (!workspaceId) return { error: 'No active workspace identified. Please select a workspace first.' }

      let noteContent: any[]
      if (blocks && Array.isArray(blocks) && blocks.length > 0) {
        try {
          noteContent = normalizeBlocks(blocks as BlockInput[])
        } catch (e: any) {
          return { error: `Invalid blocks: ${e.message}` }
        }
      } else if (content) {
        noteContent = parseMarkdownToBlocks(content)
      } else {
        noteContent = []
      }

      const id = 'note-' + Date.now().toString()
      const { error } = await supabaseAdmin.from('entities').insert({
        id,
        title,
        type: 'note',
        content: noteContent,
        parent_id: parentId || null,
        workspace_id: workspaceId,
        last_modified: Date.now()
      })

      if (error) throw error
      return { success: true, id, title, content: noteContent }
    } catch (e: any) {
      logger.error('Failed to create note:', e.message)
      return { error: e.message }
    }
  },

  /**
   * Update Note
   */
  async update_note({ id, title, content, blocks }: { id: string, title?: string, content?: string, blocks?: BlockInput[] }, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (!context?.userId) return { error: 'User not identified' }

    try {
      const updates: any = { last_modified: Date.now() }
      if (title) updates.title = title
      let updatedContent: any[] | undefined
      if (blocks && Array.isArray(blocks) && blocks.length > 0) {
        try {
          updatedContent = normalizeBlocks(blocks as BlockInput[])
          updates.content = updatedContent
        } catch (e: any) {
          return { error: `Invalid blocks: ${e.message}` }
        }
      } else if (content) {
        updatedContent = parseMarkdownToBlocks(content)
        updates.content = updatedContent
      }

      const { error } = await supabaseAdmin.from('entities').update(updates).eq('id', id)
      if (error) throw error
      return { success: true, id, content: updatedContent, title: title }
    } catch (e: any) {
      logger.error('Failed to update note:', e.message)
      return { error: e.message }
    }
  },

  /**
   * Append Blocks to Note
   */
  async append_note_blocks({ id, blocks }: { id: string, blocks: BlockInput[] }, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (!context?.userId) return { error: 'User not identified' }

    try {
      let normalized: any[]
      try {
        normalized = normalizeBlocks(blocks)
      } catch (e: any) {
        return { error: `Invalid blocks: ${e.message}` }
      }

      const { data: entity, error: fetchError } = await supabaseAdmin
        .from('entities')
        .select('content')
        .eq('id', id)
        .single()

      if (fetchError || !entity) return { error: 'Note not found' }

      const existing = Array.isArray(entity.content) ? entity.content : []
      const mergedContent = [...existing, ...normalized]
      const { error } = await supabaseAdmin
        .from('entities')
        .update({ content: mergedContent, last_modified: Date.now() })
        .eq('id', id)

      if (error) throw error
      return { success: true, id, content: mergedContent }
    } catch (e: any) {
      logger.error('Failed to append note blocks:', e.message)
      return { error: e.message }
    }
  },

  /**
   * Delete Note/Entity
   */
  async delete_note({ id }: { id: string }, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (!context?.userId) return { error: 'User not identified' }

    try {
      const { error } = await supabaseAdmin.from('entities').delete().eq('id', id)
      if (error) throw error
      return { success: true, id }
    } catch (e: any) {
      logger.error('Failed to delete entity:', e.message)
      return { error: e.message }
    }
  },

  /**
   * Create Folder
   */
  async create_folder({ title, parentId }: { title: string, parentId?: string }, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (!context?.userId) return { error: 'User not identified' }

    try {
      let workspaceId = context.activeWorkspaceId
      
      if (context.userId && context.userId !== 'anonymous') {
        const { data: user } = await supabaseAdmin.from('profiles').select('active_workspace_id').eq('id', context.userId).single()
        if (user?.active_workspace_id) workspaceId = user.active_workspace_id
      }

      if (!workspaceId) return { error: 'No active workspace identified. Please select a workspace first.' }

      const id = 'folder-' + Date.now().toString()
      const { error } = await supabaseAdmin.from('entities').insert({
        id,
        title,
        type: 'folder',
        parent_id: parentId || null,
        workspace_id: workspaceId,
        last_modified: Date.now()
      })

      if (error) throw error
      return { success: true, id, title }
    } catch (e: any) {
      logger.error('Failed to create folder:', e.message)
      return { error: e.message }
    }
  },

  /**
   * List Notes
   */
  async list_notes(_: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (!context?.userId) return { error: 'User not identified' }

    try {
      let workspaceId = context.activeWorkspaceId
      if (context.userId && context.userId !== 'anonymous') {
        const { data: user } = await supabaseAdmin.from('profiles').select('active_workspace_id').eq('id', context.userId).single()
        if (user?.active_workspace_id) workspaceId = user.active_workspace_id
      }

      if (!workspaceId) return { error: 'No active workspace found' }

      const { data, error } = await supabaseAdmin
        .from('entities')
        .select('id, title, type, parent_id')
        .eq('workspace_id', workspaceId)

      if (error) throw error
      return { entities: data }
    } catch (e: any) {
      logger.error('Failed to list notes:', e.message)
      return { error: e.message }
    }
  }
}
