import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runChain } from '@/lib/bot/chainRouter'
import { supabaseAdmin, isSupabaseEnabled, supabaseUrl, supabaseAnonKey } from '@/lib/supabase'
import { logWebInteraction, logModelWebMessage } from '@/lib/bot/analytics'
import fs from 'fs'
import path from 'path'

const DEFAULT_DAILY_LIMIT = 1000

async function checkAndIncrementQuota(supabaseClient: any): Promise<{ allowed: boolean }> {
  if (!supabaseClient) return { allowed: true } // Skip quota if client is not configured
  
  const { data: allowed, error } = await supabaseClient.rpc('increment_my_quota')
  if (error) {
    console.error('[checkAndIncrementQuota] error:', error)
    return { allowed: true } // Graceful fallback on database error
  }
  return { allowed: !!allowed }
}

export async function POST(req: NextRequest) {
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
  
  if (user && supabaseClient) {
    const { allowed } = await checkAndIncrementQuota(supabaseClient)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Daily message limit reached. Try again tomorrow.', model: 'system' },
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

      try {
        const settings = await import('@/lib/router-config').then(m => m.getPipelineSettings())

        const getStatusLabel = (cat: string, fallback: string) => {
          const custom = settings.statusMessages?.[cat]
          return custom ? `${custom.emoji} ${custom.label}`.trim() : fallback
        }

        // 1. Initial status
        send({ status: getStatusLabel('CLASSIFIER', 'Thinking') })

        // Pass client-side history through to chainRouter; it'll fetch DB history itself
        const inputBuffers = images && Array.isArray(images)
          ? images.map(img => Buffer.from(img, 'base64'))
          : (buffer ? [Buffer.from(buffer, 'base64')] : undefined)

        const result = await runChain(
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
          try {
            const ext = mime.split('/')[1] || 'png';
            const filename = `ai-${Date.now()}-${crypto.randomUUID()}.${ext}`;

            // Upload to Supabase Storage for persistence across sessions
            if (supabaseAdmin) {
              // Ensure bucket exists (first call creates it, subsequent calls are no-ops)
              const { data: buckets } = await supabaseAdmin.storage.listBuckets();
              const hasBucket = buckets?.some(b => b.name === 'generated_images');
              if (!hasBucket) {
                await supabaseAdmin.storage.createBucket('generated_images', {
                  public: true,
                  fileSizeLimit: 10485760, // 10 MB
                }).catch(() => {}); // ignore if race-condition double-create
              }

              const { error: uploadError } = await supabaseAdmin.storage
                .from('generated_images')
                .upload(filename, imageBuffer, {
                  contentType: mime,
                  cacheControl: '31536000',
                  upsert: false,
                });

              if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

              const { data: { publicUrl } } = supabaseAdmin.storage
                .from('generated_images')
                .getPublicUrl(filename);

              content = `![Generated Image](${publicUrl})`;
            } else {
              throw new Error('supabaseAdmin not available');
            }
          } catch (e) {
            console.error('[AI Chat] Failed to save generated image to storage:', e);
            // Fallback to base64 if storage save fails
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
        const requestId = crypto.randomUUID()
        const loggedContent = typeof content === 'string' ? content : '[image]'
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
          const loggedId = await logModelWebMessage(logUserId, loggedContent, usageType as any, finalStatus, modelChain, requestId, contextMessages, result.image_description, activeChatId ?? null).catch(() => null)
          if (loggedId) messageLogId = loggedId
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
        controller.close()
      }
    }
  })

  return new NextResponse(customStream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  })
}
