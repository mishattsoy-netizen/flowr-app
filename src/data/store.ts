import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  upsertEntity,
  deleteEntityFromDB,
  upsertTask,
  deleteTaskFromDB,
  clearAllDataFromCloud,
  upsertWorkspace
} from '@/lib/sync';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import {
  fetchConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation as deleteConversationFromDB,
  fetchMessages,
  insertMessage,
} from '@/lib/chat';
import type { ChatConversation } from '@/lib/chat';

// Re-export all types so all consumers import paths remain valid
export type {
  EntityType, BlockStyle, BlockType, EmbedDisplayMode, DatabaseViewType,
  DatabaseColumnType, DatabaseColumn, DatabaseRow, EditorBlock,
  WidgetType, WidgetSize, WidgetConfig, Entity, AppTask, SettingsTab, ModalType,
  EditingSource, AIAttachment, AIMessage, AICursor, ModelStatus,
  PriorityModel, ProjectQuota, FlowIntentCategory, FlowRouterModel,
  FlowRouterCategory, FlowRouterConfig, CloudModel, AIRequestLog, AppState,
  WorkspaceType, Workspace, SidebarSectionId, SidebarSectionSettings, SortMode,
  BotMode, ShapeKind, CanvasStyleExt,
} from './store.types';

// Re-export helpers needed by external consumers
export { generateId, robustParseJSON, blocksToMarkdown } from './store.helpers';

// Internal type imports (used within this file's store implementation)
import type {
  Entity, EditorBlock, AIMessage,
  AppState, Workspace, WidgetConfig, AppTask, BotMode,
} from './store.types';


import {
  generateId, getDescendantIds, validateNoteContent,
  robustParseJSON, markdownToBlocks, blocksToMarkdown
} from './store.helpers';


// ─── Store ─────── (types/constants/helpers moved to store.types.ts / store.constants.ts / store.helpers.ts) ───

const oneDayMs = 24 * 60 * 60 * 1000;
const initialTime = Date.now();

const DEFAULT_DASHBOARD_LAYOUT: WidgetConfig[] = [
  { id: 'w-upcoming', type: 'upcoming-tasks', size: 'M' },
  { id: 'w-overdue', type: 'overdue-tasks', size: 'M' },
  { id: 'w-inbox', type: 'inbox-tasks', size: 'M' },
  { id: 'w-pinned', type: 'pinned', size: 'L' },
  { id: 'w-recent', type: 'recent', size: 'L' },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      entities: [
        { id: 'c1', title: 'Collection 1', type: 'collection', parentId: null, lastModified: initialTime, icon: 'Folder', workspaceId: 'ws-personal' },
        { id: 'c2', title: 'Collection 2', type: 'collection', parentId: null, lastModified: initialTime - oneDayMs * 2, icon: 'Briefcase', workspaceId: 'ws-personal' },
        { id: 'f1', title: 'Folder 1', type: 'folder', parentId: 'c1', lastModified: initialTime - oneDayMs, workspaceId: 'ws-personal' },
        { id: 'cv1', title: 'Canvas 1', type: 'canvas', parentId: 'f1', lastModified: initialTime - 500000, workspaceId: 'ws-personal' },
        { id: 'n1', title: 'Notes 1', type: 'note', parentId: 'c2', lastModified: initialTime - 100000, tags: ['research', 'draft'], workspaceId: 'ws-personal' },
        { id: 'm1', title: 'Mixed 1', type: 'mixed', parentId: 'c1', lastModified: initialTime, workspaceId: 'ws-personal' },
      ],

      tasks: [
        { id: 't1', title: 'Review mockups', completed: false, dueDate: new Date(Date.now() - oneDayMs).toISOString().split('T')[0], entityId: 'cv1', color: '#EF4444', workspaceId: 'ws-personal' },
        { id: 't2', title: 'Outline next week', completed: true, dueDate: new Date().toISOString().split('T')[0], entityId: 'n1', workspaceId: 'ws-personal' },
        { id: 't3', title: 'Design review meeting', completed: false, dueDate: new Date(Date.now() + oneDayMs).toISOString().split('T')[0], entityId: null, color: '#3B82F6', workspaceId: 'ws-personal' },
        { id: 't4', title: 'Prepare assets', completed: false, dueDate: new Date().toISOString().split('T')[0], entityId: null, workspaceId: 'ws-personal' },
      ],

      blocks: [
        { id: 'b1', type: 'text', content: 'Explore unified navigation.', x: 100, y: 100, canvasId: 'cv1' },
      ],

      lifeHabits: [],
      lifeHabitChecks: [],
      lifeMoods: [],
      lifeJournals: [],
      lifeGoals: [],
      lifeRoutines: [],
      lifeRoutineChecks: [],

      knowledgeResources: [],
      knowledgeSnippets: [],
      knowledgeGuides: [],

      workspaces: [
        {
          id: 'ws-personal',
          name: 'Personal',
          type: 'personal' as const,
          ownerId: null,
          createdAt: initialTime,
        },
      ],
      activeWorkspaceId: 'ws-personal',
      lastSaved: null,
      cloudSyncEnabled: false,
      isInitialSync: true,

      setInitialSync: (isInitialSync) => set({ isInitialSync }),

      setCloudSyncEnabled: (enabled) => {
        set({ cloudSyncEnabled: enabled });
        if (enabled) {
          // Sync everything to cloud immediately, hierarchically ordered (Fix 1.3)
          const { entities, tasks, workspaces } = get();
          
          // Pre-sync workspaces to avoid FK violations
          workspaces.forEach(w => upsertWorkspace(w));

          // Build parenting map for ordered traversal
          const byParent = new Map<string | null, Entity[]>();
          entities.forEach(e => {
            const p = e.parentId || null;
            if (!byParent.has(p)) byParent.set(p, []);
            byParent.get(p)!.push(e);
          });

          const ordered: Entity[] = [];
          const visited = new Set<string>();

          const collect = (pid: string | null) => {
            const children = byParent.get(pid) || [];
            children.forEach(c => {
              if (visited.has(c.id)) return;
              ordered.push(c);
              visited.add(c.id);
              collect(c.id);
            });
          };
          collect(null); // Begin at root
          // Append any orphans not caught in tree
          entities.forEach(e => { if (!visited.has(e.id)) ordered.push(e); });

          // Bulk upsert hierarchically
          ordered.forEach(e => upsertEntity(e));
          tasks.forEach(t => upsertTask(t));
          set({ lastSaved: Date.now() });
        } else {
          // Destructive: Clear cloud data when switching to local-only
          clearAllDataFromCloud();
        }
      },
      toggleEntityCloudSync: (entityId: string) => {
        const { entities, workspaces } = get();
        const target = entities.find(e => e.id === entityId);
        if (!target) return;

        const newState = !target.cloudSyncEnabled;
        const wsId = target.workspaceId || 'ws-personal';

        if (newState) {
          // Enable: Propagate upwards to guarantee access path (Fix 1.4)
          const toEnableIds = new Set<string>();
          const lineage: Entity[] = [];
          let curr: Entity | undefined = target;
          while (curr) {
            toEnableIds.add(curr.id);
            lineage.unshift(curr); // Oldest ancestor first
            const pid = curr.parentId as string | null | undefined;
            curr = pid ? entities.find(e => e.id === pid) : undefined;
          }

          set({ 
            entities: entities.map(e => toEnableIds.has(e.id) ? { ...e, cloudSyncEnabled: true } : e),
            workspaces: workspaces.map(w => w.id === wsId ? { ...w, cloudSyncEnabled: true } : w)
          });

          // Dispatch side-effects async
          (async () => {
            const updatedWs = get().workspaces.find(w => w.id === wsId);
            if (updatedWs) await upsertWorkspace(updatedWs);
            for (const n of lineage) {
              await upsertEntity({ ...n, cloudSyncEnabled: true });
            }
            set({ lastSaved: Date.now() });
          })();
        } else {
          // Disable: Keep locally but purge from database
          set({ 
            entities: entities.map(e => e.id === entityId ? { ...e, cloudSyncEnabled: false } : e) 
          });
          (async () => {
            await deleteEntityFromDB(entityId);
            set({ lastSaved: Date.now() });
          })();
        }
      },
      setLastSaved: (time) => set({ lastSaved: time }),

      setEntities: (entities) => set({ entities }),


      activeEntityId: 'dashboard',
      navigationHistory: ['dashboard'],
      historyIndex: 0,
      recentEntityIds: [],

      favoriteIds: ['cv1', 'n1', 'm1'],
      collapsedIds: [],
      openTabIds: ['dashboard'],
      activeTabId: 'dashboard',
      modal: null,
      contextMenu: null,
      editingEntity: null,
      theme: 'dark',
      interfaceSize: 'regular',
      isSidebarCollapsed: false,
      isSidebarPinned: true,
      sidebarWidth: 280,
      aiSidebarWidth: 400,
      isToolbarVisible: true,
      toolbarPosition: null,
      mixedLayoutSplit: 50,
      isFullWidth: false,
      appStyle: 'v3',
      dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
      defaultDashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
      isDashboardEditing: false,
      aiMessages: [],
      aiApiKey: null,
      imageProvider: (typeof window !== 'undefined' && localStorage.getItem('flowr_image_provider') as 'pollinations' | 'puter') || 'pollinations',
      isAIAssistantOpen: false,
      activeChatId: null,
      isTempChat: true,
      tempChatMessages: [],
      chatHistoryOpen: true,
      chatConversations: [],
      isAIAssistantExtended: (typeof window !== 'undefined' && localStorage.getItem('flowr_ai_extended') === 'true'),
      isAILoading: false,
      aiCursor: null,
      aiBehaviorMode: (typeof window !== 'undefined' && localStorage.getItem('flowr_ai_behavior') as 'fast' | 'thinking' | 'auto') || 'auto',
      aiClassificationModelId: (typeof window !== 'undefined' && localStorage.getItem('flowr_ai_classification_model')) || '',
      aiAbortController: null,
      sidebarSectionSettings: {
        pinned: { sortMode: 'lastModified', itemLimit: 10 },
        unsorted: { sortMode: 'lastModified', itemLimit: 10 },
        workspaces: { sortMode: 'lastModified', itemLimit: 10 },
      },
      hiddenEntityIds: [],
      isCommandPaletteOpen: false,
      selectedSidebarIds: [],
      aiSessionContext: { distilled_summary: null, token_usage_total: 0, context_limit: 32000, compaction_threshold: 0.8 },
      activeMode: 'default' as BotMode,
      activeIntentTag: null,
      activeReplyMessage: null,
      assistantInput: "",
      thinkingEnabled: false,
      advisorEnabled: false,
      showPaidModels: false,

      // ─── Actions ─────────────────────────────────────────
      setDashboardLayout: (layout) => set({ dashboardLayout: layout }),
      setIsDashboardEditing: (editing) => set({ isDashboardEditing: editing }),
      resetDashboardLayout: () => set((s) => ({ dashboardLayout: s.defaultDashboardLayout })),

      stopAIGeneration: () => {
        const { aiAbortController } = get();
        if (aiAbortController) {
          aiAbortController.abort();
          set({ aiAbortController: null, isAILoading: false, aiCursor: null });
        }
      },

      add_note: (title, content, parentId = null) => {
        const { addEntity } = get();
        const blocks = markdownToBlocks(content);
        addEntity({
          id: generateId(),
          type: 'note',
          title,
          content: blocks,
          parentId: parentId || null,
          lastModified: Date.now(),
          tags: []
        });
      },

      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setInterfaceSize: (interfaceSize) => set({ interfaceSize }),
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      toggleSidebarPinned: () => set((state) => ({ isSidebarPinned: !state.isSidebarPinned })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setAiSidebarWidth: (width) => set({ aiSidebarWidth: width }),
      toggleToolbar: () => set((state) => ({ isToolbarVisible: !state.isToolbarVisible })),
      setToolbarVisible: (visible) => set({ isToolbarVisible: visible }),
      setToolbarPosition: (pos) => set({ toolbarPosition: pos }),
      setMixedLayoutSplit: (split) => set({ mixedLayoutSplit: split }),
      toggleFullWidth: () => set((state) => ({ isFullWidth: !state.isFullWidth })),
      setAppStyle: (appStyle) => set({ appStyle }),

      setWorkspaces: (workspaces) => set({ workspaces }),

      setActiveWorkspaceId: (id) => {
        set({ activeWorkspaceId: id });
      },

      createWorkspace: (input) => {
        const id = input.id ?? generateId();
        const workspace: Workspace = {
          id,
          name: input.name ?? 'Workspace',
          type: input.type ?? 'personal',
          ownerId: input.ownerId ?? null,
          createdAt: Date.now(),
          icon: input.icon,
          color: input.color,
          settings: input.settings,
        };
        set(s => ({ workspaces: [...s.workspaces, workspace] }));
        return id;
      },

      updateWorkspace: (id, patch) => set(s => ({
        workspaces: s.workspaces.map(w => w.id === id ? { ...w, ...patch } : w),
      })),

      deleteWorkspace: (id) => set(s => ({
        workspaces: s.workspaces.filter(w => w.id !== id),
        activeWorkspaceId: s.activeWorkspaceId === id
          ? (s.workspaces.find(w => w.id !== id)?.id ?? null)
          : s.activeWorkspaceId,
      })),



      setAIKey: (aiApiKey) => {
        if (aiApiKey) localStorage.setItem('flowr_ai_key', aiApiKey);
        else localStorage.removeItem('flowr_ai_key');
        set({ aiApiKey });
      },
      toggleAIAssistant: () => set((state) => ({ isAIAssistantOpen: !state.isAIAssistantOpen })),
      setAIAssistantOpen: (open) => set({ isAIAssistantOpen: open }),
      setAISessionContext: (context) => set({ aiSessionContext: context }),
      
      fetchAISessionContext: async (chatId) => {
        try {
          const res = await fetch(`/api/ai/memory/context?chatId=${encodeURIComponent(chatId)}&t=${Date.now()}`);
          if (!res.ok) throw new Error('Failed to fetch session context');
          const data = await res.json();
          set({ aiSessionContext: data });
        } catch (err) {
          console.error('Failed to fetch session context:', err);
        }
      },

      clearAIChat: async () => {
        const { activeEntityId, activeChatId, fetchAISessionContext } = get();
        set({ aiMessages: [], aiSessionContext: null, activeMode: 'default', activeIntentTag: null });
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }
          const sid = activeChatId || activeEntityId || 'global';
          await fetch('/api/ai/memory/clear', { 
            method: 'POST', 
            headers,
            body: JSON.stringify({ activeEntityId: sid }) 
          });
          
          await fetchAISessionContext(sid);
        } catch (err) {
          console.error('Failed to clear server-side memory:', err);
        }
      },

      setActiveChatId: (id) => set({ activeChatId: id }),
      setIsTempChat: (temp) => set({ isTempChat: temp }),
      setChatHistoryOpen: (open) => set({ chatHistoryOpen: open }),

      startTempChat: () => set({
        activeChatId: null,
        isTempChat: true,
        tempChatMessages: [],
        aiMessages: [],
        aiSessionContext: { distilled_summary: null, token_usage_total: 0, context_limit: 32000, compaction_threshold: 0.8 },
      }),

      startNewChat: async () => {
        try {
          const conv = await createConversation('New Chat');
          set({
            activeChatId: conv.id,
            isTempChat: false,
            tempChatMessages: [],
            aiMessages: [],
            aiSessionContext: { distilled_summary: null, token_usage_total: 0, context_limit: 32000, compaction_threshold: 0.8 },
            chatConversations: [conv, ...get().chatConversations],
          });
        } catch (e) {
          console.error('Failed to create conversation', e);
        }
      },

      loadConversation: async (id: string) => {
        try {
          const msgs = await fetchMessages(id);
          const aiMsgs = msgs.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            model: m.model,
            timestamp: new Date(m.created_at).getTime(),
            pipelineSteps: m.pipeline_steps,
            image_description: m.image_description,
            image_prompt: m.image_prompt,
          }));
          set({
            activeChatId: id,
            isTempChat: false,
            tempChatMessages: [],
            aiMessages: aiMsgs,
            aiSessionContext: { distilled_summary: null, token_usage_total: 0, context_limit: 32000, compaction_threshold: 0.8 },
          });
          // Fetch fresh context for the loaded chat
          get().fetchAISessionContext(id);
        } catch (e) {
          console.error('Failed to load conversation', e);
        }
      },

      deleteChatConversation: async (id: string) => {
        try {
          await deleteConversationFromDB(id);
          const next = get().chatConversations.filter(c => c.id !== id);
          set({ chatConversations: next });
          if (get().activeChatId === id) {
            set({ activeChatId: null, isTempChat: true, aiMessages: [], tempChatMessages: [], aiSessionContext: { distilled_summary: null, token_usage_total: 0, context_limit: 32000, compaction_threshold: 0.8 } });
          }
        } catch (e) {
          console.error('Failed to delete conversation', e);
        }
      },

      renameChatConversation: async (id: string, title: string) => {
        try {
          await updateConversationTitle(id, title);
          set(s => ({
            chatConversations: s.chatConversations.map(c =>
              c.id === id ? { ...c, title, updated_at: new Date().toISOString() } : c
            ),
          }));
        } catch (e) {
          console.error('Failed to rename conversation', e);
        }
      },

      loadChatConversations: async () => {
        try {
          const convs = await fetchConversations();
          set({ chatConversations: convs });
        } catch (e) {
          console.error('Failed to load conversations', e);
        }
      },

      openChatInPage: () => {
        get().setActiveEntityId('chat');
      },

      compactAIChat: async () => {
        const { activeEntityId, activeChatId, fetchAISessionContext } = get();
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }
          const sid = activeChatId || activeEntityId || 'global';
          const res = await fetch('/api/ai/memory/compact', { 
            method: 'POST', 
            headers,
            body: JSON.stringify({ activeEntityId: sid }) 
          });
          if (res.ok) {
            await fetchAISessionContext(sid);
          }
        } catch (err) {
          console.error('Failed to compact session memory:', err);
        }
      },
      setAIHistory: (messages) => set({ aiMessages: messages }),
      setIsAIAssistantExtended: (extended) => set({ isAIAssistantExtended: extended }),
      setAICursor: (aiCursor) => set({ aiCursor }),

      toggleAIAssistantExtended: () => {
        set((state) => {
          const newState = !state.isAIAssistantExtended;
          localStorage.setItem('flowr_ai_extended', String(newState));
          return { isAIAssistantExtended: newState };
        });
      },
      setAIBehaviorMode: (aiBehaviorMode) => {
        localStorage.setItem('flowr_ai_behavior', aiBehaviorMode);
        set({ aiBehaviorMode });
      },
      setAIClassificationModelId: (id) => {
        localStorage.setItem('flowr_ai_classification_model', id);
        set({ aiClassificationModelId: id });
      },
      setActiveMode: (mode) => set({ activeMode: mode }),
      setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),
      setAdvisorEnabled: (enabled) => set({ advisorEnabled: enabled }),
      setActiveIntentTag: (tag) => set({ activeIntentTag: tag }),
      setReplyMessage: (msg) => set({ activeReplyMessage: msg }),
      setShowPaidModels: (show) => set({ showPaidModels: show }),
      setAssistantInput: (input) => set({ assistantInput: input }),

      sendAIMessage: async (content, attachments = []) => {
        const { aiMessages, activeReplyMessage } = get();

        let replyContext: any = null;
        if (activeReplyMessage) {
          const idx = aiMessages.findIndex(m => m.id === activeReplyMessage.id);
          if (idx !== -1) {
            const contextMsgs: AIMessage[] = [];
            // One previous message
            if (idx > 0) contextMsgs.push(aiMessages[idx - 1]);
            // The replied message itself
            contextMsgs.push(aiMessages[idx]);
            // One next message
            if (idx < aiMessages.length - 1) contextMsgs.push(aiMessages[idx + 1]);

            // Construct [SPECIAL ATTENTION] block
            const attentionBlock = `[SPECIAL ATTENTION]\nThe user is replying/referring to a specific message in the conversation. Focus your attention and answer primarily in relation to these relevant context messages:\n` +
              contextMsgs.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: "${m.content || '[Attachment]'}"`).join('\n') + '\n';

            // Last 3 turns (6 messages)
            const lastTurns = aiMessages.slice(-6);
            const historyBlock = `[CONVERSATION HISTORY]\n` +
              lastTurns.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: "${m.content || '[Attachment]'}"`).join('\n') + '\n';

            replyContext = {
              repliedMessage: activeReplyMessage,
              attentionBlock,
              historyBlock,
            };
          }
        }

        const userMessage: AIMessage = {
          id: generateId(),
          role: 'user',
          content,
          timestamp: Date.now(),
          attachments,
        };

        const placeholderMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        };

        const isTemp = get().isTempChat;
        set({
          aiMessages: [...aiMessages, userMessage, placeholderMessage],
          ...(isTemp ? { tempChatMessages: [...aiMessages, userMessage, placeholderMessage] } : {}),
          activeReplyMessage: null,
          isAILoading: true,
        });

        // Persist user message if in a named conversation
        const activeChatId = get().activeChatId;
        if (activeChatId && !get().isTempChat) {
          insertMessage(activeChatId, 'user', content).catch(console.error);
        }

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };

          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }

          // Handle vision: extract first image attachment if present
          let imageBuffer: string | undefined = undefined;
          const firstImage = attachments.find(a => a.type === 'image');
          if (firstImage?.url?.startsWith('data:')) {
            imageBuffer = firstImage.url.split(',')[1];
          }

          // Send current conversation as history so the bot has context.
          // Strip embedded base64 images — they balloon prompts to 60k+ tokens and
          // get rejected by classifier models. Replace with a short placeholder using
          // the stored image_description when available.
          const stripHeavyMedia = (text: string, imageDescription?: string) => {
            if (!text) return ''
            if (!text.includes('data:image/')) return text
            const placeholder = imageDescription ? `[Image: ${imageDescription}]` : '[Image: (visual content generated)]'
            return text.replace(/!\[.*?\]\s*\(\s*data:image\/.*?;base64,[\s\S]*?\)/g, placeholder)
          }
          const historyMessages = aiMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: stripHeavyMedia(m.content || '', m.image_description) }],
            }))

          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              prompt: content,
              buffer: imageBuffer,
              activeEntityId: get().activeEntityId,
              activeChatId: get().activeChatId,
              aiApiKey: get().aiApiKey,
              activeWorkspaceId: get().activeWorkspaceId,
              classificationModelId: get().aiClassificationModelId,
              mode: get().activeMode,
              intentTag: get().activeIntentTag ?? null,
              replyContext,
              thinkingEnabled: get().thinkingEnabled,
              advisorEnabled: get().advisorEnabled,
              isTempChat: get().isTempChat,
              clientHistory: historyMessages,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            set(s => ({
              aiMessages: s.aiMessages.map(m => m.id === placeholderMessage.id
                ? { ...m, content: err.error || 'Something went wrong.', model: err.model || 'system' }
                : m
              ),
              isAILoading: false,
            }));
            return;
          }

          const isStream = res.headers.get('Content-Type')?.includes('text/event-stream');
          if (isStream) {
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let sseBuffer = '';
            let lastModel = '';
            let lastPipelineSteps = undefined;
            let lastImageDescription = undefined;
            let lastImagePrompt = undefined;

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Stream chunks may split mid-line — accumulate and only process complete lines.
                // Large base64 images can span many TCP packets; without this, JSON.parse fails silently.
                sseBuffer += decoder.decode(value, { stream: true });
                const newlineIdx = sseBuffer.lastIndexOf('\n');
                if (newlineIdx === -1) continue;
                const complete = sseBuffer.slice(0, newlineIdx);
                sseBuffer = sseBuffer.slice(newlineIdx + 1);
                const lines = complete.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') break;
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.content) {
                        accumulatedContent += parsed.content;
                        set((s) => ({
                          aiMessages: s.aiMessages.map((m) =>
                            m.id === placeholderMessage.id
                              ? {
                                  ...m,
                                  content: accumulatedContent,
                                  model: parsed.model || m.model,
                                  tokens_used: Math.ceil((content.length + accumulatedContent.length) / 4),
                                  image_description: parsed.image_description ?? m.image_description,
                                  image_prompt: (parsed as any).image_prompt ?? (m as any).image_prompt,
                                  model_chain: parsed.model_chain ?? m.model_chain,
                                  classification_trace: parsed.classification_trace ?? m.classification_trace,
                                  routing_trace: parsed.routing_trace ?? m.routing_trace,
                                  pipelineSteps: parsed.pipeline_steps ?? m.pipelineSteps,
                                  logId: parsed.log_id ?? m.logId,
                                  citations: parsed.citations ?? m.citations,
                                }
                              : m
                          ),
                          ...(get().isTempChat ? {
                            tempChatMessages: s.aiMessages.map((m) =>
                              m.id === placeholderMessage.id
                                ? { ...m, content: accumulatedContent, model: parsed.model || m.model, image_description: parsed.image_description ?? m.image_description }
                                : m
                            )
                          } : {}),
                        }));

                        // Capture metadata for persistence
                        if (parsed.model) lastModel = parsed.model;
                        if (parsed.pipeline_steps) lastPipelineSteps = parsed.pipeline_steps;
                        if (parsed.image_description) lastImageDescription = parsed.image_description;
                        if ((parsed as any).image_prompt) lastImagePrompt = (parsed as any).image_prompt;
                      } else if (parsed.status) {
                        set((s) => ({
                          aiMessages: s.aiMessages.map((m) =>
                            m.id === placeholderMessage.id
                              ? { ...m, status: parsed.status }
                              : m
                          ),
                        }));
                      }
                    } catch (e) {
                      // ignore parse errors
                    }
                  }
                }
              }
            }
            set({ isAILoading: false });
            // Persist assistant reply
            const chatId = get().activeChatId;
            if (chatId && !get().isTempChat && accumulatedContent) {
              insertMessage(chatId, 'assistant', accumulatedContent, lastModel, lastPipelineSteps, lastImageDescription, lastImagePrompt).catch(console.error);
              // Auto-set title from first message if still default
              const conv = get().chatConversations.find(c => c.id === chatId);
              if (conv && conv.title === 'New Chat' && content) {
                const title = content.slice(0, 60);
                get().renameChatConversation(chatId, title);
              }
            }
            return;
          }

          const data = await res.json();
          set(s => ({
            aiMessages: s.aiMessages.map(m => m.id === placeholderMessage.id
              ? {
                ...m,
                content: data.content,
                model: data.model,
                logId: data.log_id ?? undefined,
                model_chain: data.model_chain,
                classification_trace: data.classification_trace,
                routing_trace: data.routing_trace,
                citations: data.citations,
                tokens_used: data.tokens_used,
                pipelineSteps: data.pipeline_steps,
                image_description: data.image_description
              }
              : m
            ),
            isAILoading: false,
          }));

          // Persist non-streaming assistant reply
          const cid = get().activeChatId;
          if (cid && !get().isTempChat && data.content) {
            insertMessage(cid, 'assistant', data.content, data.model, data.pipeline_steps, data.image_description, data.image_prompt).catch(console.error);
            // Auto-set title from first message if still default
            const conv = get().chatConversations.find(c => c.id === cid);
            if (conv && conv.title === 'New Chat' && content) {
              const title = content.slice(0, 60);
              get().renameChatConversation(cid, title);
            }
          }
        } catch {
          set(s => ({
            aiMessages: s.aiMessages.map(m => m.id === placeholderMessage.id
              ? { ...m, content: 'Connection error. Please try again.' }
              : m
            ),
            isAILoading: false,
          }));
        }
      },

      setActiveEntityId: (id) => {
        const state = get();
        if (id === state.activeEntityId && state.navigationHistory[state.historyIndex] === id) return;

        // Tab management: Replace current tab ID with new ID instead of opening new tab
        const currentActiveId = state.activeTabId || state.activeEntityId || 'dashboard';
        const tabIndex = state.openTabIds.indexOf(currentActiveId);

        // Update Recent Entities (exclude dashboard)
        let nextRecent = [...state.recentEntityIds];
        if (id && id !== 'dashboard') {
          nextRecent = [id, ...nextRecent.filter(rid => rid !== id)].slice(0, 8);
        }

        let nextTabs = [...state.openTabIds];
        if (id) {
          const existingIndex = nextTabs.indexOf(id);
          
          if (existingIndex !== -1) {
            // If it already exists, just jump to it
            set({ activeTabId: id, activeEntityId: id, recentEntityIds: nextRecent });
          } else if (tabIndex !== -1) {
            // Replace current tab with the new ID
            nextTabs[tabIndex] = id;
            set({ openTabIds: nextTabs, activeTabId: id, activeEntityId: id, recentEntityIds: nextRecent });
          } else {
            // Push new tab only if no active tab is found (should be rare)
            nextTabs.push(id);
            set({ openTabIds: nextTabs, activeTabId: id, activeEntityId: id, recentEntityIds: nextRecent });
          }
        } else {
          set({ recentEntityIds: nextRecent });
        }

        const newHistory = state.navigationHistory.slice(0, state.historyIndex + 1);
        if (id) newHistory.push(id);
        set({
          activeEntityId: id,
          activeTabId: id,
          navigationHistory: newHistory,
          historyIndex: newHistory.length - 1
        });
      },

      addTab: (id = 'dashboard') => {
        const state = get();
        if (!id) return;

        const alreadyOpen = state.openTabIds.includes(id);
        if (alreadyOpen) {
          set({ activeTabId: id, activeEntityId: id });
          return;
        }

        set({
          openTabIds: [...state.openTabIds, id],
          activeTabId: id,
          activeEntityId: id
        });
      },

      removeTab: (id) => set((s) => {
        const nextTabs = s.openTabIds.filter(tid => tid !== id);
        let nextActive = s.activeTabId;
        if (s.activeTabId === id) {
          nextActive = nextTabs[nextTabs.length - 1] || 'dashboard';
        }
        return {
          openTabIds: nextTabs,
          activeTabId: nextActive,
          activeEntityId: nextActive
        };
      }),

      setActiveTab: (id) => set({ activeTabId: id, activeEntityId: id }),
      setOpenTabs: (ids) => set({ openTabIds: ids }),

      setNavigationState: (id, history, index) => set({ activeEntityId: id, navigationHistory: history, historyIndex: index }),

      goBack: () => { if (get().historyIndex > 0) window.history.back(); },
      goForward: () => { if (get().historyIndex < get().navigationHistory.length - 1) window.history.forward(); },

      addEntity: (entity) => {
        // Content quality gate for AI-generated notes
        if (entity.type === 'note' && entity.content && entity.content.length > 0) {
          const allBlockTexts = entity.content.map((b: any) => (b.content || '').trim().toLowerCase());
          const blockTexts = allBlockTexts.filter((t: string) => t.length > 0);
          const totalBlocks = entity.content.length;
          const emptyBlocks = allBlockTexts.filter((t: string) => t.length === 0).length;

          const placeholderTexts = new Set([
            'title', 'heading', 'subheading', 'subtitle',
            'list item', 'list item...', 'list item…',
            'body text', 'paragraph', 'your text here',
            'description', 'section title', 'content here',
            'placeholder', 'text', 'body', 'section'
          ]);
          const placeholderBlocks = blockTexts.filter((t: string) =>
            placeholderTexts.has(t) || placeholderTexts.has(t.replace(/[.\…]+$/, ''))
          ).length;

          // Reject if either:
          // - 50%+ of blocks are literal placeholder words ("Title", "Heading", "List item..."), OR
          // - more than half the blocks are empty (user would see a wall of empty-state placeholders)
          const tooManyPlaceholders = totalBlocks > 0 && placeholderBlocks >= totalBlocks * 0.5;
          const tooManyEmptyBlocks = totalBlocks >= 3 && emptyBlocks >= Math.ceil(totalBlocks * 0.5);

          if (tooManyPlaceholders || tooManyEmptyBlocks) {
            console.error('[Flowr AI] addEntity BLOCKED placeholder note. Total:', totalBlocks, '| Empty:', emptyBlocks, '| Placeholder:', placeholderBlocks, '| Sample:', blockTexts.slice(0, 5));
            entity = {
              ...entity,
              content: [{
                id: crypto.randomUUID?.() || String(Date.now()),
                type: 'text' as const,
                style: 'body' as const,
                content: '⚠️ The AI generated placeholder content instead of real text. Please ask the AI to try again, or write the content manually.',
                align: 'left' as const
              }]
            };
          }
        }
        const activeWorkspaceId = get().activeWorkspaceId;
        const maxSortOrder = Math.max(...get().entities.map(e => e.sortOrder || 0), 0);

        // Enforce flat hierarchy for workspaces and collections
        const isRootOnly = entity.type === 'workspace' || entity.type === 'collection';
        const finalParentId = isRootOnly ? null : (entity.parentId ?? null);

        const finalEntity = {
          ...entity,
          id: entity.id || generateId(),
          parentId: finalParentId,
          workspaceId: entity.workspaceId || activeWorkspaceId,
          sortOrder: entity.sortOrder ?? (maxSortOrder + 1),
          lastModified: entity.lastModified || Date.now()
        } as Entity;
        set((state) => ({ entities: [...state.entities, finalEntity] }));
        if (finalEntity.cloudSyncEnabled) upsertEntity(finalEntity);
        return finalEntity.id;
      },

      deleteEntity: (id) => {
        const state = get();
        const descendantIds = getDescendantIds(state.entities, id);
        const idsToRemove = new Set([id, ...descendantIds]);
        set((s) => ({
          entities: s.entities.filter(e => !idsToRemove.has(e.id)),
          favoriteIds: s.favoriteIds.filter(fid => !idsToRemove.has(fid)),
          activeEntityId: idsToRemove.has(s.activeEntityId ?? '') ? 'dashboard' : s.activeEntityId,
        }));
        idsToRemove.forEach(eid => deleteEntityFromDB(eid));
      },

      moveEntity: (id, newParentId, newWorkspaceId) => {
        set((state) => ({
          entities: state.entities.map(e => {
            if (e.id !== id) return e;

            // Enforce flat hierarchy for workspaces and collections
            const isRootOnly = e.type === 'workspace' || e.type === 'collection';
            const finalParentId = isRootOnly ? null : newParentId;

            return {
              ...e,
              parentId: finalParentId,
              workspaceId: newWorkspaceId !== undefined ? newWorkspaceId : e.workspaceId,
              lastModified: Date.now()
            };
          })
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated && updated.cloudSyncEnabled) upsertEntity(updated);
      },

      reorderEntities: (orderedIds) => {
        set((state) => ({
          entities: state.entities.map(e => {
            const idx = orderedIds.indexOf(e.id);
            if (idx === -1) return e;
            return { ...e, sortOrder: idx };
          }),
        }));
      },

      renameEntity: (id, newTitle) => {
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, title: newTitle, lastModified: Date.now() } : e),
          workspaces: state.workspaces.map(w => w.id === id ? { ...w, name: newTitle } : w),
          editingEntity: null
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated && updated.cloudSyncEnabled) upsertEntity(updated);
        const updatedWs = get().workspaces.find(w => w.id === id);
        if (updatedWs && updatedWs.cloudSyncEnabled) upsertWorkspace(updatedWs);
      },

      duplicateEntity: (id: string) => {
        const state = get();
        const rootEntity = state.entities.find(e => e.id === id);
        if (!rootEntity) return;
        const newEntities: Entity[] = [];
        const duplicateRecursive = (entity: Entity, newParentId: string | null) => {
          const newId = generateId();
          const isRoot = entity.id === id;
          const copy: Entity = { ...entity, id: newId, parentId: newParentId, title: isRoot ? `${entity.title} (Copy)` : entity.title, lastModified: Date.now() };
          newEntities.push(copy);
          state.entities.filter(e => e.parentId === entity.id).forEach(child => duplicateRecursive(child, newId));
        };
        duplicateRecursive(rootEntity, rootEntity.parentId);
        set((state) => ({ entities: [...state.entities, ...newEntities] }));
        newEntities.filter(e => e.cloudSyncEnabled).forEach(e => upsertEntity(e));
      },

      setEntityIcon: (id, icon) => {
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, icon, lastModified: Date.now() } : e),
          workspaces: state.workspaces.map(w => w.id === id ? { ...w, icon } : w)
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated && updated.cloudSyncEnabled) upsertEntity(updated);
        // Also sync workspace if needed
        const updatedWs = get().workspaces.find(w => w.id === id);
        if (updatedWs && updatedWs.cloudSyncEnabled) upsertWorkspace(updatedWs);
      },

      setEditingEntityId: (id, source) => set({ editingEntity: id && source ? { id, source } : null }),
      setSectionSortMode: (sectionId, mode) => set(s => ({
        sidebarSectionSettings: {
          ...s.sidebarSectionSettings,
          [sectionId]: { ...s.sidebarSectionSettings[sectionId], sortMode: mode }
        }
      })),
      setSectionItemLimit: (sectionId, limit) => set(s => ({
        sidebarSectionSettings: {
          ...s.sidebarSectionSettings,
          [sectionId]: { ...s.sidebarSectionSettings[sectionId], itemLimit: limit }
        }
      })),
      toggleEntityVisibility: (id) => set(s => ({
        hiddenEntityIds: s.hiddenEntityIds.includes(id) ? s.hiddenEntityIds.filter(hid => hid !== id) : [...s.hiddenEntityIds, id]
      })),
      moveEntityInList: (id, direction) => set(s => {
        const entities = [...s.entities];
        const idx = entities.findIndex(e => e.id === id);
        if (idx === -1) return {};

        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= entities.length) return {};

        const [moved] = entities.splice(idx, 1);
        entities.splice(newIdx, 0, moved);

        return {
          entities: entities.map((e, i) => ({ ...e, sortOrder: i }))
        };
      }),
      insertSidebarDivider: (parentId) => {
        const id = generateId();
        const divider = { id, title: '', type: 'divider' as const, parentId, lastModified: Date.now(), sortOrder: 9999 };
        set(s => ({ entities: [...s.entities, divider] }));
        // Inherit divider sync from parent context if applicable (cast so compiler knows it's complete)
        const typedDivider = divider as Entity;
        if (typedDivider.cloudSyncEnabled) upsertEntity(typedDivider);
      },
      updateEntityContent: (id, content) => {
        const now = Date.now();
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, content, lastModified: now } : e),
          lastSaved: now
        }));

        const updated = get().entities.find(e => e.id === id);

        if (updated && updated.cloudSyncEnabled) {
          upsertEntity(updated);
        }
      },

      addTagToEntity: (id, tag) => set((state) => ({
        entities: state.entities.map(e => {
          if (e.id !== id) return e;
          const currentTags = e.tags ?? [];
          if (currentTags.includes(tag)) return e;
          return { ...e, tags: [...currentTags, tag], lastModified: Date.now() };
        })
      })),

      removeTagFromEntity: (id, tag) => set((state) => ({ entities: state.entities.map(e => e.id === id ? { ...e, tags: (e.tags ?? []).filter(t => t !== tag), lastModified: Date.now() } : e) })),

      updateTagInEntity: (id, oldTag, newTag) => set((state) => ({ entities: state.entities.map(e => e.id === id ? { ...e, tags: (e.tags ?? []).map(t => t === oldTag ? newTag : t), lastModified: Date.now() } : e) })),

      setTagsForEntity: (id, tags) => set((state) => ({ entities: state.entities.map(e => e.id === id ? { ...e, tags, lastModified: Date.now() } : e) })),

      addEmptyTag: (id: string) => set((state) => ({ entities: state.entities.map(e => e.id === id ? { ...e, tags: [...(e.tags ?? []), ''], lastModified: Date.now() } : e) })),

      addCanvasBlock: (block: EditorBlock) => set((state) => ({
        blocks: [...state.blocks, block]
      })),
      updateCanvasBlock: (id: string, updates: Partial<EditorBlock>) => set((state) => ({
        blocks: state.blocks.map(b => b.id === id ? { ...b, ...updates } : b)
      })),
      updateCanvasBlocks: (batch: { id: string; updates: Partial<EditorBlock> }[]) => set((state) => {
        const map = new Map(batch.map(u => [u.id, u.updates]));
        return {
          blocks: state.blocks.map(b => {
            const up = map.get(b.id);
            return up ? { ...b, ...up } : b;
          })
        };
      }),
      deleteCanvasBlock: (id: string) => set((state) => ({
        blocks: state.blocks.filter(b => b.id !== id)
      })),
      moveCanvasSection: (sectionId: string, deltaX: number, deltaY: number) => set((state) => ({
        blocks: state.blocks.map(b => {
          if (b.id === sectionId) {
            return { ...b, x: (b.x || 0) + deltaX, y: (b.y || 0) + deltaY };
          }
          if (b.parentId === sectionId) {
            return { ...b, x: (b.x || 0) + deltaX, y: (b.y || 0) + deltaY };
          }
          return b;
        })
      })),

      toggleFavorite: (id) => set((state) => ({ favoriteIds: state.favoriteIds.includes(id) ? state.favoriteIds.filter(fid => fid !== id) : [...state.favoriteIds, id] })),

      toggleCollapsed: (id) => set((state) => ({ collapsedIds: state.collapsedIds.includes(id) ? state.collapsedIds.filter(cid => cid !== id) : [...state.collapsedIds, id] })),

      addTask: (task) => {
        const activeWorkspaceId = get().activeWorkspaceId;
        const finalTask = {
          id: generateId(),
          completed: false,
          ...task,
          workspaceId: task.workspaceId || activeWorkspaceId
        } as AppTask;
        set((state) => ({ tasks: [...state.tasks, finalTask] }));
        upsertTask(finalTask);
      },

      toggleTask: (id) => {
        set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) }));
        const updated = get().tasks.find(t => t.id === id);
        if (updated) upsertTask(updated);
      },

      deleteTask: (id) => {
        set((s) => ({ tasks: s.tasks.filter(t => t.id !== id) }));
        deleteTaskFromDB(id);
      },

      updateTask: (id, updates) => {
        set((s) => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t) }));
        const updated = get().tasks.find(t => t.id === id);
        if (updated) upsertTask(updated);
      },

      updateWidgetLayout: (entityId, layout) => {
        set((s) => ({
          entities: s.entities.map(e =>
            e.id === entityId ? { ...e, widgetLayout: layout, lastModified: Date.now() } : e
          )
        }));
        const updated = get().entities.find(e => e.id === entityId);
        if (updated && updated.cloudSyncEnabled) upsertEntity(updated);
      },

      sortEntities: (criteria) => set((s) => ({ entities: [...s.entities].sort((a, b) => criteria === 'title' ? a.title.localeCompare(b.title) : (b.lastModified || 0) - (a.lastModified || 0)) })),

      sortTasks: (criteria) => set((s) => ({ tasks: [...s.tasks].sort((a, b) => criteria === 'title' ? a.title.localeCompare(b.title) : new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime()) })),

      updateBlockPosition: (id, x, y) => set((state) => ({ blocks: state.blocks.map(b => b.id === id ? { ...b, x, y } : b) })),

      setTasks: (tasks) => set({ tasks }),

      addHabit: (habit) => set(s => ({ lifeHabits: [...s.lifeHabits, habit] })),
      updateHabit: (id, updates) => set(s => ({ lifeHabits: s.lifeHabits.map(h => h.id === id ? { ...h, ...updates } : h) })),
      deleteHabit: (id) => set(s => ({ lifeHabits: s.lifeHabits.filter(h => h.id !== id), lifeHabitChecks: s.lifeHabitChecks.filter(c => c.habitId !== id) })),
      checkHabit: (habitId, date, done) => set(s => {
        const existing = s.lifeHabitChecks.find(c => c.habitId === habitId && c.date === date);
        if (existing) {
          return { lifeHabitChecks: s.lifeHabitChecks.map(c => c.id === existing.id ? { ...c, done } : c) };
        }
        return { lifeHabitChecks: [...s.lifeHabitChecks, { id: generateId(), habitId, date, done }] };
      }),

      setMood: (entry) => set(s => {
        const existing = s.lifeMoods.find(m => m.workspaceId === entry.workspaceId && m.date === entry.date);
        if (existing) {
          return { lifeMoods: s.lifeMoods.map(m => m.id === existing.id ? { ...m, ...entry } : m) };
        }
        return { lifeMoods: [...s.lifeMoods, entry] };
      }),
      deleteMood: (id) => set(s => ({ lifeMoods: s.lifeMoods.filter(m => m.id !== id) })),

      upsertJournal: (entry) => set(s => {
        const existing = s.lifeJournals.find(j => j.workspaceId === entry.workspaceId && j.date === entry.date);
        if (existing) {
          return { lifeJournals: s.lifeJournals.map(j => j.id === existing.id ? { ...j, ...entry } : j) };
        }
        return { lifeJournals: [...s.lifeJournals, entry] };
      }),
      deleteJournal: (id) => set(s => ({ lifeJournals: s.lifeJournals.filter(j => j.id !== id) })),

      addGoal: (goal) => set(s => ({ lifeGoals: [...s.lifeGoals, goal] })),
      updateGoal: (id, updates) => set(s => ({ lifeGoals: s.lifeGoals.map(g => g.id === id ? { ...g, ...updates } : g) })),
      deleteGoal: (id) => set(s => ({ lifeGoals: s.lifeGoals.filter(g => g.id !== id) })),

      addRoutine: (routine) => set(s => ({ lifeRoutines: [...s.lifeRoutines, routine] })),
      updateRoutine: (id, updates) => set(s => ({ lifeRoutines: s.lifeRoutines.map(r => r.id === id ? { ...r, ...updates } : r) })),
      deleteRoutine: (id) => set(s => ({ lifeRoutines: s.lifeRoutines.filter(r => r.id !== id), lifeRoutineChecks: s.lifeRoutineChecks.filter(c => c.routineId !== id) })),
      checkRoutineStep: (routineId, stepId, date, done) => set(s => {
        const existing = s.lifeRoutineChecks.find(c => c.routineId === routineId && c.stepId === stepId && c.date === date);
        if (existing) {
          return { lifeRoutineChecks: s.lifeRoutineChecks.map(c => c.id === existing.id ? { ...c, done } : c) };
        }
        return { lifeRoutineChecks: [...s.lifeRoutineChecks, { id: generateId(), routineId, stepId, date, done }] };
      }),

      setLifeData: (data) => set(s => ({ ...s, ...data })),

      addResource: (resource) => set(s => ({ knowledgeResources: [...s.knowledgeResources, resource] })),
      updateResource: (id, updates) => set(s => ({ knowledgeResources: s.knowledgeResources.map(r => r.id === id ? { ...r, ...updates } : r) })),
      deleteResource: (id) => set(s => ({ knowledgeResources: s.knowledgeResources.filter(r => r.id !== id) })),

      addSnippet: (snippet) => set(s => ({ knowledgeSnippets: [...s.knowledgeSnippets, snippet] })),
      updateSnippet: (id, updates) => set(s => ({ knowledgeSnippets: s.knowledgeSnippets.map(sn => sn.id === id ? { ...sn, ...updates } : sn) })),
      deleteSnippet: (id) => set(s => ({ knowledgeSnippets: s.knowledgeSnippets.filter(sn => sn.id !== id) })),

      addGuide: (guide) => set(s => ({ knowledgeGuides: [...s.knowledgeGuides, guide] })),
      updateGuide: (id, updates) => set(s => ({ knowledgeGuides: s.knowledgeGuides.map(g => g.id === id ? { ...g, ...updates } : g) })),
      deleteGuide: (id) => set(s => ({ knowledgeGuides: s.knowledgeGuides.filter(g => g.id !== id) })),

      setKnowledgeData: (data) => set(s => ({ ...s, ...data })),

      openModal: (modal) => set({ modal, contextMenu: null }),
      closeModal: () => set({ modal: null }),

      toggleCommandPalette: () => set(s => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),
      setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),

      openContextMenu: (entityId, x, y, source) => set({ contextMenu: { entityId, x, y, source } }),
      closeContextMenu: () => set({ contextMenu: null }),

      copiedBlock: null,
      copyBlock: (block) => set({ copiedBlock: block }),
      pasteBlock: (entityId, afterBlockId) => {
        const { entities, updateEntityContent, copiedBlock } = get();
        if (!copiedBlock) return;

        const entity = entities.find(e => e.id === entityId);
        if (!entity || !entity.content) return;

        const newBlock = { ...copiedBlock, id: generateId() };
        const currentIndex = entity.content.findIndex(b => b.id === afterBlockId);

        const newContent = [...entity.content];
        if (currentIndex === -1) {
          newContent.push(newBlock);
        } else {
          newContent.splice(currentIndex + 1, 0, newBlock);
        }

        updateEntityContent(entityId, newContent);
      },

      setSelectedSidebarIds: (ids) => set({ selectedSidebarIds: ids }),
      clearSelectedSidebarIds: () => set({ selectedSidebarIds: [] }),
    }),
    {
      name: 'flowr-storage',
      version: 15,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState as any;
        if (typeof state !== 'object' || !state) state = {};
        if (version < 7) {
          // v7: legacy model chain migration (no-op for v15+ users)
        }
        if (version < 8) {
          state = {
            ...state,
            appStyle: 'v3'
          };
        }
        if (version < 9) {
          // Phase 4: workspace entity type + widgetLayout on entities + workspaceId on tasks
          if (Array.isArray(state.entities)) {
            state.entities = state.entities.map((e: any) => ({
              ...e,
              widgetLayout: e.widgetLayout ?? undefined,
            }));
          }
          if (Array.isArray(state.tasks)) {
            state.tasks = state.tasks.map((t: any) => ({
              ...t,
              workspaceId: t.workspaceId ?? null,
            }));
          }
        }
        if (version < 11) {
          // v11: reset stale model configs (no-op for v15+ users)
        }
        if (version < 12) {
          // v12: reset stale model IDs (no-op for v15+ users)
        }
        if (version < 13) {
          // Phase 01: introduce Workspace model — assign all existing entities/tasks to ws-personal
          if (!Array.isArray(state.workspaces) || state.workspaces.length === 0) {
            state = {
              ...state,
              workspaces: [{
                id: 'ws-personal',
                name: 'Personal',
                type: 'personal',
                ownerId: null,
                createdAt: Date.now(),
              }],
              activeWorkspaceId: 'ws-personal',
            };
          }
          if (Array.isArray(state.entities)) {
            state.entities = state.entities.map((e: any) => ({
              ...e,
              workspaceId: e.workspaceId ?? 'ws-personal',
            }));
          }
          if (Array.isArray(state.tasks)) {
            state.tasks = state.tasks.map((t: any) => ({
              ...t,
              workspaceId: t.workspaceId ?? 'ws-personal',
            }));
          }
        }
        if (version < 14) {
          // Backfill workspaceId on any entity or task that is still missing it
          if (Array.isArray(state.entities)) {
            state.entities = state.entities.map((e: any) => ({
              ...e,
              workspaceId: e.workspaceId || 'ws-personal',
            }));
          }
          if (Array.isArray(state.tasks)) {
            state.tasks = state.tasks.map((t: any) => ({
              ...t,
              workspaceId: t.workspaceId || 'ws-personal',
            }));
          }
        }
        return state;
      },
      storage: (() => {
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        return {
          getItem: (name: string) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            try {
              return JSON.parse(str);
            } catch (e) {
              return null;
            }
          },
          setItem: (name: string, value: unknown) => {
            try {
              localStorage.setItem(name, JSON.stringify(value));
            } catch (e) {
              if (e instanceof Error && e.name === 'QuotaExceededError') {
                console.warn('[Flowr Store] Storage quota exceeded. State update was not persisted to disk.');
              }
            }
          },
          removeItem: (name: string) => localStorage.removeItem(name),
        };
      })(),
      partialize: (state: AppState) => ({
        entities: state.entities,
        tasks: state.tasks,
        blocks: state.blocks,
        lifeHabits: state.lifeHabits,
        lifeHabitChecks: state.lifeHabitChecks,
        lifeMoods: state.lifeMoods,
        lifeJournals: state.lifeJournals,
        lifeGoals: state.lifeGoals,
        lifeRoutines: state.lifeRoutines,
        lifeRoutineChecks: state.lifeRoutineChecks,
        knowledgeResources: state.knowledgeResources,
        knowledgeSnippets: state.knowledgeSnippets,
        knowledgeGuides: state.knowledgeGuides,
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,

        favoriteIds: state.favoriteIds,
        collapsedIds: state.collapsedIds,
        theme: state.theme,
        interfaceSize: state.interfaceSize,
        isSidebarCollapsed: state.isSidebarCollapsed,
        isSidebarPinned: state.isSidebarPinned,
        isToolbarVisible: state.isToolbarVisible,
        toolbarPosition: state.toolbarPosition,
        sidebarWidth: state.sidebarWidth,
        aiSidebarWidth: state.aiSidebarWidth,
        mixedLayoutSplit: state.mixedLayoutSplit,
        isFullWidth: state.isFullWidth,
        appStyle: state.appStyle,
        dashboardLayout: state.dashboardLayout,
        defaultDashboardLayout: state.defaultDashboardLayout,
        aiMessages: state.aiMessages.slice(-20), // Only persist the last 20 messages to keep disk footprint low
        aiBehaviorMode: state.aiBehaviorMode,
        aiApiKey: state.aiApiKey,
        copiedBlock: state.copiedBlock,
        sidebarSectionSettings: state.sidebarSectionSettings,
        hiddenEntityIds: state.hiddenEntityIds,
        recentEntityIds: state.recentEntityIds,
        activeMode: state.activeMode,
        activeIntentTag: state.activeIntentTag,
        activeChatId: state.activeChatId,
        chatHistoryOpen: state.chatHistoryOpen,
      }),
    }
  )
);
