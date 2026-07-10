import { logger } from '../../logger'
import { supabaseAdmin } from '../../supabase'
import { parseMarkdownToBlocks, normalizeBlocks } from '../../editor/markdownBlocks'
import type { BlockInput } from '../../editor/markdownBlocks'

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

      // --- NOTE / FOLDER ---
      if (type === 'note' || type === 'folder') {
        const id = (type === 'note' ? 'doc-' : 'folder-') + Date.now().toString()
        const { error } = await supabaseAdmin.from('entities').insert({
          id,
          title,
          type,
          content: type === 'note' ? parseMarkdownToBlocks(content || '') : [],
          space_id: spaceId || null,
          owner_id: context.userId,
          parent_id: parentId || null
        })
        if (error) throw error
        return { success: true, id, type, title }
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

    const { id, type, title, content, blocks, assignedWorkspaceId,
            status, priority, tag, dueDate, endDate, includeTime, reminder, description, subtasks } = args

    if (!id) return { error: "'id' is required" }

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

        const { data, error } = await supabaseAdmin.from('tasks').update(updates).eq('id', id).eq('owner_id', context.userId).select('id')
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error(`Task with ID '${id}' not found or you do not have permission to edit it.`)
        }
        return { success: true, id }
      } else {
        // --- UPDATE NOTE / CANVAS ---
        const updates: any = {}
        if (title !== undefined) updates.title = title
        if (content !== undefined) updates.content = parseMarkdownToBlocks(content)
        else if (blocks !== undefined) updates.content = blocks

        const { data, error } = await supabaseAdmin.from('entities').update(updates).eq('id', id).eq('owner_id', context.userId).select('id')
        if (error) throw error
        if (!data || data.length === 0) {
          throw new Error(`Note/Canvas with ID '${id}' not found or you do not have permission to edit it.`)
        }
        return { success: true, id }
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

  // ── DELETE CONTENT ────────────────────────────────────────────────────────────
  async delete_content(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage content.' }
    }

    const { ids } = args
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return { error: "'ids' array is required" }
    }

    try {
      const results: any[] = []

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
  },

  // ── MANAGE MEMORY ─────────────────────────────────────────────────────────────
  async manage_memory(args: any, context: any) {
    if (!supabaseAdmin) return { error: 'Supabase not configured' }
    if (isUserAnonymous(context)) {
      return { error: 'You are currently using Flowr in anonymous mode. Please log in to manage memories.' }
    }

    const { action, id, title, content } = args

    if (!action) return { error: "'action' is required (add | update | delete)" }

    try {
      if (action === 'add') {
        if (!title || !content) return { error: "'title' and 'content' are required for add" }
        
        // Check cap
        const { count, error: countError } = await supabaseAdmin
          .from('bot_memories')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', context.userId)
        
        if (countError) throw countError
        if (count && count >= 20) {
          return { error: 'Hard cap of 20 memories reached. You must delete an old memory before adding a new one.' }
        }

        const { data, error } = await supabaseAdmin.from('bot_memories').insert({
          user_id: context.userId,
          title,
          content
        }).select('id').single()
        
        if (error) throw error
        return { success: true, id: data.id, action: 'add', title, content }
      } 
      else if (action === 'update') {
        if (!id) return { error: "'id' is required for update" }
        const updates: any = { updated_at: new Date().toISOString() }
        if (title !== undefined) updates.title = title
        if (content !== undefined) updates.content = content
        
        const { error } = await supabaseAdmin
          .from('bot_memories')
          .update(updates)
          .eq('id', id)
          .eq('user_id', context.userId)
        
        if (error) throw error
        return { success: true, id, action: 'update', title, content }
      }
      else if (action === 'delete') {
        if (!id) return { error: "'id' is required for delete" }
        
        // Get title before delete for the artifact
        const { data } = await supabaseAdmin.from('bot_memories').select('title').eq('id', id).single()
        const deletedTitle = data?.title || 'Unknown'

        const { error } = await supabaseAdmin
          .from('bot_memories')
          .delete()
          .eq('id', id)
          .eq('user_id', context.userId)
          
        if (error) throw error
        return { success: true, id, action: 'delete', title: deletedTitle }
      }
      
      return { error: `Unknown action '${action}'` }
    } catch (e: any) {
      logger.error(`manage_memory tool failed: ${e.message}`)
      return { error: e.message }
    }
  }
}
