import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runChain } from '@/lib/bot/chainRouter'
import { supabaseAdmin, isSupabaseEnabled } from '@/lib/supabase'
import { logWebInteraction, logModelWebMessage } from '@/lib/bot/analytics'
import { classifyIntentWithModel } from '@/lib/bot/classifier'
import { getRouterChain } from '@/lib/router-config'
import { getWebConversationMemory } from '@/lib/bot/memory'
import { getCompiledPrompt } from '@/lib/bot/compilePrompt'
import { streamOllama } from '@/lib/bot/providers/ollama'

const DEFAULT_DAILY_LIMIT = 50

async function checkAndIncrementQuota(authUserId: string): Promise<{ allowed: boolean }> {
  if (!supabaseAdmin) return { allowed: true } // Skip quota if admin is not configured
  const today = new Date().toISOString().split('T')[0]

  const { data: existing } = await supabaseAdmin
    .from('user_quotas')
    .select('messages_used_today, last_reset_date')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const needsReset = !existing || existing.last_reset_date < today
  const currentCount = needsReset ? 0 : existing.messages_used_today

  if (currentCount >= DEFAULT_DAILY_LIMIT) {
    return { allowed: false }
  }

  await supabaseAdmin
    .from('user_quotas')
    .upsert({
      auth_user_id: authUserId,
      messages_used_today: currentCount + 1,
      last_reset_date: today
    })

  return { allowed: true }
}

export async function POST(req: NextRequest) {
  let user = null;

  if (isSupabaseEnabled) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  const { prompt, buffer, aiApiKey, activeEntityId, activeWorkspaceId, classificationModelId, mode, intentTag, replyContext } = await req.json()
  const activeMode = (mode === 'think' || mode === 'pro') ? mode : 'default'

  if (!prompt && !buffer) {
    return NextResponse.json({ error: 'prompt or image is required', model: 'system' }, { status: 400 })
  }
  if (prompt && typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt must be a string', model: 'system' }, { status: 400 })
  }

  const userId = user?.id || 'anonymous'
  
  if (user) {
    const { allowed } = await checkAndIncrementQuota(user.id)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Daily message limit reached. Try again tomorrow.', model: 'system' },
        { status: 429 }
      )
    }
  }

  try {
    const { category: rawCategory } = await classifyIntentWithModel(prompt, aiApiKey, classificationModelId, activeMode, intentTag ?? null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let category = (rawCategory ?? 'FAST_SIMPLE') as any
    const [{ chain, system_prompt, temperature }, globalPromptForOllama, ollamaHistory] = await Promise.all([
      getRouterChain(category),
      getCompiledPrompt(),
      getWebConversationMemory(userId),
    ])
    let activeModelConfig = chain.find(m => m.is_enabled)
    let isOllama = false

    if (buffer) {
      const { chain: visionChain } = await getRouterChain('VISION')
      const visionModel = visionChain.find(m => m.is_enabled)
      if (visionModel && (visionModel.provider.toLowerCase() === 'ollama' || visionModel.provider.toLowerCase() === 'local' || visionModel.provider.toLowerCase() === 'ollama(my pc)')) {
        activeModelConfig = visionModel
        isOllama = true
      }
    } else if (activeModelConfig && (activeModelConfig.provider.toLowerCase() === 'ollama' || activeModelConfig.provider.toLowerCase() === 'local' || activeModelConfig.provider.toLowerCase() === 'ollama(my pc)')) {
      isOllama = true
    }

    if (isOllama && activeModelConfig) {
      const now = new Date()
      const dateContext = `[CURRENT CONTEXT]\nDate: ${now.toDateString()}\nTime: ${now.toLocaleTimeString()}\n`
      
      let fullSystemPrompt = system_prompt || ''
      if (globalPromptForOllama) {
        fullSystemPrompt = globalPromptForOllama + '\n\n' + fullSystemPrompt
      }
      fullSystemPrompt = dateContext + "\n\n" + fullSystemPrompt
      fullSystemPrompt = "CRITICAL: Provide ONLY the final answer. NEVER output internal reasoning, analysis, planning, or drafting. Do not use headers like '*Neutrality:*', '*Final version plan:*', or '*Self-Correction:*'. Jump directly to the response.\n" +
                      "When you use a tool or perform a search, always synthesize and summarize the tool results into a natural, complete, and helpful answer to the user's question. Do NOT output raw tool results verbatim.\n\n" + fullSystemPrompt;

      const stream = await streamOllama(activeModelConfig.id, prompt, fullSystemPrompt, ollamaHistory, temperature)

      if (stream) {
        const encoder = new TextEncoder()
        const decoder = new TextDecoder()

        const transformedStream = new ReadableStream({
          async start(controller) {
            const reader = stream.getReader()
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value)
                const lines = chunk.split('\n')
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim()
                    if (data === '[DONE]') {
                      controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
                      break
                    }
                    try {
                      const parsed = JSON.parse(data)
                      const contentChunk = parsed.choices?.[0]?.delta?.content || ''
                      if (contentChunk) {
                        const sseLine = JSON.stringify({
                          content: contentChunk,
                          model: activeModelConfig.id,
                        })
                        controller.enqueue(encoder.encode(`data: ${sseLine}\n\n`))
                      }
                    } catch (e) {
                      // ignore parse errors
                    }
                  }
                }
              }
            } finally {
              controller.close()
              reader.releaseLock()
            }
          }
        })

        return new NextResponse(transformedStream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
        })
      }
    }

    const result = await runChain(
      prompt,
      buffer ? Buffer.from(buffer, 'base64') : undefined,
      { userId, aiApiKey, activeEntityId, activeWorkspaceId, classificationModelId, temperature, mode: activeMode, intentTag: intentTag ?? null, replyContext }
    )

    let content = result.content
    if (Buffer.isBuffer(content)) {
      const b64 = content.toString('base64')
      content = `![Generated Image](data:image/png;base64,${b64})`
    } else if (result.type === 'photo' && typeof content === 'string' && content.startsWith('data:')) {
      content = `![Generated Image](${content})`
    }

    // Log to message_logs — never store raw base64 image data
    const logUserId = user?.id || 'anonymous'
    const requestId = crypto.randomUUID()
    const loggedContent = (result.type === 'photo' || (typeof content === 'string' && content.startsWith('![')))
      ? '[image]'
      : (typeof content === 'string' ? content : '[image]')
    const modelChain = result.model_chain
    const usageType = result.usage_type || 'chat'
    
    const contextMessages = {
      classify: result.classification_trace,
      routing: result.routing_trace
    }

    logWebInteraction(logUserId, prompt, 'user', usageType as any, 'success', modelChain, requestId, contextMessages).catch(() => {})
    const messageLogId = await logModelWebMessage(logUserId, loggedContent, usageType as any, result.status || 'success', modelChain, requestId, contextMessages).catch(() => null)
    console.log('[Chat API POST] messageLogId returned from logModelWebMessage:', messageLogId)

    return NextResponse.json({
      content,
      type: result.type,
      usage_type: result.usage_type,
      model: result.model,
      log_id: messageLogId ?? undefined,
      classification_trace: result.classification_trace,
      routing_trace: result.routing_trace,
      model_chain: modelChain,
      citations: result.citations,
      tokens_used: result.tokens_used
    })
  } catch (error: any) {
    console.error('[AI API Error]', error);
    logWebInteraction(user?.id || 'anonymous', error.message || 'AI request failed.', 'model', 'chat', 'error').catch(() => {})
    return NextResponse.json({
      error: error.message || 'AI request failed.',
      model: 'system'
    }, { status: 500 })
  }
}
