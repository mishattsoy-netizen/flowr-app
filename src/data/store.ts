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

      setCloudSyncEnabled: (enabled) => {
        set({ cloudSyncEnabled: enabled });
        if (enabled) {
          // Sync everything to cloud immediately
          const { entities, tasks } = get();
          entities.forEach(e => upsertEntity(e));
          tasks.forEach(t => upsertTask(t));
          set({ lastSaved: Date.now() });
        } else {
          // Destructive: Clear cloud data when switching to local-only
          clearAllDataFromCloud();
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
        const { activeEntityId, fetchAISessionContext } = get();
        set({ aiMessages: [], aiSessionContext: null, activeMode: 'default', activeIntentTag: null });
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
            body: JSON.stringify({ activeEntityId }) 
          });
          
          await fetchAISessionContext(activeEntityId || 'global');
        } catch (err) {
          console.error('Failed to clear server-side memory:', err);
        }
      },

      compactAIChat: async () => {
        const { activeEntityId, fetchAISessionContext } = get();
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }
          const res = await fetch('/api/ai/memory/compact', { 
            method: 'POST', 
            headers,
            body: JSON.stringify({ activeEntityId }) 
          });
          if (res.ok) {
            await fetchAISessionContext(activeEntityId || 'global');
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
      setActiveIntentTag: (tag) => set({ activeIntentTag: tag }),

      sendAIMessage: async (content, attachments = []) => {
        const { aiMessages } = get();

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

        set({ aiMessages: [...aiMessages, userMessage, placeholderMessage], isAILoading: true });

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

          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              prompt: content,
              buffer: imageBuffer,
              activeEntityId: get().activeEntityId,
              aiApiKey: get().aiApiKey,
              activeWorkspaceId: get().activeWorkspaceId,
              classificationModelId: get().aiClassificationModelId,
              mode: get().activeMode,
              intentTag: get().activeIntentTag ?? null,
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

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
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
                              ? { ...m, content: accumulatedContent, model: parsed.model || m.model }
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
                citations: data.citations
              }
              : m
            ),
            isAILoading: false,
          }));
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
          if (tabIndex !== -1) {
            // Check if the new ID is already open in ANOTHER tab to avoid duplicates
            const existingIndex = nextTabs.indexOf(id);
            if (existingIndex !== -1 && existingIndex !== tabIndex) {
              // If it exists elsewhere, we could either jump to it or replace it.
              // User said "dont open new tabs", and "change the tab path".
              // Let's just jump to it if it exists, or replace current if it doesn't.
              set({ activeTabId: id, activeEntityId: id, recentEntityIds: nextRecent });
            } else {
              nextTabs[tabIndex] = id;
              set({ openTabIds: nextTabs, recentEntityIds: nextRecent });
            }
          } else {
            // No active tab found? (Shouldn't happen with the new flow)
            if (!nextTabs.includes(id)) nextTabs.push(id);
            set({ openTabIds: nextTabs, recentEntityIds: nextRecent });
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
        if (get().cloudSyncEnabled) upsertEntity(finalEntity);
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
        if (updated && get().cloudSyncEnabled) upsertEntity(updated);
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
        if (updated && get().cloudSyncEnabled) upsertEntity(updated);
        const updatedWs = get().workspaces.find(w => w.id === id);
        if (updatedWs && get().cloudSyncEnabled) upsertWorkspace(updatedWs);
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
        if (get().cloudSyncEnabled) newEntities.forEach(e => upsertEntity(e));
      },

      setEntityIcon: (id, icon) => {
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, icon, lastModified: Date.now() } : e),
          workspaces: state.workspaces.map(w => w.id === id ? { ...w, icon } : w)
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated && get().cloudSyncEnabled) upsertEntity(updated);
        // Also sync workspace if needed
        const updatedWs = get().workspaces.find(w => w.id === id);
        if (updatedWs && get().cloudSyncEnabled) upsertWorkspace(updatedWs);
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
        if (get().cloudSyncEnabled) upsertEntity(divider);
      },
      updateEntityContent: (id, content) => {
        const now = Date.now();
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, content, lastModified: now } : e),
          lastSaved: now
        }));

        const { cloudSyncEnabled } = get();
        const updated = get().entities.find(e => e.id === id);

        if (updated && cloudSyncEnabled) {
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
        if (updated && get().cloudSyncEnabled) upsertEntity(updated);
      },

      sortEntities: (criteria) => set((s) => ({ entities: [...s.entities].sort((a, b) => criteria === 'title' ? a.title.localeCompare(b.title) : (b.lastModified || 0) - (a.lastModified || 0)) })),

      sortTasks: (criteria) => set((s) => ({ tasks: [...s.tasks].sort((a, b) => criteria === 'title' ? a.title.localeCompare(b.title) : new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime()) })),

      updateBlockPosition: (id, x, y) => set((state) => ({ blocks: state.blocks.map(b => b.id === id ? { ...b, x, y } : b) })),

      setEntities: (entities) => set({ entities }),
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
      }),
    }
  )
);
