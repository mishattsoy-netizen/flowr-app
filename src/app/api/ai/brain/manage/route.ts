import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, entries } = body

    if (!message) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Load settings prompts/directives
    const { data: settings } = await supabase
      .from('bot_settings')
      .select('category, content')
      .eq('mode', 'default')

    const settingsSummary = (settings || [])
      .map((s: any) => `[${s.category}]: ${s.content}`)
      .join('\n')

    const entriesSummary = (entries || [])
      .map((e: any) => `ID: ${e.id}\nCategory: ${e.category}\nTitle: ${e.title}\nContent: ${e.content}`)
      .join('\n---\n')

    const systemPrompt = `You are the Brain AI Manager for Flowr AI.
Your purpose is to help the user manage brain entries in a professional, organized manner. 
You can only read brain entries and settings prompts.

The user can ask you to do various things, such as:
- Analyze all entries if there are any that can be merged/combined, updated, expanded, rewritten, etc.
- Sort entries into categories (rules, red_flags, tone, personality, facts)
- Expand an entry
- Add context/info to an entry
- Combine/merge multiple entries into one
- Make entries more precise
- Identify unnecessary or redundant entries to delete

CURRENT SETTINGS PROMPTS:
${settingsSummary || '(None)'}

CURRENT BRAIN ENTRIES:
${entriesSummary || '(None yet)'}

You must carefully evaluate the user's message and current brain entries, then respond with a reasoning summary and specific recommended actions in valid JSON format.

Your output MUST be a valid JSON object with the following structure:
{
  "reasoning": "A 2-3 sentence summary of your analysis and findings.",
  "actions": [
    {
      "type": "create" | "update" | "delete",
      "entryId": "Entry ID if editing/deleting",
      "category": "rules | red_flags | tone | personality | facts",
      "title": "Title for the new/updated entry",
      "content": "Full, precise final rule string for the brain entry (guideline, instruction, fact, etc.). Use the precise prompt guideline rule style: You must..., Do not..., You should..., etc."
    }
  ]
}

DO NOT include markdown code fences or any conversational wrapper in the output. The response must be exactly a single JSON object.`

    const { data: promptRow } = await supabase
      .from('bot_compiled_prompt')
      .select('backend_model')
      .eq('mode', 'default')
      .limit(1)
      .single()
    const backendModel = promptRow?.backend_model ?? 'gemini-2.0-flash'

    const { runGoogle } = await import('@/lib/bot/providers/google')
    const contextKey = process.env.GEMINI_API_KEY || undefined
    const response = await runGoogle(backendModel, message, systemPrompt, undefined, contextKey ? { aiApiKey: contextKey } : undefined)
    if (!response) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 })
    }
    const raw = (typeof response === 'string' ? response : response.content).trim()

    // Strip out possible AI markdown code fence wrappers
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    return NextResponse.json(JSON.parse(stripped))
  } catch (error: any) {
    console.error('[Brain AI Manager API Error]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
