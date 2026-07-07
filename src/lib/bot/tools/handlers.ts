import { logger } from '../../logger'
import { supabaseAdmin } from '../../supabase'
import { parseMarkdownToBlocks, normalizeBlocks } from '../../editor/markdownBlocks'
import type { BlockInput } from '../../editor/markdownBlocks'

// Helper: resolve active space ID for a user
async function resolveSpaceId(context: any): Promise<string | null> {
  let spaceId = context?.activeSpaceId || null
  if (context?.userId && context.userId !== 'anonymous') {
    const { data: user } = await supabaseAdmin!
      .from('profiles')
      .select('active_space_id')
      .eq('id', context.userId)
      .single()
    if (user?.active_space_id) spaceId = user.active_space_id
  }
  return spaceId
}

// Helper: check if user is anonymous or has invalid UUID
function isUserAnonymous(context: any): boolean {
  if (!context?.userId || context.userId === 'anonymous') return true
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(context.userId)
  return !isUuid
}

// Helper: parse content to blocks JSON string
function contentToBlocks(content?: string, blocks?: BlockInput[]): any {
  if (content) return parseMarkdownToBlocks(content)
  if (blocks) return blocks
  return []
}

export const toolHandlers: Record<string, (args: any, context?: any) => Promise<any>> = {

  // ── CREATE CONTENT ────────────────────────────────────────────────────────────
  async create_content(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage tasks and notes.' }
    }

    const { type, title, content, blocks, parentId, assignedWorkspaceId,
            status, priority, tag, dueDate, description, subtasks } = args

    if (!type) return { error: "'type' is required (note | folder | workspace | task)" }
    if (!title) return { error: "'title' is required" }

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
        const id = 'task-' + Date.now().toString()
        const { error } = await supabaseAdmin.from('tasks').insert({
          id,
          title,
          description: description || null,
          status: status || 'todo',
          priority: priority || null,
          tag: tag || null,
          due_date: dueDate || null,
          end_date: args.endDate || null,
          include_time: args.includeTime ?? null,
          reminder: args.reminder || null,
          subtasks: subtasks || null,
          space_id: spaceId || null,
          entity_id: assignedWorkspaceId || null,
          owner_id: context.userId,
          completed: status === 'done',
          created_at: new Date().toISOString()
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
          parent_id: null
        })
        if (error) throw error
        return { success: true, id, type: 'workspace', title }
      }

      // --- FOLDER ---
      if (type === 'folder') {
        if (!parentId) return { error: 'Folders must have a parentId (workspace or folder). Folders cannot be unsorted.' }
        const id = 'folder-' + Date.now().toString()
        const { error } = await supabaseAdmin.from('entities').insert({
          id,
          title,
          type: 'folder',
          space_id: spaceId || null,
          owner_id: context.userId,
          parent_id: parentId
        })
        if (error) throw error
        return { success: true, id, type: 'folder', title, parentId }
      }

      // --- NOTE ---
      if (type === 'note') {
        const id = 'doc-' + Date.now().toString()
        const { error } = await supabaseAdmin.from('entities').insert({
          id,
          title,
          type: 'note',
          content: contentToBlocks(content, blocks),
          space_id: spaceId || null,
          owner_id: context.userId,
          parent_id: parentId || null
        })
        if (error) throw error
        return { success: true, id, type: 'note', title }
      }

      return { error: `Unknown type '${type}'. Must be: note | folder | workspace | task` }
    } catch (e: any) {
      logger.error('create_content failed:', e.message)
      return { error: e.message }
    }
  },

  // ── UPDATE CONTENT ────────────────────────────────────────────────────────────
  async update_content(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage tasks and notes.' }
    }

    const { id, title, content, blocks, assignedWorkspaceId,
            status, priority, tag, dueDate, endDate, includeTime, reminder, description, subtasks } = args

    if (!id) return { error: "'id' is required" }

    try {
      const isTask = id.startsWith('task-')

      if (isTask) {
        // --- UPDATE TASK ---
        const updates: any = {}
        if (title !== undefined) updates.title = title
        if (description !== undefined) updates.description = description
        if (status !== undefined) {
          updates.status = status
          updates.completed = status === 'done'
        }
        if (priority !== undefined) updates.priority = priority
        if (tag !== undefined) updates.tag = tag
        if (assignedWorkspaceId !== undefined) {
          updates.entity_id = assignedWorkspaceId || null;
        }
        if (dueDate !== undefined) updates.due_date = dueDate || null;
        if (endDate !== undefined) updates.end_date = endDate || null;
        if (includeTime !== undefined) updates.include_time = includeTime;
        if (reminder !== undefined) updates.reminder = reminder || null;
        if (subtasks !== undefined) updates.subtasks = subtasks;

        const { error } = await supabaseAdmin.from('tasks').update(updates).eq('id', id).eq('owner_id', context.userId)
        if (error) throw error
        return { success: true, id, ...updates }
      } else {
        // --- UPDATE NOTE / CANVAS ---
        const updates: any = {}
        if (title !== undefined) updates.title = title
        if (content !== undefined) updates.content = parseMarkdownToBlocks(content)
        else if (blocks !== undefined) updates.content = blocks

        const { error } = await supabaseAdmin.from('entities').update(updates).eq('id', id).eq('owner_id', context.userId)
        if (error) throw error
        return { success: true, id, ...updates }
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
        .select('content')
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
        .update({ content: updatedBlocks })
        .eq('id', id)
        .eq('owner_id', context.userId)

      if (updateError) throw updateError
      return { success: true, id, appendedCount: newBlocks.length }
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
        .update({ parent_id: parentId || null })
        .eq('id', id)
        .eq('owner_id', context.userId)

      if (error) throw error
      return { success: true, id, movedTo: parentId || 'unsorted' }
    } catch (e: any) {
      logger.error('move_content failed:', e.message)
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

        const { data: entityData, error: eError } = await query
        if (eError) throw eError
        if (entityData) rawResults.push(...entityData)
      }

      // 2. Fetch Tasks
      if (types.includes('task')) {
        let query = supabaseAdmin
          .from('tasks')
          .select(readContent
            ? '*'
            : 'id, title, status, priority, due_date, tag, space_id, entity_id, created_at')
          .eq('owner_id', context.userId)
        
        if (spaceId) {
          query = query.eq('space_id', spaceId)
        }

        if (args.assignedWorkspaceId) query = query.eq('entity_id', args.assignedWorkspaceId)
        if (args.searchQuery) query = query.ilike('title', `%${args.searchQuery}%`)

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
        }

        const { data: taskData, error: tError } = await query
        if (tError) throw tError

        if (taskData) {
          const formatted = taskData.map((t: any) => ({
            ...t,
            type: 'task',
            assignedWorkspaceId: t.entity_id,
            last_modified: new Date(t.created_at).getTime()
          }))
          rawResults.push(...formatted)
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

      // 4. Dynamic Payload Truncation (40k chars ~ 13k tokens)
      let runningLength = 0
      const MAX_CHARS = 40000

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
  }
}
