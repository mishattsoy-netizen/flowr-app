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
import { upsertCanvasBlock, deleteCanvasBlock as deleteCanvasBlockFromDB } from '@/lib/canvasSync';
import { computeAutoLayout } from '@/lib/frameLayout';
import { generateGroupId } from '@/lib/groupUtils';

// Re-export all types so all consumers import paths remain valid
export type {
  EntityType, BlockStyle, BlockType, EditorBlock,
  WidgetType, WidgetSize, WidgetConfig, Entity, AppTask, SettingsTab, ModalType,
  EditingSource, AIAttachment, AIMessage, AICursor, ModelStatus,
  PriorityModel, ProjectQuota, FlowIntentCategory, FlowRouterModel,
  FlowRouterCategory, FlowRouterConfig, CloudModel, AIRequestLog, AppState,
  WorkspaceType, Workspace, SidebarSectionId, SidebarSectionSettings, SortMode,
  BotMode, ShapeKind, CanvasStyleExt, ArrowBinding, ArrowheadStyle, ArrowheadType,
  FrameLayoutDirection, FrameResizeMode, ChildResizeMode,
} from './store.types';

// Re-export helpers needed by external consumers
export { generateId, robustParseJSON, blocksToMarkdown } from './store.helpers';

// Internal type imports (used within this file's store implementation)
import type {
  Entity, EditorBlock, AIMessage,
  AppState, Workspace, WidgetConfig, AppTask, BotMode,
  FrameLayoutDirection, FrameResizeMode, ChildResizeMode,
} from './store.types';


import {
  generateId, getDescendantIds, validateNoteContent,
  robustParseJSON, markdownToBlocks, blocksToMarkdown
} from './store.helpers';
import { isDesktop } from '@/lib/env';
import { saveEntityToFile } from '@/lib/persistence';


function migrateBlock(block: any): any {
  // Migrate 'section' → 'frame'
  if (block.type === 'section') {
    return { ...block, type: 'frame' };
  }

  if (block.type === 'shape' && (block.shapeKind === 'arrow' || block.shapeKind === 'line' || block.shapeKind === 'freedraw')) {
    if (block.editMode) return block;
    return {
      ...block,
      editMode: 'simple',
      startArrowhead: block.shapeKind === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
      endArrowhead: block.shapeKind === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
    };
  }

  if (block.type === 'connection') {
    const { fromId, toId, fromSide, toSide, ...rest } = block;
    const kind = rest.shapeKind || 'arrow';
    return {
      ...rest,
      type: 'shape',
      shapeKind: kind,
      editMode: 'simple',
      startBinding: fromId ? { blockId: fromId } : undefined,
      endBinding: toId ? { blockId: toId } : undefined,
      points: rest.points ? rest.points.slice(1, -1) : [],
      startArrowhead: kind === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
      endArrowhead: kind === 'arrow' ? { type: 'filled-triangle', size: 1 } : { type: 'none' },
    };
  }

  return block;
}

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

const SYSTEM_ROUTES = ['chat', 'dashboard', 'tracker', 'settings'];

const getChatSessionId = (
  activeChatId: string | null,
  activeEntityId: string | null,
  fallback: string
) => {
  if (activeChatId) return activeChatId;
  if (activeEntityId && !SYSTEM_ROUTES.includes(activeEntityId)) {
    return activeEntityId;
  }
  return fallback;
};

const TEMP_CHAT_GREETINGS = [
  "Write like nobody's listening.",
  "Off the record?",
  "This conversation doesn't exist.",
  "Gone tomorrow.",
  "Just between us.",
  "Self-destruct sequence ready.",
  "No strings attached.",
  "Here for a good time.",
  "Whisper mode.",
  "Under the radar.",
  "For your eyes only.",
  "Off the books.",
  "Leave no trace.",
  "No history, no worries.",
  "Speakeasy mode.",
  "Ghost mode.",
  "Make it brief.",
  "Passing thoughts.",
  "Written on water.",
  "Noted and forgotten."
];

function getRandomTempGreeting() {
  const idx = Math.floor(Math.random() * TEMP_CHAT_GREETINGS.length);
  return TEMP_CHAT_GREETINGS[idx];
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      entities: [
        { id: 'c1', title: 'Collection 1', type: 'collection', parentId: null, lastModified: initialTime, icon: 'Folder', workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'c2', title: 'Collection 2', type: 'collection', parentId: null, lastModified: initialTime - oneDayMs * 2, icon: 'Briefcase', workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'f1', title: 'Folder 1', type: 'folder', parentId: 'c1', lastModified: initialTime - oneDayMs, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'cv1', title: 'Canvas 1', type: 'canvas', parentId: 'f1', lastModified: initialTime - 500000, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'n1', title: 'Notes 1', type: 'note', parentId: 'c2', lastModified: initialTime - 100000, tags: ['research', 'draft'], workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 'm1', title: 'Mixed 1', type: 'mixed', parentId: 'c1', lastModified: initialTime, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
      ],

      tasks: [
        { id: 't1', title: 'Review mockups', completed: false, dueDate: new Date(Date.now() - oneDayMs).toISOString().split('T')[0], entityId: 'cv1', color: '#EF4444', workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 't2', title: 'Outline next week', completed: true, dueDate: new Date().toISOString().split('T')[0], entityId: 'n1', workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 't3', title: 'Design review meeting', completed: false, dueDate: new Date(Date.now() + oneDayMs).toISOString().split('T')[0], entityId: null, color: '#3B82F6', workspaceId: 'ws-personal', syncMode: 'cloud-only' },
        { id: 't4', title: 'Prepare assets', completed: false, dueDate: new Date().toISOString().split('T')[0], entityId: null, workspaceId: 'ws-personal', syncMode: 'cloud-only' },
      ],

      blocks: [
        { id: 'b1', type: 'text', content: 'Explore unified navigation.', x: 100, y: 100, canvasId: 'cv1' },
      ],

      workspaces: [
        {
          id: 'ws-personal',
          name: 'Personal',
          type: 'personal' as const,
          ownerId: null,
          createdAt: initialTime,
          syncMode: 'cloud-only',
        },
      ],
      activeWorkspaceId: 'ws-personal',
      trackerFilterWorkspace: null,
      lastSaved: null,
      syncMode: 'local-only',
      isInitialSync: true,

      setInitialSync: (isInitialSync) => set({ isInitialSync }),

      setSyncMode: (entityId, mode) => set(s => ({
        entities: s.entities.map(e => e.id === entityId ? { ...e, syncMode: mode, lastModified: Date.now() } : e)
      })),
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
      selectedTaskIds: [],
      taskContextMenu: null,
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
      isTabsHeaderVisible: true,
      appStyle: 'v3',
      dashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
      defaultDashboardLayout: DEFAULT_DASHBOARD_LAYOUT,
      isDashboardEditing: false,
      aiMessages: [],
      aiApiKey: null,
      imageProvider: (typeof window !== 'undefined' && localStorage.getItem('flowr_image_provider') as 'pollinations' | 'puter') || 'pollinations',
      isAIAssistantOpen: false,
      activeChatId: null,
      newEmptyChatId: null,
      isTempChat: true,
      pendingNewChat: false,
      showTempNotice: true,
      tempChatMessages: [],
      chatHistoryOpen: true,
      chatConversations: [],
      tempChatGreeting: "Write like nobody's listening.",
      isAIAssistantExtended: true,
      isAILoading: false,
      aiCursor: null,
      aiBehaviorMode: (typeof window !== 'undefined' && localStorage.getItem('flowr_ai_behavior') as 'fast' | 'thinking' | 'auto') || 'auto',
      aiClassificationModelId: (typeof window !== 'undefined' && localStorage.getItem('flowr_ai_classification_model')) || '',
      aiAbortController: null,
      sidebarSectionSettings: {
        pinned: { sortMode: 'lastModified', itemLimit: 20 },
        unsorted: { sortMode: 'lastModified', itemLimit: 20 },
        workspaces: { sortMode: 'lastModified', itemLimit: 20 },
      },
      trackerColumnSortModes: {
        todo: 'automatic',
        inProgress: 'automatic',
        today: 'automatic',
        overdue: 'automatic',
        completed: 'recently_added'
      },
      trackerColumnSortLocks: {},
      hiddenEntityIds: [],
      isCommandPaletteOpen: false,
      selectedSidebarIds: [],
      aiSessionContext: null,
      activeMode: 'default' as BotMode,
      activeIntentTag: null,
      activeReplyMessage: null,
      assistantInput: "",
      thinkingEnabled: false,
      advisorEnabled: false,
      pendingAdvisorState: null,
      showPaidModels: false,
      pendingCompaction: false,
      isCompacting: false,
      chatInputs: {},
      loadingStatesMap: {},
      abortControllersMap: {},
      chatMessagesMap: {},
      sessionContextsMap: {},

      // ─── Actions ─────────────────────────────────────────
      setDashboardLayout: (layout) => set({ dashboardLayout: layout }),
      setIsDashboardEditing: (editing) => set({ isDashboardEditing: editing }),
      resetDashboardLayout: () => set((s) => ({ dashboardLayout: s.defaultDashboardLayout })),

      stopAIGeneration: () => {
        const { activeChatId, activeEntityId, isTempChat, abortControllersMap } = get();
        const sid = getChatSessionId(activeChatId, activeEntityId, isTempChat ? 'temp' : 'global');
        const controller = abortControllersMap[sid];
        if (controller) {
          controller.abort();
        }
        set(s => ({
          isAILoading: false,
          aiAbortController: null,
          loadingStatesMap: { ...s.loadingStatesMap, [sid]: false },
          abortControllersMap: { ...s.abortControllersMap, [sid]: null },
          aiCursor: null
        }));
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
      toggleTabsHeader: () => set((state) => ({ isTabsHeaderVisible: !state.isTabsHeaderVisible })),
      setAppStyle: (appStyle) => set({ appStyle }),

      setWorkspaces: (workspaces) => set({ workspaces }),

      setActiveWorkspaceId: (id) => {
        set({ activeWorkspaceId: id });
        if (id && id !== 'dashboard') {
          const nextRecent = [id, ...get().recentEntityIds.filter(rid => rid !== id)].slice(0, 8);
          set({ recentEntityIds: nextRecent });
        }
      },

      setTrackerFilterWorkspace: (id) => {
        set({ trackerFilterWorkspace: id });
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
          syncMode: 'cloud-only',
        };
        set(s => ({ workspaces: [...s.workspaces, workspace] }));
        upsertWorkspace(workspace);
        return id;
      },

      updateWorkspace: (id, patch) => {
        set(s => ({
          workspaces: s.workspaces.map(w => w.id === id ? { ...w, ...patch } : w),
        }));
        const updated = get().workspaces.find(w => w.id === id);
        if (updated) upsertWorkspace(updated);
      },

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
        let sessionData: any = null
        try {
          const res = await fetch(`/api/ai/memory/context?chatId=${encodeURIComponent(chatId)}&t=${Date.now()}`);
          if (res.ok) sessionData = await res.json();
        } catch (err) {
          console.error('Failed to fetch session context:', err);
        }
        // Always fetch live compaction config separately to guarantee correct context_limit
        try {
          const configRes = await fetch(`/api/ai/config?t=${Date.now()}`);
          if (configRes.ok) {
            const config = await configRes.json();
            sessionData = { ...sessionData, ...config };
          }
        } catch (err) {
          console.error('Failed to fetch compaction config:', err);
        }
        if (sessionData) {
          set(s => ({
            aiSessionContext: sessionData,
            sessionContextsMap: { ...s.sessionContextsMap, [chatId]: sessionData }
          }));
        }
      },

      cleanupActiveChatIfEmpty: async () => {
        const { activeChatId, isTempChat, newEmptyChatId } = get();
        if (activeChatId && !isTempChat && activeChatId === newEmptyChatId) {
          const msgs = get().chatMessagesMap[activeChatId] || get().aiMessages;
          const hasMessages = msgs && msgs.some(m => m.role === 'user' || m.role === 'assistant');
          if (!hasMessages) {
            console.log(`[Store] Cleaning up empty chat: ${activeChatId}`);
            try {
              await deleteConversationFromDB(activeChatId);
            } catch (err: any) {
              console.error('Failed to delete empty conversation from DB:', err?.message || err?.details || err);
            }
            set(s => ({
              chatConversations: s.chatConversations.filter(c => c.id !== activeChatId),
              activeChatId: null,
              newEmptyChatId: null,
              aiMessages: [],
              tempChatMessages: [],
              aiSessionContext: null,
            }));
          }
        }
      },

      clearAIChat: async () => {
        const { activeEntityId, activeChatId, isTempChat, fetchAISessionContext } = get();
        const sid = getChatSessionId(activeChatId, activeEntityId, isTempChat ? 'temp' : 'global');
        set(s => ({
          aiMessages: [],
          tempChatMessages: [],
          aiSessionContext: null,
          activeMode: 'default',
          activeIntentTag: null,
          pendingAdvisorState: null,
          tempChatGreeting: s.isTempChat ? getRandomTempGreeting() : s.tempChatGreeting,
          chatMessagesMap: {
            ...s.chatMessagesMap,
            [sid]: []
          },
          sessionContextsMap: {
            ...s.sessionContextsMap,
            [sid]: null
          }
        }));
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }
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
      setShowTempNotice: (show) => set({ showTempNotice: show }),

      startTempChat: async () => {
        await get().cleanupActiveChatIfEmpty();
        const sid = 'temp';
        
        // If already in temp chat, click should clear it
        if (get().isTempChat && get().activeChatId === null && get().activeEntityId === 'chat') {
          await get().clearAIChat();
          return;
        }

        set(s => ({
          activeChatId: null,
          newEmptyChatId: null,
          isTempChat: true,
          pendingNewChat: false,
          showTempNotice: true,
          tempChatMessages: [],
          aiMessages: [],
          aiSessionContext: null,
          pendingAdvisorState: null,
          assistantInput: '',
          isAILoading: false,
          aiAbortController: null,
          tempChatGreeting: getRandomTempGreeting(),
          chatMessagesMap: {
            ...s.chatMessagesMap,
            [sid]: []
          },
          sessionContextsMap: {
            ...s.sessionContextsMap,
            [sid]: null
          },
          chatInputs: {
            ...s.chatInputs,
            [sid]: ''
          }
        }));

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }
          await fetch('/api/ai/memory/clear', { 
            method: 'POST', 
            headers,
            body: JSON.stringify({ activeEntityId: sid }) 
          });
        } catch (err) {
          console.error('Failed to clear server-side memory for temp chat:', err);
        }
      },

      startNewChat: async () => {
        await get().cleanupActiveChatIfEmpty();
        set({
          activeChatId: null,
          newEmptyChatId: null,
          isTempChat: false,
          pendingNewChat: true,
          tempChatMessages: [],
          aiMessages: [],
          aiSessionContext: null,
          pendingAdvisorState: null,
          assistantInput: '',
          isAILoading: false,
          aiAbortController: null,
        });
      },

      loadConversation: async (id: string) => {
        await get().cleanupActiveChatIfEmpty();

        // If the chat is currently generating, DO NOT fetch/overwrite messages from database.
        // This preserves the active streaming status.
        const isGenerating = get().loadingStatesMap[id] || false;
        if (isGenerating) {
          set({
            activeChatId: id,
            isTempChat: false,
            pendingNewChat: false,
            tempChatMessages: [],
            aiMessages: get().chatMessagesMap[id] || [],
            aiSessionContext: get().sessionContextsMap[id] || null,
            pendingAdvisorState: null,
            assistantInput: get().chatInputs[id] || '',
            isAILoading: true,
            aiAbortController: get().abortControllersMap[id] || null,
          });
          return;
        }

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
            attachments: m.attachments,
          }));
          set(s => ({
            activeChatId: id,
            isTempChat: false,
            pendingNewChat: false,
            tempChatMessages: [],
            aiMessages: aiMsgs,
            chatMessagesMap: { ...s.chatMessagesMap, [id]: aiMsgs },
            aiSessionContext: s.sessionContextsMap[id] || null,
            pendingAdvisorState: null,
            assistantInput: s.chatInputs[id] || '',
            isAILoading: false,
            aiAbortController: null,
          }));
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
            set({ activeChatId: null, isTempChat: true, aiMessages: [], tempChatMessages: [], aiSessionContext: null });
          }
        } catch (e: any) {
          console.error('Failed to delete conversation:', e?.message || e?.details || e);
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
          const { activeChatId } = get();
          const toDelete: string[] = [];
          
          const filtered = convs.filter(c => {
            const hasMessages = c.messages && c.messages.length > 0;
            const isActive = c.id === activeChatId;
            if (!hasMessages && !isActive) {
              toDelete.push(c.id);
              return false;
            }
            return true;
          });

          const cleanConvs = filtered.map(({ messages, ...rest }) => rest);
          set({ chatConversations: cleanConvs });

          if (toDelete.length > 0) {
            console.log(`[Store] Background cleaning up ${toDelete.length} empty conversations:`, toDelete);
            Promise.all(toDelete.map(id => deleteConversationFromDB(id))).catch(err => {
              console.error('Failed background cleanup of empty conversations:', err);
            });
          }
        } catch (e) {
          console.error('Failed to load conversations', e);
        }
      },

      saveTempChat: async () => {
        const { aiMessages, chatConversations, aiSessionContext } = get()
        try {
          const conv = await createConversation('New Chat')
          if (!conv) {
            console.warn('Cannot save temp chat — not authenticated')
            return
          }
          const userAndAssistant = aiMessages.filter(m => m.role === 'user' || m.role === 'assistant')
          for (const m of userAndAssistant) {
            await insertMessage(conv.id, m.role as 'user' | 'assistant', m.content || '', m.model, undefined, m.image_description, undefined, m.attachments)
          }
          // Carry over accumulated session summary to the new conversation
          if (aiSessionContext?.distilled_summary) {
            await fetch('/api/ai/memory/summary', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId: conv.id, summary: aiSessionContext.distilled_summary })
            }).catch(() => {})
          }
          // Auto-title from first user message
          const firstUser = userAndAssistant.find(m => m.role === 'user')
          if (firstUser?.content) {
            const title = firstUser.content.slice(0, 60)
            await updateConversationTitle(conv.id, title)
            conv.title = title
          }
          set({
            activeChatId: conv.id,
            isTempChat: false,
            tempChatMessages: [],
            chatConversations: [conv, ...chatConversations],
          })
          get().fetchAISessionContext(conv.id)
        } catch (e) {
          console.error('Failed to save temp chat', e)
        }
      },

      openChatInPage: () => {
        get().setActiveEntityId('chat');
      },

      compactAIChat: async () => {
        const { activeEntityId, activeChatId, fetchAISessionContext, isAILoading } = get();
        if (isAILoading) {
          set({ pendingCompaction: true });
          return;
        }
        set({ isCompacting: true });
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }
          const sid = getChatSessionId(activeChatId, activeEntityId, 'global');
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
        } finally {
          set({ isCompacting: false });
        }
      },

      finishAILoading: async (chatId) => {
        const { activeChatId, activeEntityId, isTempChat } = get();
        const sid = chatId || getChatSessionId(activeChatId, activeEntityId, isTempChat ? 'temp' : 'global');
        const currentActiveId = getChatSessionId(activeChatId, activeEntityId, isTempChat ? 'temp' : 'global');
        const isActive = !chatId || chatId === currentActiveId;
        set(s => ({
          isAILoading: isActive ? false : s.isAILoading,
          aiAbortController: isActive ? null : s.aiAbortController,
          loadingStatesMap: { ...s.loadingStatesMap, [sid]: false },
          abortControllersMap: { ...s.abortControllersMap, [sid]: null }
        }));
        const { pendingCompaction, compactAIChat } = get();
        if (pendingCompaction) {
          set({ pendingCompaction: false });
          await compactAIChat();
        }
      },
      setAIHistory: (messages) => set({ aiMessages: messages }),
      setIsAIAssistantExtended: (extended) => set({ isAIAssistantExtended: extended }),
      setAICursor: (aiCursor) => set({ aiCursor }),

      toggleAIAssistantExtended: () => {},
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
      setPendingAdvisorState: (state) => set({ pendingAdvisorState: state }),
      setActiveIntentTag: (tag) => set({ activeIntentTag: tag }),
      setReplyMessage: (msg) => set({ activeReplyMessage: msg }),
      setShowPaidModels: (show) => set({ showPaidModels: show }),
      setAssistantInput: (input) => {
        const { activeChatId, activeEntityId, isTempChat } = get();
        const sid = getChatSessionId(activeChatId, activeEntityId, isTempChat ? 'temp' : 'global');
        set(s => ({
          assistantInput: input,
          chatInputs: { ...s.chatInputs, [sid]: input }
        }));
      },

      sendAIMessage: async (content, attachments = [], pageContext) => {
        // Create pending new chat on first message
        if (get().pendingNewChat) {
          const conv = await createConversation('New Chat');
          if (conv) {
            const title = content.slice(0, 60);
            await updateConversationTitle(conv.id, title);
            conv.title = title;
            set({
              activeChatId: conv.id,
              newEmptyChatId: null,
              pendingNewChat: false,
              isTempChat: false,
              chatConversations: [conv, ...get().chatConversations],
            });
            await get().fetchAISessionContext(conv.id);
          } else {
            set({ pendingNewChat: false, isTempChat: true });
          }
        }

        const { aiMessages, activeReplyMessage } = get();
        const isTemp = get().isTempChat;
        const activeChatId = get().activeChatId;
        const activeEntityId = get().activeEntityId;
        const activeWorkspaceId = get().activeWorkspaceId;
        const aiApiKey = get().aiApiKey;
        const aiClassificationModelId = get().aiClassificationModelId;
        const activeMode = get().activeMode;
        const activeIntentTag = get().activeIntentTag;
        const pendingState = get().pendingAdvisorState;
        const thinkingEnabled = get().thinkingEnabled;
        const advisorEnabled = get().advisorEnabled;
        const targetChatId = getChatSessionId(activeChatId, activeEntityId, isTemp ? 'temp' : 'global');

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

        set(s => {
          const updated = [...(s.chatMessagesMap[targetChatId] || s.aiMessages), userMessage, placeholderMessage];
          const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.isTempChat ? 'temp' : 'global');
          const isActive = currentActiveId === targetChatId;
          return {
            chatMessagesMap: {
              ...s.chatMessagesMap,
              [targetChatId]: updated
            },
            ...(isActive ? { aiMessages: updated } : {}),
            ...(isTemp ? { tempChatMessages: updated } : {}),
            newEmptyChatId: null,
            activeReplyMessage: null,
            isAILoading: true,
            loadingStatesMap: { ...s.loadingStatesMap, [targetChatId]: true }
          };
        });

        // Persist user message if in a named conversation
        if (activeChatId && !isTemp) {
          insertMessage(activeChatId, 'user', content, undefined, undefined, undefined, undefined, attachments).catch(e => console.warn('[Store] Failed to persist user message:', e));
        }

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };

          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }

          // Resolve any public paths in attachments to base64 strings on-the-fly for vision payload
          const resolvedAttachments = await Promise.all(
            attachments.map(async (att) => {
              if (att.url && att.url.startsWith('/') && !att.url.startsWith('data:')) {
                try {
                  const absoluteUrl = `${window.location.origin}${att.url}`;
                  const res = await fetch(absoluteUrl);
                  const blob = await res.blob();
                  const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  });
                  return { ...att, url: base64 };
                } catch (e) {
                  console.error('Failed to resolve attachment to base64:', att.url, e);
                  return att;
                }
              }
              return att;
            })
          );

          // Handle vision / PDF: extract all image/pdf attachments as base64 array
          const imageAttachments = resolvedAttachments.filter(a => (a.type === 'image' || a.type === 'pdf') && a.url?.startsWith('data:'));
          const imageBuffers: string[] = imageAttachments.map(a => a.url.split(',')[1]);
          const imageBuffer: string | undefined = imageBuffers[0];
          const imagesArray: string[] | undefined = imageBuffers.length > 1 ? imageBuffers : undefined;

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
            .map(m => {
              let text = stripHeavyMedia(m.content || '', m.image_description)
              // Inject full digital twin into user message text so non-vision chains
              // have complete image context in clientHistory
              if (m.role === 'user' && m.image_description) {
                text = `${text}\n\n[VISION CONTEXT - DIGITAL TWIN]\n${m.image_description}`.trim()
              } else if (m.role === 'user' && !m.image_description && m.attachments?.some(a => a.type === 'image' || a.type === 'pdf')) {
                text = `${text}\n[Image attached]`.trim()
              }
              return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text }] }
            })

          const controller = new AbortController();
          set(s => ({
            aiAbortController: s.activeChatId === targetChatId || (!s.activeChatId && targetChatId === 'temp' && s.isTempChat) ? controller : s.aiAbortController,
            abortControllersMap: { ...s.abortControllersMap, [targetChatId]: controller }
          }));

          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              prompt: content,
              buffer: imageBuffer,
              images: imagesArray,
              activeEntityId,
              activeChatId,
              aiApiKey,
              activeWorkspaceId,
              classificationModelId: aiClassificationModelId,
              mode: activeMode,
              intentTag: activeIntentTag ?? null,
              replyContext,
              thinkingEnabled,
              advisorEnabled,
              pendingAdvisorState: pendingState,
              isTempChat: isTemp,
              clientHistory: historyMessages,
              pageContext: pageContext ?? null,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            set(s => {
              const updated = (s.chatMessagesMap[targetChatId] || []).map(m => m.id === placeholderMessage.id
                ? { ...m, content: err.error || 'Something went wrong.', model: err.model || 'system' }
                : m
              );
              const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.isTempChat ? 'temp' : 'global');
              const isActive = currentActiveId === targetChatId;
              return {
                chatMessagesMap: { ...s.chatMessagesMap, [targetChatId]: updated },
                ...(isActive ? { aiMessages: updated } : {}),
                ...(isTemp ? { tempChatMessages: updated } : {})
              };
            });
            await get().finishAILoading(targetChatId);
            return;
          }

          const isStream = res.headers.get('Content-Type')?.includes('text/event-stream');
          if (isStream) {
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let sseBuffer = '';
            let lastModel = '';
            let lastPipelineSteps: any = undefined;
            let lastImageDescription: string | undefined = undefined;
            let lastImagePrompt: string | undefined = undefined;
            let lastClassificationTrace: any = undefined;
            let lastRoutingTrace: any = undefined;
            let lastLogId: any = undefined;
            let lastCitations: any = undefined;
            let lastTranscriptMd: any = undefined;
            let lastToolResults: any = undefined;
            let lastAdvisorQuestions: string | undefined = undefined;
            let lastAdvisorState: string | undefined = undefined;

            if (reader) {
              let flushTimer: ReturnType<typeof setTimeout> | null = null;
              let pendingContent = '';

              const flushUpdate = () => {
                flushTimer = null;
                const contentToSet = pendingContent;
                set((s) => {
                  const updatedMessages = (s.chatMessagesMap[targetChatId] || []).map((m) =>
                    m.id === placeholderMessage.id
                  ? {
                      ...m,
                      content: contentToSet,
                      model: lastModel || m.model,
                      tokens_used: Math.ceil((content.length + contentToSet.length) / 4),
                      image_description: lastImageDescription ?? m.image_description,
                      image_prompt: lastImagePrompt ?? (m as any).image_prompt,
                      model_chain: (m as any).model_chain,
                      pipelineSteps: lastPipelineSteps ?? m.pipelineSteps,
                      classification_trace: lastClassificationTrace ?? m.classification_trace,
                      routing_trace: lastRoutingTrace ?? m.routing_trace,
                      logId: lastLogId ?? m.logId,
                      citations: lastCitations ?? m.citations,
                      transcript_md: lastTranscriptMd ?? (m as any).transcript_md,
                      toolResults: lastToolResults ?? (m as any).toolResults,
                      advisor_questions: lastAdvisorQuestions ?? (m as any).advisor_questions,
                      advisor_state: lastAdvisorState ?? (m as any).advisor_state,
                    }
                      : m
                  );
                  const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.isTempChat ? 'temp' : 'global');
                  const isActive = currentActiveId === targetChatId;
                  return {
                    chatMessagesMap: { ...s.chatMessagesMap, [targetChatId]: updatedMessages },
                    ...(isActive ? { aiMessages: updatedMessages } : {}),
                    ...(isTemp ? { tempChatMessages: updatedMessages } : {}),
                  };
                });
              };

              let isStreamDone = false;
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
                    if (data === '[DONE]') {
                      isStreamDone = true;
                      break;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.error) {
                        accumulatedContent = parsed.error;
                        pendingContent = parsed.error;
                        lastModel = parsed.model || 'system';
                        isStreamDone = true;
                        flushUpdate();
                        break;
                      } else if (parsed.content) {
                        const isFinalMetadata = parsed.type !== undefined;
                        if (isFinalMetadata && accumulatedContent.length > 0) {
                          // Final metadata with streamed content before it — skip to avoid double
                        } else {
                          // Streaming chunk, or final metadata with no prior stream (e.g. advisor)
                          accumulatedContent = isFinalMetadata ? parsed.content : accumulatedContent + parsed.content;
                          pendingContent = accumulatedContent;

                          if (!flushTimer) {
                            flushTimer = setTimeout(flushUpdate, 50);
                          }
                        }

                        // Capture metadata for persistence (runs for both streaming and final)
                        if (parsed.model) lastModel = parsed.model;
                        if (parsed.pipeline_steps) lastPipelineSteps = parsed.pipeline_steps;
                        if (parsed.image_description) lastImageDescription = parsed.image_description;
                        if ((parsed as any).image_prompt) lastImagePrompt = (parsed as any).image_prompt;
                        if (parsed.classification_trace) lastClassificationTrace = parsed.classification_trace;
                        if (parsed.routing_trace) lastRoutingTrace = parsed.routing_trace;
                        if (parsed.log_id) lastLogId = parsed.log_id;
                        if (parsed.citations) lastCitations = parsed.citations;
                        if ((parsed as any).transcript_md) lastTranscriptMd = (parsed as any).transcript_md;
                        if ((parsed as any).toolResults) lastToolResults = (parsed as any).toolResults;
                        if ((parsed as any).advisor_questions) lastAdvisorQuestions = (parsed as any).advisor_questions;
                        if ((parsed as any).advisor_state) lastAdvisorState = (parsed as any).advisor_state;
                      } else if (parsed.status) {
                        set((s) => {
                          const updated = (s.chatMessagesMap[targetChatId] || []).map((m) =>
                            m.id === placeholderMessage.id
                              ? { ...m, status: parsed.status }
                              : m
                          );
                          const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.isTempChat ? 'temp' : 'global');
                          const isActive = currentActiveId === targetChatId;
                          return {
                            chatMessagesMap: { ...s.chatMessagesMap, [targetChatId]: updated },
                            ...(isActive ? { aiMessages: updated } : {}),
                            ...(isTemp ? { tempChatMessages: updated } : {}),
                          };
                        });
                      }
                    } catch (e) {
                      // ignore parse errors
                    }
                  }
                }
                if (isStreamDone) break;
              }
              // Final flush: ensure all accumulated content is rendered
              if (flushTimer) clearTimeout(flushTimer);
              if (!accumulatedContent) {
                accumulatedContent = 'No response received from the server. Please try again.';
                pendingContent = accumulatedContent;
                lastModel = 'system';
              }
              pendingContent = accumulatedContent;
              flushUpdate();
            }
            // Handle advisor state update after stream completes
            if (lastAdvisorState) {
              try {
                const advisorStateJson = JSON.parse(lastAdvisorState);
                if (advisorStateJson.phase === 'planning') {
                  set({ pendingAdvisorState: advisorStateJson });
                } else {
                  set({ pendingAdvisorState: null });
                }
              } catch (e) {
                set({ pendingAdvisorState: null });
              }
            }
            await get().finishAILoading(targetChatId);
            // Backfill image_description onto the user message so future history
            // turns can reference what was in the image, even for non-vision chains
            if (lastImageDescription) {
              set(s => {
                const updated = (s.chatMessagesMap[targetChatId] || []).map(m =>
                  m.id === userMessage.id ? { ...m, image_description: lastImageDescription } : m
                );
                const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.isTempChat ? 'temp' : 'global');
                const isActive = currentActiveId === targetChatId;
                return {
                  chatMessagesMap: { ...s.chatMessagesMap, [targetChatId]: updated },
                  ...(isActive ? { aiMessages: updated } : {}),
                  ...(isTemp ? { tempChatMessages: updated } : {}),
                };
              });
            }
            // Skip persistence for advisor planning messages (not final content)
            if (lastAdvisorQuestions && lastAdvisorState) {
              try {
                const advState = JSON.parse(lastAdvisorState);
                if (advState.phase === 'planning') return;
              } catch (e) { /* ignore parse errors */ }
            }
            // Persist assistant reply
            if (activeChatId && !isTemp && accumulatedContent) {
              insertMessage(activeChatId, 'assistant', accumulatedContent, lastModel, lastPipelineSteps, lastImageDescription, lastImagePrompt).catch(e => console.warn('[Store] Failed to persist assistant message:', e));
              // Auto-set title from first message if still default
              const conv = get().chatConversations.find(c => c.id === activeChatId);
              if (conv && conv.title === 'New Chat' && content) {
                const title = content.slice(0, 60);
                get().renameChatConversation(activeChatId, title);
              }
            }
            return;
          }

          const data = await res.json();
          set(s => {
            const updated = (s.chatMessagesMap[targetChatId] || []).map(m => {
              if (m.id === placeholderMessage.id) return {
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
              // Backfill image_description onto the user message for future history context
              if (m.id === userMessage.id && data.image_description) return { ...m, image_description: data.image_description }
              return m
            });
            const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.isTempChat ? 'temp' : 'global');
            const isActive = currentActiveId === targetChatId;
            return {
              chatMessagesMap: { ...s.chatMessagesMap, [targetChatId]: updated },
              ...(isActive ? { aiMessages: updated } : {}),
              ...(isTemp ? { tempChatMessages: updated } : {}),
            };
          });
          await get().finishAILoading(targetChatId);

          // Persist non-streaming assistant reply
          if (activeChatId && !isTemp && data.content) {
            insertMessage(activeChatId, 'assistant', data.content, data.model, data.pipeline_steps, data.image_description, data.image_prompt).catch(e => console.warn('[Store] Failed to persist non-stream assistant message:', e));
            // Auto-set title from first message if still default
            const conv = get().chatConversations.find(c => c.id === activeChatId);
            if (conv && conv.title === 'New Chat' && content) {
              const title = content.slice(0, 60);
              get().renameChatConversation(activeChatId, title);
            }
          }
        } catch (e: any) {
          if (e?.name === 'AbortError') {
            const interruptedContent = 'Generation stopped by user.';
            set(s => {
              const updated = (s.chatMessagesMap[targetChatId] || []).map(m =>
                m.id === placeholderMessage.id
                  ? { ...m, content: interruptedContent, interrupted: true }
                  : m
              );
              const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.isTempChat ? 'temp' : 'global');
              const isActive = currentActiveId === targetChatId;
              return {
                chatMessagesMap: { ...s.chatMessagesMap, [targetChatId]: updated },
                ...(isActive ? { aiMessages: updated } : {}),
                ...(isTemp ? { tempChatMessages: updated } : {}),
              };
            });
            await get().finishAILoading(targetChatId);
            if (activeChatId && !isTemp) {
              insertMessage(activeChatId, 'assistant', interruptedContent).catch(e => console.warn('[Store] Failed to persist interrupted message:', e));
            }
          } else {
            const errMsg = e?.message ? `Connection error: ${e.message}. Please check your connection and try again.` : 'Connection error. Please try again.';
            set(s => {
              const updated = (s.chatMessagesMap[targetChatId] || []).map(m => m.id === placeholderMessage.id
                ? { ...m, content: errMsg, model: 'system' }
                : m
              );
              const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.isTempChat ? 'temp' : 'global');
              const isActive = currentActiveId === targetChatId;
              return {
                chatMessagesMap: { ...s.chatMessagesMap, [targetChatId]: updated },
                ...(isActive ? { aiMessages: updated } : {}),
                ...(isTemp ? { tempChatMessages: updated } : {}),
              };
            });
            await get().finishAILoading(targetChatId);
          }
        }
      },

      setVariantIndex: (messageId, index) => {
        set(s => ({
          aiMessages: s.aiMessages.map(m => {
            if (m.id !== messageId) return m;
            const all = m.variants ?? [];
            const clamped = Math.max(0, Math.min(index, all.length - 1));
            return { ...m, content: all[clamped], variantIndex: clamped };
          }),
        }));
      },

      regenerateAIMessage: async (messageId, userContent, userAttachments = []) => {
        const { aiMessages } = get();
        const targetMsg = aiMessages.find(m => m.id === messageId);
        if (!targetMsg) return;

        // Build ordered variants array: existing variants (or seed with current content), then append empty slot for new answer
        const existingVariants = targetMsg.variants && targetMsg.variants.length > 0
          ? targetMsg.variants
          : [targetMsg.content ?? ''];
        const newVariants = [...existingVariants, ''];
        const newIndex = newVariants.length - 1;

        set(s => ({
          aiMessages: s.aiMessages.map(m =>
            m.id === messageId
              ? { ...m, content: '', variants: newVariants, variantIndex: newIndex, interrupted: false }
              : m
          ),
          newEmptyChatId: null,
          isAILoading: true,
        }));

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
          }

          // Resolve any public paths in attachments to base64 strings on-the-fly for vision payload
          const resolvedAttachments = await Promise.all(
            userAttachments.map(async (att) => {
              if (att.url && att.url.startsWith('/') && !att.url.startsWith('data:')) {
                try {
                  const absoluteUrl = `${window.location.origin}${att.url}`;
                  const res = await fetch(absoluteUrl);
                  const blob = await res.blob();
                  const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  });
                  return { ...att, url: base64 };
                } catch (e) {
                  console.error('Failed to resolve attachment to base64:', att.url, e);
                  return att;
                }
              }
              return att;
            })
          );

          const imageAttachments = resolvedAttachments.filter(a => (a.type === 'image' || a.type === 'pdf') && a.url?.startsWith('data:'));
          const imageBuffers: string[] = imageAttachments.map(a => a.url.split(',')[1]);
          const imageBuffer: string | undefined = imageBuffers[0];
          const imagesArray: string[] | undefined = imageBuffers.length > 1 ? imageBuffers : undefined;

          const stripHeavyMedia = (text: string, imageDescription?: string) => {
            if (!text) return '';
            if (!text.includes('data:image/')) return text;
            const placeholder = imageDescription ? `[Image: ${imageDescription}]` : '[Image: (visual content generated)]';
            return text.replace(/!\[.*?\]\s*\(\s*data:image\/.*?;base64,[\s\S]*?\)/g, placeholder);
          };

          const historyMessages = aiMessages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => {
              let text = stripHeavyMedia(m.content || '', m.image_description);
              if (m.role === 'user' && m.image_description) {
                text = `${text}\n\n[VISION CONTEXT - DIGITAL TWIN]\n${m.image_description}`.trim();
              }
              return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text }] };
            });

          const controller = new AbortController();
          set({ aiAbortController: controller });

          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              prompt: userContent,
              buffer: imageBuffer,
              images: imagesArray,
              activeEntityId: get().activeEntityId,
              activeChatId: get().activeChatId,
              aiApiKey: get().aiApiKey,
              activeWorkspaceId: get().activeWorkspaceId,
              classificationModelId: get().aiClassificationModelId,
              mode: get().activeMode,
              intentTag: get().activeIntentTag ?? null,
              replyContext: null,
              thinkingEnabled: get().thinkingEnabled,
              advisorEnabled: get().advisorEnabled,
              isTempChat: get().isTempChat,
              clientHistory: historyMessages,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            set(s => ({
              aiMessages: s.aiMessages.map(m =>
                m.id === messageId
                  ? { ...m, content: err.error || 'Something went wrong.' }
                  : m
              ),
            }));
            await get().finishAILoading();
            return;
          }

          const isStream = res.headers.get('Content-Type')?.includes('text/event-stream');
          if (isStream) {
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let sseBuffer = '';
            let lastModel = '';
            let lastPipelineSteps: any = undefined;
            let lastCitations: any = undefined;
            let lastLogId: any = undefined;

            if (reader) {
              let flushTimer: ReturnType<typeof setTimeout> | null = null;
              let pendingContent = '';

              const flushUpdate = () => {
                flushTimer = null;
                const contentToSet = pendingContent;
                set(s => ({
                  aiMessages: s.aiMessages.map(m => {
                    if (m.id !== messageId) return m;
                    const updatedVariants = m.variants ? [...m.variants] : [];
                    if (m.variantIndex !== undefined && updatedVariants[m.variantIndex] !== undefined) {
                      updatedVariants[m.variantIndex] = contentToSet;
                    }
                    return { ...m, content: contentToSet, variants: updatedVariants, model: lastModel || m.model, pipelineSteps: lastPipelineSteps ?? m.pipelineSteps, citations: lastCitations ?? m.citations, logId: lastLogId ?? m.logId };
                  }),
                }));
              };

              let isStreamDone = false;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                sseBuffer += decoder.decode(value, { stream: true });
                const newlineIdx = sseBuffer.lastIndexOf('\n');
                if (newlineIdx === -1) continue;
                const complete = sseBuffer.slice(0, newlineIdx);
                sseBuffer = sseBuffer.slice(newlineIdx + 1);
                const lines = complete.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') {
                      isStreamDone = true;
                      break;
                    }
                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.error) {
                        accumulatedContent = parsed.error;
                        pendingContent = parsed.error;
                        lastModel = parsed.model || 'system';
                        isStreamDone = true;
                        flushUpdate();
                        break;
                      } else if (parsed.content !== undefined) {
                        accumulatedContent += parsed.content;
                        pendingContent = accumulatedContent;
                      }
                      if (parsed.model) lastModel = parsed.model;
                      if (parsed.pipeline_steps) lastPipelineSteps = parsed.pipeline_steps;
                      if (parsed.citations) lastCitations = parsed.citations;
                      if (parsed.log_id) lastLogId = parsed.log_id;
                      if (flushTimer === null) flushTimer = setTimeout(flushUpdate, 30);
                    } catch { /* ignore parse errors */ }
                  }
                }
                if (isStreamDone) break;
              }
              if (flushTimer !== null) { clearTimeout(flushTimer); }
              if (!accumulatedContent) {
                accumulatedContent = 'No response received from the server. Please try again.';
                pendingContent = accumulatedContent;
                lastModel = 'system';
              }
              flushUpdate();
              await get().finishAILoading();
            }
          } else {
            const data = await res.json();
            set(s => ({
              aiMessages: s.aiMessages.map(m => {
                if (m.id !== messageId) return m;
                const updatedVariants = m.variants ? [...m.variants] : [];
                if (m.variantIndex !== undefined && updatedVariants[m.variantIndex] !== undefined) {
                  updatedVariants[m.variantIndex] = data.content;
                }
                return { ...m, content: data.content, variants: updatedVariants, model: data.model, logId: data.log_id ?? undefined, model_chain: data.model_chain, citations: data.citations, pipelineSteps: data.pipeline_steps };
              }),
            }));
            await get().finishAILoading();
          }
        } catch (e: any) {
          if (e?.name === 'AbortError') {
            set(s => ({
              aiMessages: s.aiMessages.map(m =>
                m.id === messageId ? { ...m, content: 'Generation stopped by user.', interrupted: true } : m
              ),
            }));
            await get().finishAILoading();
          } else {
            const errMsg = e?.message ? `Connection error: ${e.message}. Please check your connection and try again.` : 'Connection error. Please try again.';
            set(s => ({
              aiMessages: s.aiMessages.map(m =>
                m.id === messageId ? { ...m, content: errMsg, model: 'system' } : m
              ),
            }));
            await get().finishAILoading();
          }
        }
      },

      setActiveEntityId: (id) => {
        const state = get();
        if (id === state.activeEntityId && state.navigationHistory[state.historyIndex] === id) return;

        // If we switch away from chat view, trigger empty chat cleanup
        if (state.activeEntityId === 'chat' && id !== 'chat') {
          get().cleanupActiveChatIfEmpty();
        }

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

      removeTab: (id) => {
        const state = get();
        const nextTabs = state.openTabIds.filter(tid => tid !== id);
        let nextActive = state.activeTabId;
        if (state.activeTabId === id) {
          nextActive = nextTabs[nextTabs.length - 1] || 'dashboard';
        }
        if (state.activeEntityId === 'chat' && nextActive !== 'chat') {
          state.cleanupActiveChatIfEmpty();
        }
        set({
          openTabIds: nextTabs,
          activeTabId: nextActive,
          activeEntityId: nextActive
        });
      },

      setActiveTab: (id) => set({ activeTabId: id, activeEntityId: id }),
      setOpenTabs: (ids) => set({ openTabIds: ids }),

      setNavigationState: (id, history, index) => set({ activeEntityId: id, navigationHistory: history, historyIndex: index }),

      goBack: () => window.history.back(),
      goForward: () => window.history.forward(),

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

        // Inherit cloudSyncEnabled default from parent or active space config
        const parentEntity = entity.parentId ? get().entities.find(e => e.id === entity.parentId) : null;
        let defaultSyncMode: import('./store.types').SyncMode = 'cloud-only';
        if (parentEntity) {
          if (parentEntity.syncMode === 'local-only') {
            defaultSyncMode = 'local-only';
          }
        } else {
          const wsId = entity.workspaceId || activeWorkspaceId;
          const ws = get().workspaces.find(w => w.id === wsId);
          if (ws && ws.syncMode === 'local-only') {
            defaultSyncMode = 'local-only';
          }
        }

        const finalEntity = {
          ...entity,
          id: entity.id || generateId(),
          parentId: finalParentId,
          workspaceId: entity.workspaceId || activeWorkspaceId,
          sortOrder: entity.sortOrder ?? (maxSortOrder + 1),
          syncMode: entity.syncMode ?? defaultSyncMode,
          lastModified: entity.lastModified || Date.now()
        } as Entity;
        set((state) => ({ entities: [...state.entities, finalEntity] }));
        if (finalEntity.syncMode !== 'local-only') upsertEntity(finalEntity);
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
        if (updated && updated.syncMode !== 'local-only') upsertEntity(updated);
      },

      reorderEntities: (orderedIds) => {
        set((state) => ({
          entities: state.entities.map(e => {
            const idx = orderedIds.indexOf(e.id);
            if (idx === -1) return e;
            return { ...e, sortOrder: idx, lastModified: Date.now() };
          }),
        }));
        const freshEntities = get().entities;
        orderedIds.forEach(id => {
          const updated = freshEntities.find(e => e.id === id);
          if (updated && updated.syncMode !== 'local-only') {
            upsertEntity(updated);
          }
        });
      },

      renameEntity: (id, newTitle) => {
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, title: newTitle, lastModified: Date.now() } : e),
          workspaces: state.workspaces.map(w => w.id === id ? { ...w, name: newTitle } : w),
          editingEntity: null
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated) upsertEntity(updated);
        const updatedWs = get().workspaces.find(w => w.id === id);
        if (updatedWs) upsertWorkspace(updatedWs);
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
        newEntities.filter(e => e.syncMode !== 'local-only').forEach(e => upsertEntity(e));
      },

      setEntityIcon: (id, icon) => {
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, icon, lastModified: Date.now() } : e),
          workspaces: state.workspaces.map(w => w.id === id ? { ...w, icon } : w)
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated) upsertEntity(updated);
        const updatedWs = get().workspaces.find(w => w.id === id);
        if (updatedWs) upsertWorkspace(updatedWs);
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
        const divider = { id, title: '', type: 'divider' as const, parentId, lastModified: Date.now(), sortOrder: 9999, syncMode: 'cloud-only' as any };
        set(s => ({ entities: [...s.entities, divider] }));
        // Inherit divider sync from parent context if applicable (cast so compiler knows it's complete)
        const typedDivider = divider as Entity;
        if (typedDivider.syncMode !== 'local-only') upsertEntity(typedDivider);
      },
      updateEntityContent: (id, content) => {
        const now = Date.now();
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, content, lastModified: now } : e),
          lastSaved: now
        }));

        const updated = get().entities.find(e => e.id === id);

        if (updated && updated.syncMode !== 'local-only') {
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

      addCanvasBlock: (block: EditorBlock) => {
        set((state) => ({
          blocks: [...state.blocks, block]
        }));
        const canvas = get().entities.find(e => e.id === block.canvasId);
        if (canvas && canvas.syncMode !== 'local-only') {
          upsertCanvasBlock(block, undefined, canvas.workspaceId || undefined);
        }
      },
      updateCanvasBlock: (id: string, updates: Partial<EditorBlock>) => {
        set((state) => ({
          blocks: state.blocks.map(b => b.id === id ? { ...b, ...updates } : b)
        }));
        const block = get().blocks.find(b => b.id === id);
        if (block && block.canvasId) {
          const canvas = get().entities.find(e => e.id === block.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock(block, undefined, canvas.workspaceId || undefined);
          }
        }
      },
      updateCanvasBlocks: (batch: { id: string; updates: Partial<EditorBlock> }[]) => {
        set((state) => {
          const map = new Map(batch.map(u => [u.id, u.updates]));
          return {
            blocks: state.blocks.map(b => {
              const up = map.get(b.id);
              return up ? { ...b, ...up } : b;
            })
          };
        });
        batch.forEach(({ id }) => {
          const block = get().blocks.find(b => b.id === id);
          if (block && block.canvasId) {
            const canvas = get().entities.find(e => e.id === block.canvasId);
            if (canvas && canvas.syncMode !== 'local-only') {
              upsertCanvasBlock(block, undefined, canvas.workspaceId || undefined);
            }
          }
        });
      },
      deleteCanvasBlock: (id: string) => {
        const block = get().blocks.find(b => b.id === id);
        set((state) => ({
          blocks: state.blocks.filter(b => b.id !== id)
        }));
        if (block && block.canvasId) {
          const canvas = get().entities.find(e => e.id === block.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            deleteCanvasBlockFromDB(id);
          }
        }
      },
      moveCanvasFrame: (frameId: string, deltaX: number, deltaY: number) => {
        set((state) => ({
          blocks: state.blocks.map(b => {
            if (b.id === frameId) {
              return { ...b, x: (b.x || 0) + deltaX, y: (b.y || 0) + deltaY };
            }
            if (b.parentId === frameId) {
              return { ...b, x: (b.x || 0) + deltaX, y: (b.y || 0) + deltaY };
            }
            return b;
          })
        }));

        const frameBlock = get().blocks.find(b => b.id === frameId);
        if (frameBlock && frameBlock.canvasId) {
          const canvas = get().entities.find(e => e.id === frameBlock.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock(frameBlock, undefined, canvas.workspaceId || undefined);

            const childBlocks = get().blocks.filter(b => b.parentId === frameId);
            childBlocks.forEach(b => {
              upsertCanvasBlock(b, undefined, canvas.workspaceId || undefined);
            });
          }
        }
      },
      moveCanvasSection: (sectionId: string, deltaX: number, deltaY: number) => {
        get().moveCanvasFrame(sectionId, deltaX, deltaY);
      },

      // ─── Frame & Group actions ────────────────────────────────

      groupBlocks: (ids: string[]) => {
        const groupId = generateGroupId();
        set((s) => ({
          blocks: s.blocks.map((b) =>
            ids.includes(b.id) ? { ...b, groupId } : b,
          ),
        }));
        // Persist each updated block
        ids.forEach((id) => {
          const block = get().blocks.find((b) => b.id === id);
          if (block && block.canvasId) {
            const canvas = get().entities.find((e) => e.id === block.canvasId);
            if (canvas && canvas.syncMode !== 'local-only') {
              upsertCanvasBlock(block, undefined, canvas.workspaceId || undefined);
            }
          }
        });
        return groupId;
      },

      ungroupBlocks: (groupId: string) => {
        const members = get().blocks.filter((b) => b.groupId === groupId);
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.groupId === groupId
              ? (({ groupId: _g, ...rest }) => rest)(b)
              : b,
          ),
        }));
        // Persist each updated block
        members.forEach((b) => {
          if (b.canvasId) {
            const canvas = get().entities.find((e) => e.id === b.canvasId);
            if (canvas && canvas.syncMode !== 'local-only') {
              upsertCanvasBlock(b, undefined, canvas.workspaceId || undefined);
            }
          }
        });
      },

      setFrameAutoLayout: (id: string, on: boolean) => {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id ? { ...b, autoLayout: on } : b,
          ),
        }));
        const frame = get().blocks.find((b) => b.id === id);
        if (!frame) return;

        // If enabling auto-layout, immediately re-arrange children
        if (on && frame.autoLayout === false) {
          const children = get().blocks.filter((b) => b.parentId === id);
          if (children.length > 0) {
            const result = computeAutoLayout(frame, children);
            if (result.children.length > 0) {
              set((s) => {
                const updated = new Map(result.children.map((c) => [c.id, c]));
                return {
                  blocks: s.blocks.map((b) => updated.get(b.id) ?? b),
                };
              });
            }
          }
        }

        // Persist
        if (frame.canvasId) {
          const canvas = get().entities.find((e) => e.id === frame.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock(frame, undefined, canvas.workspaceId || undefined);
          }
        }
      },

      setFrameLayoutDirection: (id: string, dir: FrameLayoutDirection) => {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id ? { ...b, layoutDirection: dir } : b,
          ),
        }));
        const frame = get().blocks.find((b) => b.id === id);
        if (!frame) return;
        // Recompute auto layout if enabled
        if (frame.autoLayout) {
          const children = get().blocks.filter((b) => b.parentId === id);
          if (children.length > 0) {
            const result = computeAutoLayout({ ...frame, layoutDirection: dir }, children);
            if (result.children.length > 0) {
              set((s) => {
                const updated = new Map(result.children.map((c) => [c.id, c]));
                return { blocks: s.blocks.map((b) => updated.get(b.id) ?? b) };
              });
            }
          }
        }
        if (frame.canvasId) {
          const canvas = get().entities.find((e) => e.id === frame.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock({ ...frame, layoutDirection: dir }, undefined, canvas.workspaceId || undefined);
          }
        }
      },

      setFrameLayoutGap: (id: string, gap: number) => {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id ? { ...b, layoutGap: gap } : b,
          ),
        }));
        // Recompute auto layout for children
        const frame = get().blocks.find((b) => b.id === id);
        if (frame?.autoLayout) {
          const children = get().blocks.filter((b) => b.parentId === id);
          if (children.length > 0) {
            const result = computeAutoLayout({ ...frame, layoutGap: gap }, children);
            if (result.children.length > 0) {
              set((s) => {
                const updated = new Map(result.children.map((c) => [c.id, c]));
                return { blocks: s.blocks.map((b) => updated.get(b.id) ?? b) };
              });
            }
          }
        }
        if (frame?.canvasId) {
          const canvas = get().entities.find((e) => e.id === frame.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock({ ...frame, layoutGap: gap }, undefined, canvas.workspaceId || undefined);
          }
        }
      },

      setFramePadding: (id: string, top: number, right: number, bottom: number, left: number) => {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id
              ? { ...b, layoutPaddingTop: top, layoutPaddingRight: right, layoutPaddingBottom: bottom, layoutPaddingLeft: left }
              : b,
          ),
        }));
        const frame = get().blocks.find((b) => b.id === id);
        if (frame?.autoLayout) {
          const children = get().blocks.filter((b) => b.parentId === id);
          if (children.length > 0) {
            const result = computeAutoLayout(
              { ...frame, layoutPaddingTop: top, layoutPaddingRight: right, layoutPaddingBottom: bottom, layoutPaddingLeft: left },
              children,
            );
            if (result.children.length > 0) {
              set((s) => {
                const updated = new Map(result.children.map((c) => [c.id, c]));
                return { blocks: s.blocks.map((b) => updated.get(b.id) ?? b) };
              });
            }
          }
        }
        if (frame?.canvasId) {
          const canvas = get().entities.find((e) => e.id === frame.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock(frame, undefined, canvas.workspaceId || undefined);
          }
        }
      },

      setFrameAlignment: (id: string, align: string, crossAlign: string) => {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id
              ? { ...b, layoutAlign: align as 'start' | 'center' | 'end' | 'space-between', layoutCrossAlign: crossAlign as 'start' | 'center' | 'end' | 'stretch' }
              : b,
          ),
        }));
        const frame = get().blocks.find((b) => b.id === id);
        if (frame?.autoLayout) {
          const children = get().blocks.filter((b) => b.parentId === id);
          if (children.length > 0) {
            const result = computeAutoLayout(
              { ...frame, layoutAlign: align as any, layoutCrossAlign: crossAlign as any },
              children,
            );
            if (result.children.length > 0) {
              set((s) => {
                const updated = new Map(result.children.map((c) => [c.id, c]));
                return { blocks: s.blocks.map((b) => updated.get(b.id) ?? b) };
              });
            }
          }
        }
        if (frame?.canvasId) {
          const canvas = get().entities.find((e) => e.id === frame.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock(frame, undefined, canvas.workspaceId || undefined);
          }
        }
      },

      setFrameClipContent: (id: string, clip: boolean) => {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id ? { ...b, clipContent: clip } : b,
          ),
        }));
        const block = get().blocks.find((b) => b.id === id);
        if (block && block.canvasId) {
          const canvas = get().entities.find((e) => e.id === block.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock(block, undefined, canvas.workspaceId || undefined);
          }
        }
      },

      setFrameResizing: (id: string, h: FrameResizeMode, v: FrameResizeMode) => {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id ? { ...b, frameResizingH: h, frameResizingV: v } : b,
          ),
        }));
        const block = get().blocks.find((b) => b.id === id);
        if (block?.autoLayout) {
          const children = get().blocks.filter((b) => b.parentId === id);
          if (children.length > 0) {
            const result = computeAutoLayout({ ...block, frameResizingH: h, frameResizingV: v }, children);
            if (result.children.length > 0) {
              set((s) => {
                const updated = new Map(result.children.map((c) => [c.id, c]));
                return { blocks: s.blocks.map((b) => updated.get(b.id) ?? b) };
              });
            }
          }
        }
        if (block && block.canvasId) {
          const canvas = get().entities.find((e) => e.id === block.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock(block, undefined, canvas.workspaceId || undefined);
          }
        }
      },

      setChildResizing: (id: string, h: ChildResizeMode, v: ChildResizeMode) => {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === id ? { ...b, childResizingH: h, childResizingV: v } : b,
          ),
        }));
        const parent = get().blocks.find((b) => {
          const child = get().blocks.find((c) => c.id === id);
          return child && child.parentId === b.id;
        });
        if (parent?.autoLayout) {
          const children = get().blocks.filter((b) => b.parentId === parent.id);
          if (children.length > 0) {
            const result = computeAutoLayout(parent, children.map((c) => (c.id === id ? { ...c, childResizingH: h, childResizingV: v } : c)));
            if (result.children.length > 0) {
              set((s) => {
                const updated = new Map(result.children.map((c) => [c.id, c]));
                return { blocks: s.blocks.map((b) => updated.get(b.id) ?? b) };
              });
            }
          }
        }
        const block = get().blocks.find((b) => b.id === id);
        if (block && block.canvasId) {
          const canvas = get().entities.find((e) => e.id === block.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            upsertCanvasBlock(block, undefined, canvas.workspaceId || undefined);
          }
        }
      },

      toggleFavorite: (id) => set((state) => ({ favoriteIds: state.favoriteIds.includes(id) ? state.favoriteIds.filter(fid => fid !== id) : [...state.favoriteIds, id] })),

      toggleCollapsed: (id) => set((state) => ({ collapsedIds: state.collapsedIds.includes(id) ? state.collapsedIds.filter(cid => cid !== id) : [...state.collapsedIds, id] })),

      addTask: (task) => {
        const activeWorkspaceId = get().activeWorkspaceId;
        const finalTask = {
          id: generateId(),
          completed: false,
          ...task,
          userDueDate: task.userDueDate || task.dueDate || undefined,
          workspaceId: task.workspaceId || activeWorkspaceId
        } as AppTask;
        set((state) => ({ tasks: [...state.tasks, finalTask] }));
        upsertTask(finalTask);
      },

      toggleTask: (id) => {
        set((s) => ({
          tasks: s.tasks.map(t => {
            if (t.id === id) {
              const nextCompleted = !t.completed;
              return {
                ...t,
                completed: nextCompleted,
                completedAt: nextCompleted ? Date.now() : undefined
              };
            }
            return t;
          })
        }));
        const updated = get().tasks.find(t => t.id === id);
        if (updated) upsertTask(updated);
      },

      deleteTask: (id) => {
        set((s) => ({ tasks: s.tasks.filter(t => t.id !== id) }));
        deleteTaskFromDB(id);
      },

      toggleTaskSelection: (id) => set((s) => ({
        selectedTaskIds: s.selectedTaskIds.includes(id)
          ? s.selectedTaskIds.filter(x => x !== id)
          : [...s.selectedTaskIds, id],
      })),
      setSelectedTaskIds: (ids) => set({ selectedTaskIds: ids }),
      clearTaskSelection: () => set({ selectedTaskIds: [] }),
      openTaskContextMenu: (taskId, column, x, y) => set({ taskContextMenu: { taskId, column, x, y } }),
      closeTaskContextMenu: () => set({ taskContextMenu: null }),

      clearCompletedTasks: () => {
        const completed = get().tasks.filter(t => t.completed);
        set((s) => ({ tasks: s.tasks.filter(t => !t.completed) }));
        completed.forEach(t => deleteTaskFromDB(t.id));
      },

      setTrackerColumnSortMode: (columnId, mode) => {
        set((s) => ({
          trackerColumnSortModes: {
            ...s.trackerColumnSortModes,
            [columnId]: mode
          },
          trackerColumnSortLocks: {
            ...s.trackerColumnSortLocks,
            [columnId]: mode === 'manual' ? false : !!s.trackerColumnSortLocks?.[columnId]
          }
        }));
      },

      toggleTrackerColumnSortLock: (columnId) => {
        set((s) => ({
          trackerColumnSortLocks: {
            ...s.trackerColumnSortLocks,
            [columnId]: !s.trackerColumnSortLocks?.[columnId]
          }
        }));
      },

      updateTask: (id, updates) => {
        set((s) => ({
          tasks: s.tasks.map(t => {
            if (t.id === id) {
              const nextCompleted = updates.completed !== undefined ? updates.completed : t.completed;
              const completedAt = nextCompleted 
                ? (t.completed ? t.completedAt : Date.now()) 
                : undefined;
              return { ...t, ...updates, completedAt };
            }
            return t;
          })
        }));
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
        if (updated && updated.syncMode !== 'local-only') upsertEntity(updated);
      },

      sortEntities: (criteria) => set((s) => ({ entities: [...s.entities].sort((a, b) => criteria === 'title' ? a.title.localeCompare(b.title) : (b.lastModified || 0) - (a.lastModified || 0)) })),

      sortTasks: (criteria) => set((s) => ({ tasks: [...s.tasks].sort((a, b) => criteria === 'title' ? a.title.localeCompare(b.title) : new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime()) })),

      updateBlockPosition: (id, x, y) => set((state) => ({ blocks: state.blocks.map(b => b.id === id ? { ...b, x, y } : b) })),

      setTasks: (tasks) => set({ tasks }),

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
      version: 20,
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
        if (version < 16) {
          if (Array.isArray(state.blocks)) {
            state.blocks = state.blocks.map((b: any) => migrateBlock(b));
          }
        }
        if (version < 17) {
          if (Array.isArray(state.blocks)) {
            state.blocks = state.blocks.map((b: any) => {
              if (b.keyPoints && !b.points) {
                return { ...b, points: b.keyPoints };
              }
              return b;
            });
          }
        }
        // Version 20: migrate 'section' blocks to 'frame'
        if (version < 20) {
          if (Array.isArray(state.blocks)) {
            state.blocks = state.blocks.map((b: any) =>
              b.type === 'section' ? { ...b, type: 'frame' } : b,
            );
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
        isTabsHeaderVisible: state.isTabsHeaderVisible,
        appStyle: state.appStyle,
        dashboardLayout: state.dashboardLayout,
        defaultDashboardLayout: state.defaultDashboardLayout,
        aiMessages: state.aiMessages.slice(-20), // Only persist the last 20 messages to keep disk footprint low
        aiBehaviorMode: state.aiBehaviorMode,
        aiApiKey: state.aiApiKey,
        copiedBlock: state.copiedBlock,
        sidebarSectionSettings: state.sidebarSectionSettings,
        trackerColumnSortModes: state.trackerColumnSortModes,
        trackerColumnSortLocks: state.trackerColumnSortLocks,
        hiddenEntityIds: state.hiddenEntityIds,
        recentEntityIds: state.recentEntityIds,
        activeMode: state.activeMode,
        activeIntentTag: state.activeIntentTag,
        activeChatId: state.activeChatId,
        chatHistoryOpen: state.chatHistoryOpen,
        chatInputs: state.chatInputs,
        chatMessagesMap: state.chatMessagesMap,
        sessionContextsMap: state.sessionContextsMap,
      }),
    }
  )
);

if (isDesktop()) {
  useStore.subscribe((state, prevState) => {
    // Basic detection for M3: if lastModified changed, save it
    // In M4 this will be replaced by direct calls to saveEntity() on store actions
    for (const entity of state.entities) {
      const prev = prevState.entities.find(e => e.id === entity.id);
      if (!prev || prev.lastModified !== entity.lastModified) {
        saveEntityToFile(entity, state.blocks.filter(b => b.canvasId === entity.id));
      }
    }
  });
}
