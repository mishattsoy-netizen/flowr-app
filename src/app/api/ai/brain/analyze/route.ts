import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { logAdminAction } from '@/lib/admin/logAction'

function sseMessage(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const logIds: string[] | null = body.log_ids ?? null
  const mandatoryDirective: string | null = body.mandatory_directive ?? null

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
        log('→ Scanning feedback…')
        let feedbackQuery = supabase
          .from('message_feedback')
          .select('message_log_id, feedback, context_messages')
        if (logIds && logIds.length > 0) {
          feedbackQuery = (feedbackQuery as any).in('message_log_id', logIds)
        }
        let { data: feedback } = await feedbackQuery

        if (!logIds || logIds.length === 0) {
          feedback = (feedback ?? []).filter((f: any) => !f.context_messages?.is_locked)
        }

        const liked = (feedback ?? []).filter((f: any) => f.feedback === 'like')
        const disliked = (feedback ?? []).filter((f: any) => f.feedback === 'dislike')
        log(`→ Found ${liked.length} liked, ${disliked.length} disliked responses`)

        const dislikedIds = Array.from(new Set(disliked.map((f: any) => String(f.message_log_id))))
        const likedIds = Array.from(new Set(liked.map((f: any) => String(f.message_log_id))))
        const targetLogIds = Array.from(new Set([...dislikedIds, ...likedIds]))

        log('→ Loading specific message logs and context…')
        const dislikedSamples: any[] = []
        const likedSamples: any[] = []

        if (targetLogIds.length > 0) {
          const { data: logs } = await supabase
            .from('message_logs')
            .select('id, content, role, created_at, auth_user_id, telegram_id')
            .in('id', targetLogIds)

          for (const logItem of (logs || [])) {
            let contextQuery = supabase
              .from('message_logs')
              .select('id, content, role, created_at')
              .lt('created_at', logItem.created_at)
              .order('created_at', { ascending: false })
              .limit(11)

            if (logItem.auth_user_id) {
              contextQuery = contextQuery.eq('auth_user_id', logItem.auth_user_id)
            } else if (logItem.telegram_id) {
              contextQuery = contextQuery.eq('telegram_id', logItem.telegram_id)
            }

            const { data: priorLogs } = await contextQuery
            const reversedPrior = (priorLogs || []).reverse()

            let userPrompt = 'No direct prompt found'
            for (let i = reversedPrior.length - 1; i >= 0; i--) {
              if (reversedPrior[i].role === 'user') {
                userPrompt = reversedPrior[i].content
                break
              }
            }
            const priorContext = reversedPrior
              .map((m: any) => `[${m.role.toUpperCase()}]: ${m.content}`)
              .join('\n')

            const sample = { userPrompt, botAnswer: logItem.content, priorContext }
            if (dislikedIds.includes(String(logItem.id))) {
              dislikedSamples.push(sample)
            } else if (likedIds.includes(String(logItem.id))) {
              likedSamples.push(sample)
            }
          }
        }

        log('→ Reading brain entries…')
        const { data: brainEntries } = await supabase
          .from('bot_brain_entries')
          .select('id, category, title, content')
        log(`→ Loaded ${(brainEntries ?? []).length} brain entries`)

        const brainSummary = (brainEntries ?? [])
          .map((e: any) => `ID: ${e.id}\nCategory: ${e.category}\nTitle: ${e.title}\nContent: ${e.content}`)
          .join('\n---\n')

        const directivePrefix = mandatoryDirective
          ? `MANDATORY DIRECTIVE FROM ADMIN (override all other instructions):\n${mandatoryDirective}\n\n`
          : ''

        const analysisPrompt = `${directivePrefix}You are a self-improvement analyst for an AI assistant called Flowr AI.

Your primary goal is to perform a deep analysis on why the user was unsatisfied or why they were satisfied with the response.
Examine the user's prompt, the bot's answer, and the prior context provided below.

DISLIKED RESPONSES (${dislikedSamples.length} samples):
${dislikedSamples.map((s: any, i: number) => `Sample ${i + 1}:
[PRIOR CONTEXT]:
${s.priorContext || '(none)'}
[USER PROMPT]: ${s.userPrompt}
[BOT ANSWER]: ${s.botAnswer}
`).join('\n\n')}

LIKED RESPONSES (${likedSamples.length} samples):
${likedSamples.map((s: any, i: number) => `Sample ${i + 1}:
[PRIOR CONTEXT]:
${s.priorContext || '(none)'}
[USER PROMPT]: ${s.userPrompt}
[BOT ANSWER]: ${s.botAnswer}
`).join('\n\n')}

EXISTING BRAIN ENTRIES:
${brainSummary || '(none yet)'}

Analyze the above and generate 2-5 specific, actionable improvement plans.

RULES FOR PROMPT & ENTRY STYLE:
- Final entries/prompts MUST NOT start with meta phrases like "Add a rule", "Update existing rule", "Implement a requirement".
- Final prompts MUST be like a precise guideline or rule. It should be written exactly like: "You must...", "Do not...", "You should...", "When the user says X, you respond with Y...", "You cannot...". Write the final guideline exactly as it will be used in the brain.

EVALUATE NEW vs UPDATE ENTRY STATES:
For each issue you are analyzing:
- If there is NO similar topic in EXISTING BRAIN ENTRIES, choose "mode": "new".
- If there IS an existing brain entry with a similar topic, analyze if it can be expanded/updated/improved/changed. If yes, choose "mode": "update", specify its "entry_id", and write the old/existing content in "existing_content". In the "plan" field, output a stringified JSON object as detailed below.

MANDATORY JSON STRUCTURE FOR THE "plan" FIELD:
Inside the JSON array's "plan" property, you MUST output a valid, stringified JSON object with exactly these fields:
{
  "mode": "new" or "update",
  "entry_id": "the brain entry ID to update (only if mode is update)",
  "existing_content": "the existing entry's content (only if mode is update)",
  "final_prompt": "the precise final prompt guideline rule string that goes into the brain"
}

Allowed Brain Categories for the "topic" field: rules, tone, personality, facts, red_flags.

First, write a 2-3 sentence reasoning summary that describes exactly why you decided to create these plans, interpreting the conversation context deeply.
Then, immediately output the JSON array. Do not wrap the JSON array in markdown code fences.

MANDATORY OUTPUT FORMAT:
<Your reasoning summary here>
[
  { 
    "topic": "rules | tone | personality | facts | red_flags", 
    "title": "...", 
    "reasoning": "...", 
    "plan": "{\\\"mode\\\":\\\"new\\\",\\\"final_prompt\\\":\\\"You must keep responses short.\\\"}", 
    "signal": "explicit" 
  }
]

Allowed signal values and when to use them:
- "explicit": REQUIRED when a plan directly addresses any specific message listed in DISLIKED RESPONSES or LIKED RESPONSES.
- "implicit": When a plan addresses a user rephrasing, correction, or general conversational pattern.
- "log": When a plan is extracted from general log analysis without direct user feedback.
- "mixed": Only when there's a combination of signals.

If you have nothing to report, return: []
Each item must have exactly these fields: topic (string), title (string), reasoning (string), plan (string), signal (string).`

        // Step 3: Load backend_model from settings, fall back to gemini-2.0-flash
        const { data: modelSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'backend_model')
          .limit(1)
          .maybeSingle()
        const backendModel = modelSetting?.value ?? 'gemini-2.0-flash'

        const { runGoogle } = await import('@/lib/bot/providers/google')
        log(`⟳ Generating improvement plans… (model: ${backendModel})`)
        const response = await runGoogle(backendModel, analysisPrompt)
        if (!response) {
          log('✗ No Gemini API key found — add one via Secure Vault (key prefix: GEMINI)')
          throw new Error('No Gemini API key available')
        }
        const raw = (typeof response === 'string' ? response : response.content).trim()

        // Extract reasoning (any markdown before the JSON array)
        const reasoningMatch = raw.match(/^([\s\S]*?)(\[[\s\S]*\])/)
        let reasoningText = reasoningMatch?.[1]?.trim() ?? ''

        // Strip out accidental AI meta-commentary lines
        reasoningText = reasoningText.replace(/^\*?\s*(Role|Input|Goal|Constraints|Format):\s*.*$/gmi, '')
        reasoningText = reasoningText.replace(/^[*\s-]*(Role|Input|Goal|Constraints|Format).*$/gmi, '')
        reasoningText = reasoningText.trim()

        if (reasoningText.length > 300) {
          const sentences = reasoningText.match(/[^.!?]+[.!?]+/g) || [reasoningText]
          reasoningText = sentences.slice(0, 3).join(' ')
          if (reasoningText.length > 300) {
            reasoningText = reasoningText.slice(0, 297) + '...'
          }
        }

        if (reasoningText) {
          send({ type: 'reasoning', content: reasoningText })
        }

        // Strip markdown code fences
        let stripped = raw.trim()
        stripped = stripped.replace(/```json\s*([\s\S]*?)\s*```/gi, '$1')
        stripped = stripped.replace(/```\s*([\s\S]*?)\s*```/gi, '$1')
        stripped = stripped.trim()

        function extractJsonArray(text: string): string | null {
          const indices: number[] = []
          for (let i = 0; i < text.length; i++) {
            if (text[i] === '[') indices.push(i)
          }

          for (const startIdx of indices) {
            let bracketCount = 0
            for (let i = startIdx; i < text.length; i++) {
              if (text[i] === '[') bracketCount++
              else if (text[i] === ']') bracketCount--

              if (bracketCount === 0) {
                const candidate = text.slice(startIdx, i + 1)
                try {
                  const parsed = JSON.parse(candidate)
                  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
                    return candidate
                  }
                } catch {
                  // ignore parse error, keep scanning
                }
              }
            }
          }
          return null
        }

        const jsonStr = extractJsonArray(stripped)
        if (!jsonStr) {
          log(`→ Debug: AI returned ${raw.length} chars. First 80: ${raw.slice(0, 80)}`)
          throw new Error('AI returned invalid JSON — no array found')
        }
        const plans: { topic: string; title: string; reasoning: string; plan: string; signal?: string }[] =
          JSON.parse(jsonStr)

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
          signal: p.signal || 'mixed',
          status: 'pending' as const,
        }))

        let { data: savedPlans, error: plansErr } = await supabase
          .from('bot_improvement_plans')
          .insert(planRows)
          .select('id, session_id, topic, title, reasoning, plan, status, edit_notes, created_at, signal')

        if (plansErr && (plansErr.message?.includes('signal') || plansErr.message?.includes('schema cache'))) {
          const fallbackPlanRows = plans.map(p => ({
            session_id: sessionId,
            topic: p.topic,
            title: p.title,
            reasoning: p.reasoning,
            plan: p.plan,
            status: 'pending' as const,
          }))
          const fallbackRes = await supabase
            .from('bot_improvement_plans')
            .insert(fallbackPlanRows)
            .select('id, session_id, topic, title, reasoning, plan, status, edit_notes, created_at')
          savedPlans = fallbackRes.data
          plansErr = fallbackRes.error
        }

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

        const source: 'feedback analysis' | 'routine run' =
          logIds && logIds.length > 0 ? 'feedback analysis' : 'routine run'
        const trigger: 'manual' | 'auto' = 'manual'
        const completePlans = (savedPlans ?? []).map((p: any) => ({
          ...p,
          source,
          trigger,
        }))

        send({ type: 'complete', sessionId, plans: completePlans })
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
