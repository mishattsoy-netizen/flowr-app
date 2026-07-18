import { logger } from '../../logger'
import { supabaseAdmin } from '../../supabase'
import { parseMarkdownToBlocks, normalizeBlocks, blocksToMarkdown } from '../../editor/markdownBlocks'
import { sanitizeToolContent } from '../services/imagePromptGuard'
import type { BlockInput } from '../../editor/markdownBlocks'
import { extractContent } from '../providers/content-extract'
import { extractYoutubeTranscript, isYouTubeUrl } from '../providers/youtube-extract'

/** Recursively sanitizes each block's `content` string (and any nested `children`) in place. */
export function sanitizeBlocks(blocks: BlockInput[] | undefined): BlockInput[] | undefined {
  if (!Array.isArray(blocks)) return blocks
  for (const block of blocks) {
    if (block.content) block.content = sanitizeToolContent(block.content)
    if (Array.isArray(block.children)) sanitizeBlocks(block.children)
  }
  return blocks
}

const PENDING_ACTION_TTL_MS = 5 * 60 * 1000

/**
 * A stored pending_action only backs a confirmed:true call if it's recent.
 * Without this, an abandoned dry-run (the user moved on without answering)
 * stays matchable indefinitely, so an unrelated later "yes" can still pass
 * the id-match gate and execute a stale action.
 */
export function isPendingActionFresh(pending: { created_at?: string } | undefined | null): boolean {
  if (!pending?.created_at) return false
  const age = Date.now() - new Date(pending.created_at).getTime()
  return Number.isFinite(age) && age >= 0 && age <= PENDING_ACTION_TTL_MS
}

/**
 * Deterministic version of "is this confirmation still valid": a pending_action
 * is only confirmable on the turn immediately after the dry-run that created it.
 * This doesn't depend on wall-clock time (the TTL above) — it's a hard,
 * turn-count-based expiry. currentTurnSeq is the session's turn_seq AFTER
 * this turn's increment (see chainRouter.ts), so a dry-run stamped at turn N is
 * only confirmable when currentTurnSeq === N + 1.
 */
export function isPendingActionSameNextTurn(pending: { turn_seq?: number } | undefined | null, currentTurnSeq: number | undefined): boolean {
  if (typeof pending?.turn_seq !== 'number' || typeof currentTurnSeq !== 'number') return false
  return currentTurnSeq === pending.turn_seq + 1
}

/**
 * Applies find/replace patch ops to Markdown, atomically. Returns the patched
 * text, or throws with a message listing every `find` string that wasn't
 * found (all-or-nothing — no partial writes).
 */
export function applyPatchOps(markdown: string, ops: { find: string; replace: string }[]): string {
  let result = markdown
  const missing: string[] = []
  for (const op of ops) {
    if (typeof op?.find !== 'string' || typeof op?.replace !== 'string') {
      missing.push(String(op?.find ?? '(invalid op)'))
      continue
    }
    if (!result.includes(op.find)) {
      missing.push(op.find)
      continue
    }
    result = result.replace(op.find, op.replace)
  }
  if (missing.length > 0) {
    throw new Error(`Patch failed — these 'find' strings were not found in the note body: ${missing.map(m => JSON.stringify(m)).join(', ')}`)
  }
  return result
}

// Helper: resolve active space ID for a user
async function resolveSpaceId(context: any): Promise<string | null> {
  // 1. Context value takes priority
  if (context?.activeSpaceId) return context.activeSpaceId;

  if (context?.userId && context.userId !== 'anonymous') {
    // 2. Check profile
    const { data: user } = await supabaseAdmin!
      .from('profiles')
      .select('active_space_id')
      .eq('id', context.userId)
      .single();
    if (user?.active_space_id) return user.active_space_id;

    // 3. Check default space
    const { data: defaultSpace } = await supabaseAdmin!
      .from('spaces')
      .select('id')
      .eq('owner_id', context.userId)
      .eq('is_default', true)
      .maybeSingle();
    if (defaultSpace?.id) return defaultSpace.id;

    // 4. Any space at all
    const { data: anySpace } = await supabaseAdmin!
      .from('spaces')
      .select('id')
      .eq('owner_id', context.userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (anySpace?.id) return anySpace.id;

    // 5. No spaces exist — create one
    const mainId = 'space-' + Date.now().toString();
    await supabaseAdmin!.from('spaces').insert({
      id: mainId,
      name: 'Main',
      type: 'personal',
      owner_id: context.userId,
      is_default: true,
      created_at: new Date().toISOString(),
    });
    return mainId;
  }

  return null;
}
// Helper: check if user is anonymous or has invalid UUID
function isUserAnonymous(context: any): boolean {
  if (!context?.userId || context.userId === 'anonymous') return true
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context.userId)
  return !isUuid
}

// Helper: process subtasks to ensure they have an id and correct schema
function processSubtasks(subtasks: any[] | undefined): any[] | null {
  if (!subtasks || !Array.isArray(subtasks)) return null;
  return subtasks.map(st => ({
    id: st.id || 'st-' + Math.random().toString(36).substring(2, 10),
    text: st.text || st.title || '',
    completed: !!st.completed
  }));
}

// Helper: parse client time into local today and yesterday ISO strings
function getClientDateStrings(context: any): { todayStr: string; yesterdayStr: string } {
  let today = new Date();
  if (context?.clientTime) {
    const parsedDate = new Date(context.clientTime);
    if (!isNaN(parsedDate.getTime())) {
      today = parsedDate;
    } else {
      // Regex fallback
      const match = context.clientTime.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/);
      if (match) {
        const months: Record<string, string> = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' };
        const d = match[2].padStart(2, '0');
        const formatted = `${match[3]}-${months[match[1]]}-${d}`;
        const testDate = new Date(formatted);
        if (!isNaN(testDate.getTime())) {
          today = testDate;
        }
      }
    }
  }
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return {
    todayStr: today.toISOString().split('T')[0],
    yesterdayStr: yesterday.toISOString().split('T')[0]
  };
}


export const toolHandlers: Record<string, (args: any, context?: any) => Promise<any>> = {

  // ── CREATE CONTENT ────────────────────────────────────────────────────────────
  async create_content(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage tasks and notes.' }
    }

    let { type, title, content, blocks, parentId, assignedWorkspaceId,
            status, priority, tag, dueDate, description, subtasks } = args

    if (!type) return { error: "'type' is required (note | folder | workspace | task)" }
    if (!title) return { error: "'title' is required" }

    // §6d: strip leaked dynamicContext scaffolding ([PENDING CONFIRMATION], [FOCUS],
    // etc.) before it's persisted — the model sometimes echoes this metadata
    // verbatim into saved content instead of treating it as invisible.
    title = sanitizeToolContent(title)
    if (typeof content === 'string') content = sanitizeToolContent(content)
    if (typeof description === 'string') description = sanitizeToolContent(description)
    if (Array.isArray(blocks)) blocks = sanitizeBlocks(blocks)

    try {
      const spaceId = await resolveSpaceId(context)

      // --- DEDUPLICATION CHECK ---
      // Prevent duplicate creation of entities during router fallback retries.
      // We check if an entity with the same type, title, and parentId was created recently.
      if (type === 'workspace' || type === 'folder' || type === 'note') {
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
        let query = supabaseAdmin.from('entities')
          .select('id')
          .eq('title', title)
          .eq('type', type)
          .eq('owner_id', context.userId)
          .gte('created_at', thirtySecondsAgo);
        
        if (parentId) query = query.eq('parent_id', parentId);
        else query = query.is('parent_id', null);

        const { data: existing } = await query;
        if (existing && existing.length > 0) {
          return { success: true, id: existing[0].id, type, title, parentId, deduplicated: true }
        }
      }

      // --- TASK ---
      if (type === 'task') {
        // --- TASK DEDUPLICATION CHECK ---
        // Prevent duplicate tasks from router retries or repeated user sends.
        // Matches on same title + owner + workspace within a 30-second window.
        {
          const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString()
          let dedupQuery = supabaseAdmin.from('tasks')
            .select('id')
            .eq('title', title)
            .eq('owner_id', context.userId)
            .gte('created_at', thirtySecondsAgo)
          if (assignedWorkspaceId) dedupQuery = dedupQuery.eq('entity_id', assignedWorkspaceId)
          else dedupQuery = dedupQuery.is('entity_id', null)
          const { data: existingTask } = await dedupQuery
          if (existingTask && existingTask.length > 0) {
            return { success: true, id: existingTask[0].id, type: 'task', title, deduplicated: true }
          }
        }

        const { todayStr, yesterdayStr } = getClientDateStrings(context)
        let finalStatus = status || 'todo'
        let finalDueDate = dueDate || null

        if (status === 'today') {
          finalStatus = 'todo'
          finalDueDate = todayStr
        } else if (status === 'overdue') {
          finalStatus = 'todo'
          finalDueDate = yesterdayStr
        }

        // Strict DB constraint validation
        if (finalStatus === 'in_progress') finalStatus = 'in-progress'
        if (!['todo', 'in-progress', 'done'].includes(finalStatus)) {
          finalStatus = 'todo'
        }

        const id = 'task-' + Date.now().toString()
        const { error } = await supabaseAdmin.from('tasks').insert({
          id,
          title,
          description: description || null,
          status: finalStatus,
          priority: priority || null,
          tag: tag && tag.toLowerCase() !== 'none' ? tag : null,
          due_date: finalDueDate,
          end_date: args.endDate || null,
          include_time: args.includeTime ?? null,
          reminder: args.reminder || null,
          subtasks: processSubtasks(subtasks),
          space_id: spaceId || null,
          entity_id: assignedWorkspaceId || null,
          owner_id: context.userId,
          completed: finalStatus === 'done',
          created_at: new Date().toISOString(),
          // last_modified drives both the UI's "last modified" display and the
          // LWW sync merge; the column defaults to 0 (epoch), which renders as
          // Jan 1 1970 and loses every merge against client state.
          last_modified: Date.now()
        })
        if (error) throw error
        return { success: true, id, type: 'task', title }
      }

      // --- WORKSPACE ---
      if (type === 'workspace') {
        const id = 'workspace-' + Date.now().toString()
        const { error } = await supabaseAdmin.from('entities').insert({
          id,
          title,
          type: 'workspace',
          space_id: spaceId || null,
          owner_id: context.userId,
          parent_id: null,
          last_modified: Date.now()
        })
        if (error) throw error
        return { success: true, id, type: 'workspace', title }
      }

      // --- NOTE / FOLDER ---
      if (type === 'note' || type === 'folder') {
        const id = (type === 'note' ? 'doc-' : 'folder-') + Date.now().toString()
        // The schema offers 'blocks' as an alternative to 'content' for notes,
        // so honor it — reading only 'content' silently persisted an empty body
        // whenever the model chose blocks, while still reporting success.
        const noteBody = type === 'note'
          ? (content ? parseMarkdownToBlocks(content) : normalizeBlocks((blocks as BlockInput[]) || []))
          : []
        if (type === 'note' && noteBody.length === 0) {
          logger.warn(`create_content: note "${title}" has an empty body (args: ${Object.keys(args).join(', ')})`)
        }
        const { error } = await supabaseAdmin.from('entities').insert({
          id,
          title,
          type,
          content: noteBody,
          space_id: spaceId || null,
          owner_id: context.userId,
          parent_id: parentId || null,
          last_modified: Date.now(),
          brain_only: type === 'note' && args.brain_only === true,
        })
        if (error) throw error
        // Echo the persisted blocks back: the client mirrors this result into its
        // local store via addEntity, which ALSO schedules a debounced upsert back
        // to Supabase (spec §5c) — without the real content here, that upsert
        // fires 1.5s later with content defaulted to [], silently overwriting the
        // note this handler just wrote with an empty body (live data-loss bug,
        // 2026-07-14: the tool call above persisted valid blocks correctly, but
        // the note read back empty because of this).
        return { success: true, id, type, title, content: noteBody }
      }
      return { error: `Unknown type '${type}'. Must be: note | folder | workspace | task` }
    } catch (e: any) {
      logger.error(`create_content tool failed: ${e.message}`)
      return { error: e.message }
    }
  },

  // ── UPDATE CONTENT ────────────────────────────────────────────────────────────
  async update_content(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage tasks and notes.' }
    }

    let { id, type, title, content, blocks, patch, assignedWorkspaceId,
            status, priority, tag, dueDate, endDate, includeTime, reminder, description, subtasks } = args

    if (!id) return { error: "'id' is required" }

    // §6d: strip leaked dynamicContext scaffolding before persisting.
    if (typeof title === 'string') title = sanitizeToolContent(title)
    if (typeof content === 'string') content = sanitizeToolContent(content)
    if (typeof description === 'string') description = sanitizeToolContent(description)
    if (Array.isArray(blocks)) blocks = sanitizeBlocks(blocks)

    try {
      const isTask = id.startsWith('task-') || type === 'task'

      if (isTask) {
        // --- UPDATE TASK ---
        const updates: any = {}
        if (title !== undefined) updates.title = title
        if (description !== undefined) updates.description = description
        if (status !== undefined) {
          if (status === 'today') {
            const { todayStr } = getClientDateStrings(context)
            updates.status = 'todo'
            updates.completed = false
            updates.due_date = todayStr
          } else if (status === 'overdue') {
            const { yesterdayStr } = getClientDateStrings(context)
            updates.status = 'todo'
            updates.completed = false
            updates.due_date = yesterdayStr
          } else if (['todo', 'in-progress', 'done'].includes(status)) {
            updates.status = status
            updates.completed = status === 'done'
          }
        }
        if (priority !== undefined) updates.priority = priority
        if (tag !== undefined) updates.tag = (tag && tag.toLowerCase() !== 'none') ? tag : null
        if (assignedWorkspaceId !== undefined) {
          updates.entity_id = assignedWorkspaceId || null;
        }
        if (dueDate !== undefined) updates.due_date = dueDate || null;
        if (endDate !== undefined) updates.end_date = endDate || null;
        if (includeTime !== undefined) updates.include_time = includeTime;
        if (reminder !== undefined) updates.reminder = reminder || null;
        if (subtasks !== undefined) updates.subtasks = processSubtasks(subtasks);
        updates.last_modified = Date.now()

        const { data, error } = await supabaseAdmin.from('tasks').update(updates).eq('id', id).eq('owner_id', context.userId).select('id, title')
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error(`Task with ID '${id}' not found or you do not have permission to edit it.`)
        }
        return { success: true, id, title: data[0].title, type: 'task' }
      } else {
        // --- UPDATE NOTE / CANVAS ---
        const updates: any = {}
        if (title !== undefined) updates.title = title

        if (content !== undefined || blocks !== undefined) {
          if (args.confirmed !== true) {
            const { data: existing } = await supabaseAdmin.from('entities').select('id, title, type').eq('id', id).eq('owner_id', context.userId).maybeSingle()
            if (!existing) throw new Error(`Note/Canvas with ID '${id}' not found or you do not have permission to edit it.`)
            if (context?.sessionId) {
              const { updateSessionState, getSessionState } = await import('../context')
              const sessionState = await getSessionState(context.sessionId)
              await updateSessionState(context.sessionId, {
                pending_action: { tool: 'update_content', args: { id, content, blocks }, dry_run_result: { id, title: existing.title, type: existing.type, replacing: true }, created_at: new Date().toISOString(), turn_seq: sessionState?.turn_seq }
              })
            }
            return {
              status: 'pending_confirmation',
              message: `DRY RUN ONLY. This would FULLY REPLACE the body of "${existing.title}". Confirm with the user before calling again with confirmed: true.`,
              item: { id, title: existing.title, type: existing.type }
            }
          }
          // Server-side confirmation gate — same reasoning as delete_content:
          // confirmed:true is only honored if it matches a dry-run this exact
          // session actually issued for this exact id, AND that confirmation
          // lands on the very next turn. See delete_content's comment for the
          // observed live failure this closes.
          {
            const { getSessionState } = await import('../context')
            const sessionState = context?.sessionId ? await getSessionState(context.sessionId) : null
            const pending = sessionState?.pending_action
            const idMatches = pending?.tool === 'update_content' && pending.args?.id === id && isPendingActionFresh(pending) && isPendingActionSameNextTurn(pending, sessionState?.turn_seq)
            if (!idMatches) {
              return { error: 'No matching pending confirmation found for this id. Call update_content without confirmed first to get a fresh dry-run, then confirm with the user before retrying.' }
            }
          }
          updates.content = content !== undefined
            ? parseMarkdownToBlocks(content)
            : normalizeBlocks((blocks as BlockInput[]) || [])
        } else if (Array.isArray(patch) && patch.length > 0) {
          if (patch.length > 20) return { error: 'patch supports at most 20 operations per call.' }
          const { data: existing, error: fetchErr } = await supabaseAdmin.from('entities')
            .select('content').eq('id', id).eq('owner_id', context.userId).single()
          if (fetchErr || !existing) {
            throw new Error(`Note/Canvas with ID '${id}' not found or you do not have permission to edit it.`)
          }
          const currentMd = blocksToMarkdown(existing.content || [])
          const patchedMd = applyPatchOps(currentMd, patch)
          updates.content = parseMarkdownToBlocks(patchedMd)
        }

        updates.last_modified = Date.now()
        const { data, error } = await supabaseAdmin.from('entities').update(updates).eq('id', id).eq('owner_id', context.userId).select('id, title, type')
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error(`Note/Canvas with ID '${id}' not found or you do not have permission to edit it.`)
        }
        if (context?.sessionId && args.confirmed === true) {
          const { updateSessionState } = await import('../context')
          await updateSessionState(context.sessionId, { pending_action: null })
        }
        // Echo the persisted content back (see create_content's comment on why
        // this matters) so the client's local mirror doesn't silently retain
        // stale pre-edit content when it later re-syncs.
        return { success: true, id, title: data[0].title, type: data[0].type, content: updates.content }
      }
    } catch (e: any) {
      logger.error('update_content failed:', e.message)
      return { error: e.message }
    }
  },

  // ── APPEND TO NOTE ────────────────────────────────────────────────────────────
  async append_to_note(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage tasks and notes.' }
    }

    const { id, content, blocks } = args
    if (!id) return { error: "'id' is required" }
    if (!content && !blocks) return { error: "'content' or 'blocks' is required" }

    try {
      const { data, error: fetchError } = await supabaseAdmin
        .from('entities')
        .select('content, title, type')
        .eq('id', id)
        .eq('owner_id', context.userId)
        .single()

      if (fetchError) throw fetchError

      let existingBlocks: any[] = []
      try {
        existingBlocks = data?.content
          ? (typeof data.content === 'string' ? JSON.parse(data.content) : data.content)
          : []
      } catch (_) {}

      const newBlocks = content
        ? parseMarkdownToBlocks(content)
        : normalizeBlocks(blocks as BlockInput[])

      const updatedBlocks = [...existingBlocks, ...newBlocks]

      const { error: updateError } = await supabaseAdmin
        .from('entities')
        .update({ content: updatedBlocks, last_modified: Date.now() })
        .eq('id', id)
        .eq('owner_id', context.userId)

      if (updateError) throw updateError
      // Echo just the newly-appended blocks (not the full body) — the client's
      // local mirror appends this to whatever it already has, same reasoning
      // as create_content's comment above.
      return { success: true, id, title: data.title, type: data.type, appendedCount: newBlocks.length, blocks: newBlocks }
    } catch (e: any) {
      logger.error('append_to_note failed:', e.message)
      return { error: e.message }
    }
  },

  // ── MOVE CONTENT ──────────────────────────────────────────────────────────────
  async move_content(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage tasks and notes.' }
    }

    const { id, parentId } = args
    if (!id) return { error: "'id' is required" }

    try {
      const { error } = await supabaseAdmin
        .from('entities')
        .update({ parent_id: parentId || null, last_modified: Date.now() })
        .eq('id', id)
        .eq('owner_id', context.userId)

      if (error) throw error
      return { success: true, id, movedTo: parentId || 'unsorted' }
    } catch (e: any) {
      logger.error('move_content failed:', e.message)
      return { error: e.message }
    }
  },

  // ── DELETE CONTENT ────────────────────────────────────────────────────────────
  async delete_content(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage content.' }
    }

    const { ids, confirmed } = args
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { error: "'ids' array is required" }
    }

    const { updateSessionState, getSessionState } = await import('../context')

    // Server-side confirmation gate: confirmed:true is only honored if it
    // matches a dry-run this exact session actually issued for these exact
    // ids, AND that confirmation lands on the very next turn (deterministic
    // — a turn-count expiry, not wall-clock). Without this, a model can skip
    // the dry-run entirely and call delete_content({ ids, confirmed: true })
    // as its first and only call — observed live: the model re-derived a
    // stale "yes" as "delete this" from raw history and executed with no dry-run
    // in that confirmation cycle at all. Trusting confirmed:true alone was
    // not enough; the id-match check alone was not enough either (a stale
    // pending_action several turns old could still match by luck) — the
    // turn_seq check closes that gap deterministically.
    if (confirmed === true) {
      const sessionState = context?.sessionId ? await getSessionState(context.sessionId) : null
      const pending = sessionState?.pending_action
      const idsMatch = pending?.tool === 'delete_content'
        && Array.isArray(pending.args?.ids)
        && pending.args.ids.length === ids.length
        && pending.args.ids.every((id: string) => ids.includes(id))
        && isPendingActionFresh(pending)
        && isPendingActionSameNextTurn(pending, sessionState?.turn_seq)
      if (!idsMatch) {
        return { error: 'No matching pending confirmation found for these ids. Call delete_content without confirmed first to get a fresh dry-run, then confirm with the user before retrying.' }
      }
    }

    try {
      const results: any[] = []

      // If not explicitly confirmed, do a dry run and fetch titles
      if (confirmed !== true) {
        for (const id of ids) {
          if (id.startsWith('task-')) {
            const { data } = await supabaseAdmin.from('tasks').select('id, title').eq('id', id).eq('owner_id', context.userId).single()
            if (data) results.push({ id, title: data.title, type: 'task' })
          } else {
            const { data: entity } = await supabaseAdmin.from('entities').select('id, title, type').eq('id', id).eq('owner_id', context.userId).maybeSingle()
            if (entity) {
              results.push({ id, title: entity.title, type: entity.type })
            } else {
              // canvas block fallback, no title
              results.push({ id, title: 'Canvas Block', type: 'canvas_block' })
            }
          }
        }
        if (context?.sessionId) {
          const sessionState = await getSessionState(context.sessionId)
          await updateSessionState(context.sessionId, {
            pending_action: { tool: 'delete_content', args: { ids }, dry_run_result: results, created_at: new Date().toISOString(), turn_seq: sessionState?.turn_seq }
          })
        }
        return {
          status: 'pending_confirmation',
          message: 'DRY RUN ONLY. Present these items to the user and ask for EXPLICIT confirmation. Call this tool again with confirmed: true and the SAME ids ONLY if they say yes.',
          items_to_delete: results
        }
      }

      for (const id of ids) {
        if (id.startsWith('task-')) {
          // Delete task from tasks table
          const { error } = await supabaseAdmin
            .from('tasks')
            .delete()
            .eq('id', id)
            .eq('owner_id', context.userId)

          results.push({ id, type: 'task', success: !error, error: error?.message })
          continue
        }

        // Entity (note/folder/canvas) or canvas block.
        // Check entities table first (owner-scoped).
        const { data: entity, error: lookupErr } = await supabaseAdmin
          .from('entities')
          .select('id, type')
          .eq('id', id)
          .eq('owner_id', context.userId)
          .maybeSingle()

        if (entity) {
          const { error } = await supabaseAdmin
            .from('entities')
            .delete()
            .eq('id', id)
            .eq('owner_id', context.userId)
          results.push({
            id,
            type: entity.type,
            success: !error,
            error: error?.message,
            cascade: entity.type === 'folder'
          })
        } else {
          // Try canvas_blocks table
          const { error } = await supabaseAdmin
            .from('canvas_blocks')
            .delete()
            .eq('id', id)
            .eq('user_id', context.userId)
          results.push({ id, type: 'canvas_block', success: !error, error: error?.message })
        }
      }

      if (context?.sessionId) {
        await updateSessionState(context.sessionId, { pending_action: null })
      }
      return { success: true, deleted: results.filter(r => r.success).length, items: results }
    } catch (e: any) {
      logger.error('delete_content failed:', e.message)
      return { error: e.message }
    }
  },

  // ── LIST CONTENT ──────────────────────────────────────────────────────────────
  async list_content(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage tasks and notes.' }
    }

    try {
      const spaceId = await resolveSpaceId(context)

      const types: string[] = args.types || ['workspace', 'folder', 'note', 'canvas', 'task']
      const readContent = args.readContent === true
      const actualLimit = readContent
        ? Math.min(args.limit || 10, 10)
        : Math.min(args.limit || 100, 100)

      let rawResults: any[] = []

      // 1. Fetch Entities (workspace, folder, note, canvas)
      const entityTypes = types.filter((t) => ['workspace', 'folder', 'note', 'canvas'].includes(t))
      if (entityTypes.length > 0) {
        let query = supabaseAdmin
          .from('entities')
          .select(readContent
            ? 'id, title, type, content, parent_id, last_modified'
            : 'id, title, type, parent_id, last_modified')
          .eq('owner_id', context.userId)
          .in('type', entityTypes)
          .eq('brain_only', false)

        // Only filter by spaceId if spaceId is provided AND we are not explicitly ONLY searching for workspaces
        if (spaceId && !entityTypes.every(t => t === 'workspace')) {
           // Wait, if it's a mix (e.g. note and workspace), filtering by spaceId will exclude root workspaces.
           // Let's use an OR condition if we are searching for workspaces.
           if (entityTypes.includes('workspace')) {
             query = query.or(`space_id.eq.${spaceId},type.eq.workspace`)
           } else {
             query = query.eq('space_id', spaceId)
           }
        }

        if (args.parentId) query = query.eq('parent_id', args.parentId)
        if (args.searchQuery) query = query.ilike('title', `%${args.searchQuery}%`)
        if (args.ids && Array.isArray(args.ids) && args.ids.length > 0) query = query.in('id', args.ids)

        const { data: entityData, error: eError } = await query
        if (eError) throw eError
        if (entityData) rawResults.push(...entityData)
      }

      // 2. Fetch Tasks
      if (types.includes('task')) {
        let query = supabaseAdmin
          .from('tasks')
          .select(readContent
            ? 'id, title, status, priority, tag, due_date, end_date, description, subtasks, reminder, attachments, entity_id, created_at'
            : 'id, title, status, priority, tag, due_date, end_date, description, subtasks, reminder, entity_id, created_at')
          .eq('owner_id', context.userId)
        
        if (spaceId) {
          query = query.eq('space_id', spaceId)
        }

        if (args.assignedWorkspaceId) query = query.eq('entity_id', args.assignedWorkspaceId)
        if (args.searchQuery) query = query.ilike('title', `%${args.searchQuery}%`)
        if (args.ids && Array.isArray(args.ids) && args.ids.length > 0) query = query.in('id', args.ids)

        if (args.taskFilters) {
          const tf = args.taskFilters
          if (tf.status) query = query.eq('status', tf.status)
          if (tf.priority) query = query.eq('priority', tf.priority)
          if (tf.tag) query = query.eq('tag', tf.tag)
          if (tf.dueDate) {
            if (tf.dueDate.toLowerCase() === 'overdue') {
              query = query.lt('due_date', new Date().toISOString())
            } else {
              query = query.eq('due_date', tf.dueDate)
            }
          }
          if (tf.dueAfter) query = query.gte('due_date', tf.dueAfter)
          if (tf.dueBefore) query = query.lte('due_date', tf.dueBefore)
        }

        const { data: taskData, error: tError } = await query
        if (tError) throw tError

        if (taskData) {
          let todayStr = new Date().toISOString().split('T')[0]
          if (context?.clientTime) {
            const match = context.clientTime.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{4})/)
            if (match) {
              const months: Record<string, string> = { Jan:'01', Feb:'02', Mar:'03', Apr:'04', May:'05', Jun:'06', Jul:'07', Aug:'08', Sep:'09', Oct:'10', Nov:'11', Dec:'12' }
              const d = match[2].padStart(2, '0')
              todayStr = `${match[3]}-${months[match[1]]}-${d}`
            }
          }
          const formatted = taskData.map((t: any) => {
            let display_status = t.status || 'todo'
            if (t.status !== 'done' && t.due_date) {
               const dueDateStr = t.due_date.split('T')[0]
               if (dueDateStr < todayStr) {
                 display_status = 'overdue'
               } else if (dueDateStr === todayStr) {
                 display_status = 'today'
               }
            }

            return {
              ...t,
              display_status,
              type: 'task',
              assignedWorkspaceId: t.entity_id,
              last_modified: new Date(t.created_at).getTime(),
              attachmentCount: Array.isArray(t.attachments) ? t.attachments.length : 0
            }
          })
          // Remove raw attachments array from task results (count is enough)
          formatted.forEach((t: any) => delete t.attachments)
          rawResults.push(...formatted)

          // Resolve workspace titles server-side (batch query)
          const wsIds = [...new Set(formatted.map((t: any) => t.entity_id).filter(Boolean))]
          if (wsIds.length > 0) {
            const { data: workspaces } = await supabaseAdmin
              .from('entities')
              .select('id, title')
              .in('id', wsIds)
            if (workspaces) {
              const titleMap = Object.fromEntries(workspaces.map((w: any) => [w.id, w.title]))
              formatted.forEach((t: any) => {
                t.workspaceTitle = t.entity_id ? titleMap[t.entity_id] || null : null
              })
            }
          }
        }
      }

      // 3. Sort
      if (args.sortBy === 'alphabetical') {
        rawResults.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      } else if (args.sortBy === 'dueDate') {
        rawResults.sort((a, b) => {
          const dA = a.due_date ? new Date(a.due_date).getTime() : Infinity
          const dB = b.due_date ? new Date(b.due_date).getTime() : Infinity
          return dA - dB
        })
      } else {
        rawResults.sort((a, b) => (b.last_modified || 0) - (a.last_modified || 0))
      }

      rawResults = rawResults.slice(0, actualLimit)

      // 4. Dynamic Payload Truncation (100k chars ~ 33k tokens)
      let runningLength = 0
      const MAX_CHARS = 100000

      const processedResults = rawResults.map((item: any) => {
        let itemString = JSON.stringify(item)
        if (runningLength + itemString.length > MAX_CHARS) {
          if (item.content) item.content = '[TRUNCATED_DUE_TO_SIZE]'
          if (item.description) item.description = '[TRUNCATED_DUE_TO_SIZE]'
          if (item.subtasks) item.subtasks = '[TRUNCATED_DUE_TO_SIZE]'
          itemString = JSON.stringify(item)
        }
        runningLength += itemString.length

        if (item.type === 'task') delete item.last_modified
        return item
      })
      return { success: true, count: processedResults.length, items: processedResults }
    } catch (e: any) {
      logger.error('list_content failed:', e.message)
      return { error: e.message }
    }
  },

  // ── READ URL ──────────────────────────────────────────────────────────────────
  async read_url(args: any, context: any) {
    const { url, startTime, endTime, lang } = args;
    if (!url) return { error: "'url' is required" };

    try {
      if (isYouTubeUrl(url)) {
        if (context && context._youtubeFetchCount) {
          return { error: 'YouTube fetch limit reached: only 1 YouTube video can be fetched per request. Ask the user to send additional videos in a separate message.' };
        }
        if (context) context._youtubeFetchCount = 1;

        const ytPage = await extractYoutubeTranscript(url, {
          startTime: startTime !== undefined ? Number(startTime) : undefined,
          endTime: endTime !== undefined ? Number(endTime) : undefined,
          lang: lang || undefined,
        });
        if (ytPage) {
          return { success: true, url, content: ytPage.content };
        }
        return { error: 'Failed to extract YouTube transcript. The video might not have captions enabled.' };
      }

      // Non-YouTube URL: use existing Exa → Tavily → fetch pipeline
      const webPages = await extractContent([url], context);
      if (webPages && webPages.length > 0 && webPages[0].content) {
        return { success: true, url, content: webPages[0].content };
      }
      return { error: 'Failed to extract readable text from the URL.' };
    } catch (e: any) {
      logger.error('read_url failed:', e.message);
      return { error: e.message };
    }
  },

  // ── MANAGE BRAIN ──────────────────────────────────────────────────────────────
  async manage_brain(args: any, context: any) {
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage the brain.' }
    }
    const {
      op, type, ref_id, content, label, section_id, priority, pinned, enabled,
      node_id, node_ids, from, to, edge_label, edge_id, confirmed,
    } = args

    const VALID_OPS = ['add_node', 'update_node', 'remove_node', 'connect', 'disconnect', 'list', 'refresh']
    if (!VALID_OPS.includes(op)) {
      return { error: `Unknown op '${op}'. Valid: ${VALID_OPS.join(', ')}.` }
    }
    let removeIds: string[] = []
    if (op === 'remove_node') {
      removeIds = Array.isArray(node_ids) && node_ids.length > 0 ? node_ids : (node_id ? [node_id] : [])
      if (removeIds.length === 0) return { error: "'node_id' or 'node_ids' is required for remove_node" }
    }
    if (op === 'connect' && (!from || !to || !edge_label)) {
      return { error: "'from', 'to' and 'edge_label' are required for connect" }
    }

    // A multi-id remove always needs confirmation — no DB read required to
    // know that. If confirmed:true is already claimed, check it against the
    // stored pending_action BEFORE any DB call: the whole point of the §6b
    // gate is that a bare confirmed:true is never trusted without a matching
    // prior dry-run, and that check must not be reachable-but-skipped by an
    // earlier DB-availability short-circuit.
    if (op === 'remove_node' && removeIds.length > 1 && confirmed === true) {
      const { getSessionState, updateSessionState } = await import('../context')
      const sessionState = context?.sessionId ? await getSessionState(context.sessionId) : null
      const pending = sessionState?.pending_action
      const idsMatch = pending?.tool === 'manage_brain'
        && Array.isArray(pending.args?.ids)
        && pending.args.ids.length === removeIds.length
        && pending.args.ids.every((id: string) => removeIds.includes(id))
        && isPendingActionFresh(pending)
        && isPendingActionSameNextTurn(pending, sessionState?.turn_seq)
      if (!idsMatch) {
        return { error: 'No matching pending confirmation found for these brain nodes. Call remove_node without confirmed first to get a fresh dry-run, then confirm with the user before retrying.' }
      }
      if (!supabaseAdmin) return { error: 'Supabase not configured' }
      const brain = await import('../services/brainStore')
      const brainId = sessionState?.active_brain_id || (await brain.getOrCreateDefaultBrain(context.userId)).id
      const res = await brain.removeBrainNodes(context.userId, 'bot', brainId, removeIds)
      if (context?.sessionId) await updateSessionState(context.sessionId, { pending_action: null })
      return res
    }

    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    const brain = await import('../services/brainStore')
    const userId = context.userId as string
    // manage_brain deliberately has NO brain_id parameter (spec §4, owner
    // decision) — it always targets the session's active brain, resolved
    // the same way chainRouter resolves it for prompt injection: explicit
    // active_brain_id on the session if set, else lazily get-or-create the
    // user's default "Main" brain.
    const { getSessionState } = await import('../context')
    const sessState = context?.sessionId ? await getSessionState(context.sessionId) : null
    const brainId = sessState?.active_brain_id || (await brain.getOrCreateDefaultBrain(userId)).id

    try {
      switch (op) {
        case 'list': {
          const state = await brain.listBrain(userId, brainId)
          return {
            success: true,
            budget: state.budget,
            nodes: state.nodes.map(n => ({
              id: n.id, type: n.type, label: n.label, ref_id: n.ref_id,
              content: n.content, section_id: n.section_id, priority: n.priority,
              pinned: n.pinned, enabled: n.enabled,
              dropped: state.budget.dropped.includes(n.id),
              broken: state.budget.broken.includes(n.id),
            })),
            edges: state.edges.map(e => ({ id: e.id, from: e.from_node, to: e.to_node, label: e.label })),
          }
        }
        case 'add_node': {
          if (!type) return { error: "'type' is required for add_node" }
          const res = await brain.addBrainNode(userId, 'bot', brainId, {
            type, ref_id, content: content ? sanitizeToolContent(content) : undefined,
            label: label ? sanitizeToolContent(label) : undefined, section_id, priority, pinned,
            active_from: args.active_from ?? null,
            active_until: args.active_until ?? null,
            tag_color: args.tag_color ?? null,
            tag_name: args.tag_name ?? null,
          })
          if ('error' in res) return res
          return { success: true, id: res.id, op: 'add_node', type, label: label ?? null }
        }
        case 'update_node': {
          if (!node_id) return { error: "'node_id' is required for update_node" }
          const updates: any = {}
          if (content !== undefined) updates.content = sanitizeToolContent(content)
          if (label !== undefined) updates.label = sanitizeToolContent(label)
          if (section_id !== undefined) updates.section_id = section_id
          if (priority !== undefined) updates.priority = priority
          if (pinned !== undefined) updates.pinned = pinned
          if (enabled !== undefined) updates.enabled = enabled
          if (args.active_from !== undefined) updates.active_from = args.active_from
          if (args.active_until !== undefined) updates.active_until = args.active_until
          if (args.tag_color !== undefined) updates.tag_color = args.tag_color
          if (args.tag_name !== undefined) updates.tag_name = args.tag_name
          return await brain.updateBrainNode(userId, 'bot', brainId, node_id, updates)
        }
        case 'remove_node': {
          // The multi-id + confirmed:true path is handled above, before any
          // DB call, so it can never be bypassed by a Supabase-availability
          // short-circuit. What remains here: multi-id dry-run (no confirmed
          // yet), and single-id removes (which still need a DB check because
          // a lone section also requires confirmation).
          const ids = removeIds

          // Is a section among the targets? Sections and multi-removes are
          // destructive enough for the §6b dry-run → next-turn-confirm gate.
          const { data: targets } = await supabaseAdmin.from('brain_nodes')
            .select('id, type, label').in('id', ids).eq('user_id', userId).eq('brain_id', brainId).is('deleted_at', null)
          const needsConfirmation = ids.length > 1 || (targets ?? []).some((t: any) => t.type === 'section')

          if (needsConfirmation && confirmed !== true) {
            if (context?.sessionId) {
              const { updateSessionState, getSessionState } = await import('../context')
              const sessionState = await getSessionState(context.sessionId)
              await updateSessionState(context.sessionId, {
                pending_action: {
                  tool: 'manage_brain', args: { op: 'remove_node', ids },
                  dry_run_result: { ids, titles: (targets ?? []).map((t: any) => t.label ?? t.id) },
                  created_at: new Date().toISOString(), turn_seq: sessionState?.turn_seq,
                },
              })
            }
            return {
              status: 'pending_confirmation',
              message: `DRY RUN ONLY. This would remove ${ids.length} brain node(s): ${(targets ?? []).map((t: any) => t.label ?? t.id).join(', ')}. Confirm with the user before calling again with confirmed: true.`,
            }
          }
          if (needsConfirmation && confirmed === true) {
            const { getSessionState, updateSessionState } = await import('../context')
            const sessionState = context?.sessionId ? await getSessionState(context.sessionId) : null
            const pending = sessionState?.pending_action
            const idsMatch = pending?.tool === 'manage_brain'
              && Array.isArray(pending.args?.ids)
              && pending.args.ids.length === ids.length
              && pending.args.ids.every((id: string) => ids.includes(id))
              && isPendingActionFresh(pending)
              && isPendingActionSameNextTurn(pending, sessionState?.turn_seq)
            if (!idsMatch) {
              return { error: 'No matching pending confirmation found for these brain nodes. Call remove_node without confirmed first to get a fresh dry-run, then confirm with the user before retrying.' }
            }
            const res = await brain.removeBrainNodes(userId, 'bot', brainId, ids)
            if (context?.sessionId) await updateSessionState(context.sessionId, { pending_action: null })
            return res
          }
          return await brain.removeBrainNodes(userId, 'bot', brainId, ids)
        }
        case 'connect': {
          if (!from || !to || !edge_label) return { error: "'from', 'to' and 'edge_label' are required for connect" }
          const res = await brain.addBrainEdge(userId, 'bot', brainId, from, to, sanitizeToolContent(edge_label))
          if ('error' in res) return res
          return { success: true, id: res.id, op: 'connect' }
        }
        case 'disconnect': {
          if (!edge_id) return { error: "'edge_id' is required for disconnect" }
          return await brain.removeBrainEdge(userId, 'bot', brainId, edge_id)
        }
        case 'refresh': {
          const compiled = await brain.compileBrain(userId, brainId)
          if (context?.sessionId) {
            const { updateSessionState } = await import('../context')
            await updateSessionState(context.sessionId, { pinned_brain_version: compiled.version } as any)
          }
          return { success: true, version: compiled.version, tokenCount: compiled.tokenCount }
        }
        default:
          return { error: `Unknown op '${op}'. Valid: add_node, update_node, remove_node, connect, disconnect, list, refresh.` }
      }
    } catch (e: any) {
      logger.error(`manage_brain tool failed: ${e.message}`)
      return { error: e.message }
    }
  }
}
