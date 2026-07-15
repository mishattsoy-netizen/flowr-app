import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runChain } from '@/lib/bot/chainRouter'
import { DEFAULT_STATUS_MESSAGES } from '@/lib/router-config'
import { supabaseAdmin, isSupabaseEnabled, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'
import { logWebInteraction, logModelWebMessage } from '@/lib/bot/analytics'
import fs from 'fs'
import path from 'path'

export const maxDuration = 60;

/**
 * Converts captured tool calls into a compact one-line history annotation.
 * Stored alongside the final AI response so future requests know what was queried.
 * Example: [Tools: list_content(query="tasks") → 5 items | create_content(type="note", title="Meeting notes") → ok]
 */
function buildToolSummary(toolCalls: any[]): string {
  if (!toolCalls || toolCalls.length === 0) return ''
  const parts = toolCalls.map(tc => {
    const name = tc.tool || 'unknown'
    // Pick the most meaningful arg per tool
    const argHints: string[] = []
    if (tc.searchQuery) argHints.push(`query="${String(tc.searchQuery).slice(0, 40)}"`)
    if (tc.type && name !== 'list_content') argHints.push(`type="${tc.type}"`)
    if (tc.title) argHints.push(`title="${String(tc.title).slice(0, 30)}"`)
    if (tc.id) argHints.push(`id="${String(tc.id).slice(0, 12)}..."`)
    if (tc.query && !tc.searchQuery) argHints.push(`query="${String(tc.query).slice(0, 40)}"`)

    const args = argHints.length > 0 ? `(${argHints.join(', ')})` : ''

    // Result hint
    let result = 'ok'
    if (tc.success === false || tc.error) {
      result = `error: ${String(tc.error || 'failed').slice(0, 40)}`
    } else if (Array.isArray(tc.items)) {
      result = `${tc.items.length} item${tc.items.length !== 1 ? 's' : ''}`
    } else if (Array.isArray(tc.results)) {
      result = `${tc.results.length} result${tc.results.length !== 1 ? 's' : ''}`
    } else if (tc.id && (name === 'create_content' || name === 'update_content' || name === 'append_to_note')) {
      result = `id=${String(tc.id).slice(0, 12)}`
    }

    return `${name}${args} → ${result}`
  })
  return `\n\n[Tools: ${parts.join(' | ')}]`
}

export async function POST(req: NextRequest) {
  // 1. Strict Origin Checking
  const origin = req.headers.get('origin');
  if (origin) {
    const isAllowed = 
      origin === 'https://flowr.app' || 
      origin === 'https://www.flowr.website' || 
      origin === 'https://flowr.website' || 
      origin.startsWith('http://localhost:') || 
      origin.startsWith('app://');
    
    if (!isAllowed) {
      console.warn(`[AI Chat] Blocked request from unauthorized origin: ${origin}`);
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
  }

  // Secure Proxy Fallback for Desktop App
  // If the secret service role key is not defined, we are in a packaged desktop app
  // where we cannot bundle sensitive keys. We proxy the request to the hosted backend.
  const isDesktopAppProxy = typeof window === 'undefined' && !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDesktopAppProxy) {
    const hostedBackendUrl = 'https://www.flowr.website/api/ai/chat';
    try {
      console.log('[AI Chat Proxy] Forwarding chat request to hosted backend...');
      const bodyText = await req.text();
      const headers = new Headers();
      req.headers.forEach((value, key) => {
        headers.set(key, value);
      });
      // Point Host header to production domain to prevent routing blocks
      headers.set('host', 'www.flowr.website');

      const response = await fetch(hostedBackendUrl, {
        method: 'POST',
        headers,
        body: bodyText,
        signal: req.signal,
      });

      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (err: any) {
      console.error('[AI Chat Proxy] Proxy request failed:', err);
      return NextResponse.json({ error: 'Proxy request failed: ' + err.message }, { status: 502 });
    }
  }

  let user = null;
  let supabaseClient = null;

  if (isSupabaseEnabled) {
    const supabase = createClient(
      supabaseUrl!,
      supabaseAnonKey!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.error('[AI Chat Auth] auth.getUser() error:', authError)
    }
    user = data.user
    supabaseClient = supabase;
  }

  const { prompt, buffer, images, aiApiKey, activeEntityId, activeChatId, activeSpaceId, classificationModelId, mode, intentTag, replyContext, thinkingEnabled, advisorEnabled, pendingAdvisorState, isTempChat, clientHistory, pageContext, clientTime } = await req.json()
  const activeMode = (mode === 'pro') ? mode : 'default'

  if (!prompt && !buffer) {
    return NextResponse.json({ error: 'prompt or image is required', model: 'system' }, { status: 400 })
  }
  if (prompt && typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt must be a string', model: 'system' }, { status: 400 })
  }

  const userId = user?.id || 'anonymous'

  // Gated entirely behind login — AI chat is accessible only to registered accounts.
  if (userId === 'anonymous') {
    return NextResponse.json(
      { error: 'Sign in to use AI chat.', model: 'system' },
      { status: 401 }
    )
  }

  const requestId = crypto.randomUUID()

  if (user && supabaseClient) {
    const { data: reserveResult, error: reserveError } = await supabaseClient
      .rpc('reserve_credit', { p_request_id: requestId, p_mode: activeMode })
      .single()

    if (reserveError) {
      console.error('[reserve_credit] error:', reserveError)
      // Fail open on infra errors — don't block chat because of a metering hiccup
    } else if (reserveResult && !(reserveResult as any).allowed) {
      const { blocked_window, resets_at } = reserveResult as any
      return NextResponse.json(
        {
          error: `You've hit your ${blocked_window} limit. Resets ${resets_at ? new Date(resets_at).toLocaleString() : 'soon'}.`,
          model: 'system',
          blocked_window,
          resets_at,
        },
        { status: 429 }
      )
    }
  }

  const encoder = new TextEncoder()
  const customStream = new ReadableStream({
    async start(controller) {
      let clientDisconnected = false
      req.signal.addEventListener('abort', () => { clientDisconnected = true })

      const send = (data: any) => {
        if (clientDisconnected) return
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch {}
      }

      let result: any
      try {
        const getStatusLabel = (cat: string, fallback: string) => {
          return DEFAULT_STATUS_MESSAGES[cat] || fallback
        }

        // 1. Initial status
        send({ status: getStatusLabel('CLASSIFIER', 'Thinking') })

        // Pass client-side history through to chainRouter; it'll fetch DB history itself
        const inputBuffers = images && Array.isArray(images)
          ? images.map(img => Buffer.from(img, 'base64'))
          : (buffer ? [Buffer.from(buffer, 'base64')] : undefined)

        result = await runChain(
          prompt,
          inputBuffers,
          {
            signal: req.signal,
            userId,
            aiApiKey,
            activeEntityId,
            activeChatId: activeChatId ?? null,
            activeSpaceId,
            classificationModelId,
            mode: activeMode,
            intentTag: intentTag ?? null,
            replyContext,
            thinkingEnabled: thinkingEnabled === true,
            advisorEnabled: advisorEnabled === true,
            pendingAdvisorState: pendingAdvisorState || undefined,
            isTempChat: isTempChat === true,
            clientHistory: clientHistory ?? [],
            pageContext: pageContext ?? null,
            clientTime,
            onStatus: (step: any) => {
              if (step.status === 'running') {
                send({ status: step.label || step.goal })
              }
            },
            onChunk: (chunk: string) => {
              send({ content: chunk })
            },
            onEvent: (event: any) => {
              send(event)
            }
          } as any
        )

        let content = result.content
        let isImage = false;
        let imageBuffer: Buffer | null = null;
        let mime = 'image/png';

        if (content && (Buffer.isBuffer(content) || (content as any) instanceof Uint8Array)) {
          imageBuffer = Buffer.from(content as any);
          isImage = true;
          if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) mime = 'image/jpeg';
          else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46) mime = 'image/gif';
          else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x46) mime = 'image/webp';
        } else if (result.type === 'photo' && typeof content === 'string' && content.startsWith('data:')) {
          const match = content.match(/^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/);
          if (match) {
            mime = match[1];
            imageBuffer = Buffer.from(match[2], 'base64');
            isImage = true;
          }
        }

        if (isImage && imageBuffer) {
          // Upload to Supabase Storage, then serve through same-origin API proxy
          try {
            const ext = mime.split('/')[1] || 'png';
            const filename = `ai-${Date.now()}-${crypto.randomUUID()}.${ext}`;
            let uploaded = false;
            if (supabaseAdmin) {
              // Ensure bucket exists
              const { data: buckets } = await supabaseAdmin.storage.listBuckets();
              const hasBucket = buckets?.some((b: any) => b.name === 'generated_images');
              if (!hasBucket) {
                await supabaseAdmin.storage.createBucket('generated_images', {
                  public: true,
                  fileSizeLimit: 10485760,
                }).catch(() => {});
              }
              const { error: uploadError } = await supabaseAdmin.storage
                .from('generated_images')
                .upload(filename, imageBuffer, {
                  contentType: mime,
                  cacheControl: '31536000',
                  upsert: false,
                });
              if (!uploadError) uploaded = true;
            }

            if (uploaded) {
              // Same-origin API proxy — no CORS, no rewrite issues
              content = `![Generated Image](/api/images?file=${filename})`;
            } else {
              throw new Error('upload failed or admin not available');
            }
          } catch (e) {
            // Fallback to data URL if storage upload fails
            console.error('[AI Chat] Storage upload failed, using data URL:', e);
            const b64 = imageBuffer!.toString('base64');
            content = `![Generated Image](data:${mime};base64,${b64})`;
          }
        } else if (result.type === 'photo' && typeof content === 'string' && (content.startsWith('http') || content.includes('.ai/'))) {
          content = `![Generated Image](${content})`
        }

        if (result.text_content && typeof content === 'string') {
          content = `${result.text_content}\n\n${content}`
        }

        // 5. Log and Finalize
        const logUserId = user?.id || 'anonymous'
        const toolSummary = buildToolSummary((result as any).captured_tool_calls ?? [])
        const loggedContent = (typeof content === 'string' ? content : '[image]') + toolSummary
        const modelChain = result.model_chain
        const usageType = result.usage_type || 'chat'
        
        const contextMessages = {
          classify: result.classification_trace,
          routing: result.routing_trace,
          step_traces: result.step_traces ?? undefined,
          transcript: result.transcript_md,
        }

        // Write transcript file
        if (result.transcript_md && !process.env.VERCEL) {
          try {
            const transcriptsDir = path.join(process.cwd(), 'transcripts')
            fs.mkdirSync(transcriptsDir, { recursive: true })
            const fileDate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
            const filePath = path.join(transcriptsDir, `ai-transcript-${fileDate}.md`)
            fs.writeFileSync(filePath, result.transcript_md)
          } catch (e) {
            console.error('[Transcript] Failed to write file:', e)
          }
        }

        const finalStatus = clientDisconnected ? 'interrupted' : (result.status || 'success')
        let messageLogId: number | undefined = undefined
        if (!isTempChat) {
          logWebInteraction(logUserId, prompt, 'user', usageType as any, finalStatus, modelChain, requestId, contextMessages, result.image_description, activeChatId ?? null).catch(() => {})
          // Error replies (e.g. "*System Overload*") must NOT enter replayable
          // history — the model imitates/absorbs them on later turns.
          if (finalStatus !== 'error') {
            const loggedId = await logModelWebMessage(logUserId, loggedContent, usageType as any, finalStatus, modelChain, requestId, contextMessages, result.image_description, activeChatId ?? null).catch(() => null)
            if (loggedId) messageLogId = loggedId
          }
        }

        send({
          content,
          type: result.type,
          usage_type: result.usage_type,
          model: result.model,
          log_id: messageLogId ?? undefined,
          classification_trace: result.classification_trace,
          routing_trace: result.routing_trace,
          model_chain: modelChain,
          citations: result.citations,
          tokens_used: result.tokens_used,
          pipeline_steps: result.pipeline_steps,
          advisor_questions: result.advisor_questions,
          advisor_state: result.advisor_state,
          image_description: result.image_description,
          image_prompt: (result as any).image_prompt,
          transcript_md: result.transcript_md,
          toolResults: (result as any).captured_tool_calls,
        })
        
        send('[DONE]')
      } catch (e: any) {
        console.error('[AI API Error]', e)
        send({ error: e.message || 'AI request failed.', model: 'system' })
      } finally {
        if (user && supabaseClient) {
          const finalCost = (result && typeof result.total_cost_usd === 'number') ? result.total_cost_usd : 0
          try {
            await supabaseClient.rpc('reconcile_credit', { p_request_id: requestId, p_real_amount_usd: finalCost })
          } catch (e: any) {
            console.error('[reconcile_credit] error:', e)
          }
        }
        controller.close()
      }
    }
  })

  return new NextResponse(customStream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
