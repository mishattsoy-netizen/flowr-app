import { NextRequest, NextResponse } from 'next/server'
import {
  classifyRoadmapIntent,
  runRoadmapChain,
  getRoadmapBotConfig,
  RoadmapCategory
} from '@/lib/bot/roadmapRouter'

export async function POST(req: NextRequest) {
  const { prompt, mode, history, buffer, phases, tasks } = await req.json()
  if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 })

  try {
    // Determine category based on mode
    let category: RoadmapCategory
    if (mode === 'complex') category = 'COMPLEX'
    else if (mode === 'fast') category = 'FAST'
    else category = await classifyRoadmapIntent(prompt) // auto mode

    // Get system prompt from config
    const { system_prompt } = await getRoadmapBotConfig()

    // Build project context snapshot
    let projectContext = ''
    if (phases?.length || tasks?.length) {
      projectContext = '\n\n--- CURRENT PROJECT STATE ---\n'
      if (phases?.length) {
        projectContext += `\nPhases (${phases.length}):\n`
        for (const phase of phases) {
          const phaseTasks = tasks?.filter((t: any) => t.phase_id === phase.id) || []
          const done = phaseTasks.filter((t: any) => t.status === 'done').length
          const total = phaseTasks.length
          projectContext += `- [${phase.status}] "${phase.title}" (ID: ${phase.id}) — ${done}/${total} tasks done\n`
          if (phase.description) projectContext += `  Description: ${phase.description}\n`
          for (const task of phaseTasks) {
            projectContext += `    • [${task.status}] [${task.priority}] "${task.title}"\n`
            if (task.sub_tasks?.length) {
              const subDone = task.sub_tasks.filter((s: any) => s.done).length
              projectContext += `      Sub-tasks: ${subDone}/${task.sub_tasks.length} done\n`
            }
          }
        }
      }
      const totalTasks = tasks?.length || 0
      const doneTasks = tasks?.filter((t: any) => t.status === 'done').length || 0
      projectContext += `\nOverall Progress: ${doneTasks}/${totalTasks} tasks completed (${totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0}%)\n`
      projectContext += '--- END PROJECT STATE ---'
    }

    // Build full system prompt
    const fullSystemPrompt = `${system_prompt}
${projectContext}

STRUCTURED OUTPUT FORMAT:
When creating phases or tasks, you MUST output them as structured action blocks that the user can click "Apply" to add to their roadmap. Use this exact format:

[ROADMAP_ACTION]
{ "action": "create_phase", "title": "Phase Name", "description": "What this phase achieves", "color": "#hex" }
[/ROADMAP_ACTION]

[ROADMAP_ACTION]
{ "action": "create_task", "phase_id": "PHASE_ID_HERE", "title": "Task Name", "description": "What needs to be done", "priority": "high", "sub_tasks": [{"title": "Sub-task 1", "done": false}], "agent_prompt": "Detailed prompt a coding AI can use to implement this task. Include file paths, code patterns, and implementation details." }
[/ROADMAP_ACTION]

RULES:
- When the user asks to analyze, plan, or create — ALWAYS generate [ROADMAP_ACTION] blocks, not just text descriptions.
- For tasks, ALWAYS include a detailed "agent_prompt" field with specific implementation instructions.
- Use existing phase IDs from the project state when adding tasks to existing phases.
- When creating new phases, use "create_phase" actions BEFORE the tasks that belong to them.
- Priority must be one of: low, medium, high, critical.
- Be specific and actionable, not generic.

RESPONSE FORMAT:
Wrap your conversational response to the user inside <answer> tags. Place [ROADMAP_ACTION] blocks OUTSIDE the answer tags.
Example:
[ROADMAP_ACTION]
{ "action": "create_phase", "title": "Authentication", "description": "User auth system", "color": "#6366f1" }
[/ROADMAP_ACTION]

<answer>
I've created an Authentication phase with 3 tasks. Click Apply to add them to your roadmap.
</answer>`

    const result = await runRoadmapChain(prompt, fullSystemPrompt, history || [], category, buffer ? Buffer.from(buffer, 'base64') : undefined)

    return NextResponse.json({
      content: result.content,
      model: result.model,
      category,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
