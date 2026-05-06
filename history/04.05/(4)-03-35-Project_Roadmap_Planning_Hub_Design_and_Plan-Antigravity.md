User request: "lets write a plan, i want you to create new page in the settings that open project plan, progress, tasks, phases, what is left to do... basically a place that tracks project progression, and shows remaining steps till beta public launch. there must be bot, assistant that uses models from registry that can help me edit plans phases, todos, organizing, planning, brainstorming, run professional analysis, seo planning, integrations planning"

## Objective Reconstruction

Design and plan a Project Roadmap & Planning Hub page for the admin panel that tracks project progression toward beta launch, with an embedded AI planning assistant that can generate executable prompts for coding agents.

## Strategic Reasoning

Used the brainstorming skill to collaboratively refine the idea through one-question-at-a-time dialogue. Each architectural decision was presented as multiple-choice options with a recommendation. The writing-plans skill was then used to produce a detailed implementation plan with exact file paths, code examples, and task ordering.

Key decisions made through brainstorming:
- Admin panel only (not user-facing)
- Supabase storage (persistent, cross-device)
- Embedded resizable AI sidebar (not reusing global assistant)
- Phases → Tasks with sub-tasks hierarchy
- Hybrid layout (phase strip + focused task list)
- Independent router matrix for the planning bot (CLASSIFIER, COMPLEX, FAST, VISION, WEB_SEARCH)
- Per-task agent prompts with copy-to-clipboard
- Phase export as markdown for coding agents
- Editable system prompt via settings modal

## Detailed Blueprint

12-task implementation plan covering:
1. Supabase schema (5 tables: phases, tasks, ai_chats, bot_config, router_chains)
2. CRUD API routes for phases and tasks
3. Planning bot chat API with independent router
4. Bot config and router config APIs
5. Admin sidebar nav link
6. Page shell (server component)
7. RoadmapClient main layout component
8. PhaseStrip component
9. TaskCard component (with copy prompt, sub-tasks)
10. PlanningAssistant sidebar (resizable, mode switcher, action blocks)
11. Bot config modal + router settings
12. Export functionality (phase/all as markdown)

## Operational Trace

- Read project structure, store, types, admin components, API routes, router config, classifier, chain router, providers
- Ran brainstorming skill with 6 iterative questions
- User added requirements: agent prompts per task, export as markdown, independent router, system prompt editor
- Wrote implementation plan to `docs/plans/2026-05-04-roadmap-planner.md`

## Status Assessment

- **Completed:** Full design brainstorming + detailed implementation plan written
- **Next step:** User reviews plan, then implementation begins (3 batches: backend → core UI → AI + polish)
- Agents used: `engineering-software-architect` (design), `engineering-frontend-developer` (plan), `design-ux-architect` (layout decisions)
