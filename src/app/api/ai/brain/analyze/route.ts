import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { getProviderKeys } from '@/lib/vault'
import { logAdminAction } from '@/lib/admin/logAction'
import { GoogleGenerativeAI } from '@google/generative-ai'

function sseMessage(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const logIds: string[] | null = body.log_ids ?? null

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(sseMessage(data)))
      }

      // Create session record
      const { data: session, error: sessionErr } = await supabase
        .from('bot_analysis_sessions')
        .insert({
          status: 'running',
          triggered_by: logIds ? 'feedback_selection' : 'manual',
          log_ids: logIds,
        })
        .select('id')
        .single()

      if (sessionErr || !session) {
        send({ type: 'error', message: 'Failed to create session' })
        controller.close()
        return
      }

      const sessionId = session.id
      const logLines: string[] = []

      function log(line: string) {
        logLines.push(line)
        send({ type: 'log', line })
      }

      try {
        log('$ Starting analysis session…')

        // Step 1: Load data
        log('→ Loading message logs…')
        let logsQuery = supabase
          .from('message_logs')
          .select('id, content, role')
          .eq('role', 'assistant')
          .limit(200)
        if (logIds && logIds.length > 0) {
          logsQuery = (logsQuery as any).in('id', logIds)
        }
        const { data: logs } = await logsQuery
        log(`→ Loaded ${(logs ?? []).length} assistant messages`)

        log('→ Scanning feedback…')
        const { data: feedback } = await supabase
          .from('message_feedback')
          .select('message_log_id, feedback')
        const liked = (feedback ?? []).filter((f: any) => f.feedback === 'like')
        const disliked = (feedback ?? []).filter((f: any) => f.feedback === 'dislike')
        log(`→ Found ${liked.length} liked, ${disliked.length} disliked responses`)

        log('→ Reading brain entries…')
        const { data: brainEntries } = await supabase
          .from('bot_brain_entries')
          .select('category, title')
        log(`→ Loaded ${(brainEntries ?? []).length} brain entries`)

        // Step 2: Build analysis prompt
        log('⟳ Identifying improvement areas…')

        const dislikedIds = new Set(disliked.map((f: any) => String(f.message_log_id)))
        const likedIds = new Set(liked.map((f: any) => String(f.message_log_id)))
        const dislikedMessages = (logs ?? [])
          .filter((l: any) => dislikedIds.has(String(l.id)))
          .map((l: any) => (l.content as string).slice(0, 200))
          .slice(0, 20)
        const likedMessages = (logs ?? [])
          .filter((l: any) => likedIds.has(String(l.id)))
          .map((l: any) => (l.content as string).slice(0, 200))
          .slice(0, 10)
        const brainSummary = (brainEntries ?? [])
          .map((e: any) => `${e.category}: ${e.title}`)
          .join('\n')

        const analysisPrompt = `You are a self-improvement analyst for an AI assistant called Flowr AI.

DISLIKED RESPONSES (${dislikedMessages.length} samples):
${dislikedMessages.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n\n')}

LIKED RESPONSES (${likedMessages.length} samples):
${likedMessages.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n\n')}

EXISTING BRAIN ENTRIES:
${brainSummary || '(none yet)'}

Analyze the above and generate 2-5 specific, actionable improvement plans.
Respond ONLY with a valid JSON array. Each item must have exactly these fields: topic (string), title (string), reasoning (string), plan (string).
Example: [{"topic":"Answer Style","title":"Reduce verbose responses","reasoning":"23 disliked responses were long...","plan":"Add rule: keep responses under 3 sentences unless asked for detail"}]`

        // Step 3: Get Gemini API key from vault
        const keys = await getProviderKeys('GEMINI')
        if (keys.length === 0) {
          log('✗ No Gemini API key found — add one via Secure Vault (key prefix: GEMINI)')
          throw new Error('No Gemini API key available')
        }

        const genAI = new GoogleGenerativeAI(keys[0])
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        log('⟳ Generating improvement plans…')
        const result = await model.generateContent(analysisPrompt)
        const raw = result.response.text().trim()

        // Parse JSON from response (model sometimes wraps in markdown)
        const jsonMatch = raw.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('AI returned invalid JSON — no array found')
        const plans: { topic: string; title: string; reasoning: string; plan: string }[] =
          JSON.parse(jsonMatch[0])

        if (!Array.isArray(plans) || plans.length === 0) {
          throw new Error('AI returned empty plans array')
        }

        log(`⟳ Writing ${plans.length} improvement plan${plans.length === 1 ? '' : 's'}…`)

        const planRows = plans.map(p => ({
          session_id: sessionId,
          topic: p.topic,
          title: p.title,
          reasoning: p.reasoning,
          plan: p.plan,
          status: 'pending' as const,
        }))

        const { data: savedPlans, error: plansErr } = await supabase
          .from('bot_improvement_plans')
          .insert(planRows)
          .select('id, session_id, topic, title, reasoning, plan, status, edit_notes, created_at')

        if (plansErr) throw plansErr

        for (let i = 0; i < plans.length; i++) {
          log(`✓ Plan ${i + 1} of ${plans.length} written`)
        }
        log(`✓ Session complete · ${plans.length} plan${plans.length === 1 ? '' : 's'} generated`)

        // Mark session complete
        await supabase
          .from('bot_analysis_sessions')
          .update({
            status: 'complete',
            finished_at: new Date().toISOString(),
            log_lines: logLines,
          })
          .eq('id', sessionId)

        await logAdminAction(
          'routine_ran',
          `Analysis routine complete · ${plans.length} plans`,
          { sessionId, planCount: plans.length }
        )

        send({ type: 'complete', sessionId, plans: savedPlans ?? [] })
      } catch (err: any) {
        log(`✗ Error: ${err.message}`)
        await supabase
          .from('bot_analysis_sessions')
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            log_lines: logLines,
          })
          .eq('id', sessionId)
        send({ type: 'error', message: err.message })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
