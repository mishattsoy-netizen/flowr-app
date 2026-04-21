import { getProviderKeys } from '../../vault'
import { logger } from '../../logger'

export async function runGroq(modelId: string, prompt: string, systemPrompt?: string): Promise<string | null> {
  const keys = await getProviderKeys('GROQ')
  
  if (keys.length === 0) {
    logger.error('No Groq keys found in vault')
    return null
  }

  for (const key of keys) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        })
      })

      if (response.status === 429) {
        logger.warn(`Groq key rate limited (429). Trying next key...`)
        continue
      }

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || `Groq API Error: ${response.status}`)
      }

      return data.choices[0]?.message?.content || null
    } catch (error: any) {
      logger.error(`Groq model ${modelId} execution failed:`, error.message)
      // If it's a network error or generic error, try next key just in case
      continue 
    }
  }

  return null
}
