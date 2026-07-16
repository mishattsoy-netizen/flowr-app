import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  upsertEntity,
  deleteEntityFromDB,
  upsertTask,
  deleteTaskFromDB,
  clearAllDataFromCloud,
  upsertSpace
} from '@/lib/sync';
import { supabase, isSupabaseEnabled } from '@/lib/supabase';
import {
  fetchConversations,
  createConversation,
  updateConversationTitle,
  updateConversationFavorite,
  deleteConversation as deleteConversationFromDB,
  fetchMessages,
  insertMessage,
} from '@/lib/chat';
import type { ChatConversation } from '@/lib/chat';
import { upsertCanvasBlock, deleteCanvasBlock as deleteCanvasBlockFromDB } from '@/lib/canvasSync';
import { generateGroupId } from '@/lib/groupUtils';
import { resolvePoints } from '@/lib/geometry/resolvePoints';

// Re-export all types so all consumers import paths remain valid
export type {
  EntityType, BlockStyle, BlockType, EditorBlock,
  WidgetType, WidgetSize, WidgetConfig, Entity, AppTask, TaskAttachment, SettingsTab, ModalType,
  EditingSource, AIAttachment, AIMessage, AICursor, ModelStatus,
  PriorityModel, ProjectQuota, FlowIntentCategory, FlowRouterModel,
  FlowRouterCategory, FlowRouterConfig, CloudModel, AIRequestLog, AppState,
  SpaceType, Space, SidebarSectionId, SidebarSectionSettings, SortMode,
  BotMode, ShapeKind, CanvasStyleExt, ArrowBinding, ArrowheadStyle, ArrowheadType,
  PendingModeWrite,
} from './store.types';

// Re-export helpers needed by external consumers
export { generateId, robustParseJSON, blocksToMarkdown } from './store.helpers';
export { getSyncModeCascade } from './store.helpers';

// Internal type imports (used within this file's store implementation)
import type {
  Entity, EditorBlock, AIMessage,
  AppState, Space, WidgetConfig, AppTask, TaskAttachment, BotMode, PendingModeWrite,
} from './store.types';
import { entityToSQLiteRow, taskToSQLiteRow, spaceToSQLiteRow } from '@/lib/legacyImport';


import {
  generateId, getDescendantIds, getAllDescendants, findWorkspaceRoot, validateNoteContent,
  robustParseJSON, markdownToBlocks, blocksToMarkdown, getClientTime, getSyncModeCascade,
  resolveAttachmentsForVision
} from './store.helpers';
import { isDesktop } from '@/lib/env';
import { createDebouncedPush } from '@/lib/debouncedPush';
import { markForPurge, clearPurge } from '@/lib/sync';

// Debounces the ~20 per-mutation Supabase push call sites below by 1.5s per row id,
// so rapid edits (typing) collapse into one network call instead of firing on every
// keystroke. This wrapper is only ever invoked from mutation actions (addEntity,
// updateEntityContent, etc.) — NEVER from setEntities/setTasks/setSpaces, which is
// what mergeCloudData uses to apply pulled remote data. That separation is what keeps
// pulls from re-triggering a push back to Supabase (no dirty-flag/echo-suppression
// needed): bulk setters never call these wrappers, so a pull can never loop back out.
const debouncedPushEntity = createDebouncedPush<Entity>((e) => { upsertEntity(e); }, 1500);
const debouncedPushTask = createDebouncedPush<AppTask>((t) => { upsertTask(t); }, 1500);
const debouncedPushSpace = createDebouncedPush<Space>((s) => { upsertSpace(s); }, 1500);


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

export const getChatSessionId = (
  activeChatId: string | null,
  activeEntityId: string | null,
  activeSpaceId: string | null,
  fallback: string
) => {
  if (activeChatId) return activeChatId;
  if (activeEntityId && !SYSTEM_ROUTES.includes(activeEntityId)) {
    return activeEntityId;
  }
  return `${fallback}_${activeSpaceId || 'ws-personal'}`;
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
      entities: [],
      tasks: [],
      blocks: [],
      isChatHistoryLoading: false,
      isChatMessagesLoading: false,
      gracePeriodEndsAt: null,

      spaces: [
        {
          id: 'ws-personal',
          name: 'Personal',
          type: 'personal' as const,
          ownerId: null,
          createdAt: initialTime,
          lastModified: initialTime,
          syncMode: 'cloud-only',
        },
      ],
      activeSpaceId: 'ws-personal',
      trackerFilterTags: [],
      trackerFilterEntityIds: [],
      shortcuts: {},
      cachedDisplayName: '',
      lastSaved: null,
      syncCursors: {} as Record<'entities' | 'tasks' | 'spaces', number>,
      syncMode: 'local-only',
      isInitialSync: true,
      defaultsSeeded: false,
      pendingModeWrites: [],

      setInitialSync: (isInitialSync) => set({ isInitialSync }),

      seedDefaults: () => {
        if (get().defaultsSeeded) return;
        const now = Date.now();
        const dayMs = 86400000;
        get().addEntity({ id: 'seed-ws-1', title: 'Space 1', type: 'workspace', parentId: null, lastModified: now, icon: 'Folder', syncMode: 'cloud-only' });
        get().addEntity({ id: 'seed-ws-2', title: 'Space 2', type: 'workspace', parentId: null, lastModified: now - dayMs * 2, icon: 'Briefcase', syncMode: 'cloud-only' });
        get().addEntity({ id: 'seed-f-1', title: 'Folder 1', type: 'folder', parentId: 'seed-ws-1', lastModified: now - dayMs, syncMode: 'cloud-only' });
        get().addEntity({ id: 'seed-cv-1', title: 'Canvas 1', type: 'canvas', parentId: 'seed-f-1', lastModified: now - 500000, syncMode: 'cloud-only' });
        get().addEntity({ id: 'seed-n-1', title: 'Notes 1', type: 'note', parentId: 'seed-ws-2', lastModified: now - 100000, tags: ['research', 'draft'], syncMode: 'cloud-only' });
        // Tasks
        get().addTask({ id: 'seed-t-1', title: 'Review mockups', completed: false, dueDate: new Date(now - dayMs).toISOString().split('T')[0], entityId: 'seed-cv-1', color: '#EF4444', syncMode: 'cloud-only' });
        get().addTask({ id: 'seed-t-2', title: 'Outline next week', completed: true, dueDate: new Date(now).toISOString().split('T')[0], entityId: 'seed-n-1', syncMode: 'cloud-only' });
        get().addTask({ id: 'seed-t-3', title: 'Design review meeting', completed: false, dueDate: new Date(now + dayMs).toISOString().split('T')[0], color: '#3B82F6', syncMode: 'cloud-only' });
        get().addTask({ id: 'seed-t-4', title: 'Prepare assets', completed: false, dueDate: new Date(now).toISOString().split('T')[0], syncMode: 'cloud-only' });
        // Canvas block
        get().addCanvasBlock({ id: 'seed-b-1', type: 'text', content: 'Explore unified navigation.', x: 100, y: 100, canvasId: 'seed-cv-1' });
        set({ defaultsSeeded: true });
      },

      setSyncMode: async (entityId, mode) => {
        const { entityIds, taskIds } = getSyncModeCascade(get().entities, get().tasks, entityId);
        const entitySet = new Set(entityIds);
        const taskSet = new Set(taskIds);
        const now = Date.now();

        set(s => ({
          entities: s.entities.map(e => entitySet.has(e.id) ? { ...e, syncMode: mode, lastModified: now } : e),
          tasks:    s.tasks.map(t => taskSet.has(t.id) ? { ...t, syncMode: mode, lastModified: now } : t),
          spaces:   s.spaces.map(w => w.id === entityId ? { ...w, syncMode: mode, lastModified: now } : w)
        }));

        const spaceIds = get().spaces.some(w => w.id === entityId) ? [entityId] : [];

        if (mode === 'local-only') {
          // Explicit one-shot cloud write: every normal push path is suppressed
          // for local-only, so without this the cloud row would silently keep
          // its old sync_mode and never get purged. This is the ONLY place
          // allowed to write local-only state to Supabase.
          const { error } = await markForPurge({ entityIds, taskIds, spaceIds });
          if (error) get().queuePendingModeWrite({ entityIds, taskIds, spaceIds, action: 'purge', mode });

          const { saveEntity } = await import('@/lib/persistence');
          const freshEntities = get().entities;
          for (const id of entityIds) {
            const entity = freshEntities.find(e => e.id === id);
            if (entity) saveEntity(entity).catch(err => console.error('[store] saveEntity failed:', err));
          }
        } else {
          // Cancels a pending purge if one exists (purge_at -> NULL). If the
          // grace period already expired and the row is gone, the pushes below
          // recreate it from local state (re-upload, not a no-op).
          const { error } = await clearPurge({ entityIds, taskIds, spaceIds }, mode);
          if (error) get().queuePendingModeWrite({ entityIds, taskIds, spaceIds, action: 'clear', mode });

          const fresh = get();
          for (const id of entityIds) {
            const e = fresh.entities.find(x => x.id === id);
            if (e) debouncedPushEntity(e);
          }
          for (const id of taskIds) {
            const t = fresh.tasks.find(x => x.id === id);
            if (t) debouncedPushTask(t);
          }
          const ws = fresh.spaces.find(w => w.id === entityId);
          if (ws) debouncedPushSpace(ws);
        }
      },

      queuePendingModeWrite: (write) => set(s => ({ pendingModeWrites: [...s.pendingModeWrites, write] })),
      setLastSaved: (time) => set({ lastSaved: time }),

      applyInstantDowngradeLock: () => {
        set((state) => ({
          entities: state.entities.map(e => e.syncMode !== 'local-only' ? { ...e, syncMode: 'local-only' as const, lastModified: Date.now() } : e),
          tasks: state.tasks.map(t => t.syncMode !== 'local-only' ? { ...t, syncMode: 'local-only' as const, lastModified: Date.now() } : t),
          spaces: state.spaces.map(s => s.syncMode !== 'local-only' ? { ...s, syncMode: 'local-only' as const, lastModified: Date.now() } : s),
        }));
      },

      setEntities: (entities) => {
        set((s) => {
          let newActiveSpaceId = s.activeSpaceId;
          const globalSpaces = s.spaces; // Use actual global spaces, not entities
          if (!newActiveSpaceId || !globalSpaces.some(ws => ws.id === newActiveSpaceId)) {
            newActiveSpaceId = globalSpaces.length > 0 ? globalSpaces[0].id : 'ws-personal';
          }
          return { entities, activeSpaceId: newActiveSpaceId };
        });
      },
      setRecentEntityIds: (recentEntityIds) => set({ recentEntityIds }),
      setSyncCursor: (table: 'entities' | 'tasks' | 'spaces', ts: number) =>
        set(s => ({ syncCursors: { ...s.syncCursors, [table]: ts } })),


      activeEntityId: 'dashboard',
      navigationHistory: ['dashboard'],
      historyIndex: 0,
      recentEntityIds: [],

      favoriteIds: ['cv1', 'n1'],
      collapsedIds: [],
      openTabIds: ['dashboard'],
      activeTabId: 'dashboard',
      modal: null,
      contextMenu: null,
      selectedTaskIds: [],
      taskContextMenu: null,
      editingEntity: null,
      editingEntityId: null,
      editingSource: null,
      readModeStates: {},
      theme: 'dark',
      interfaceSize: 'regular',
      isSidebarCollapsed: false,
      isSidebarPinned: true,
      sidebarWidth: 280,
      aiSidebarWidth: 400,
      isToolbarVisible: true,
      isChatNewNoteButtonVisible: true,
      toolbarPosition: null,
      splitViewActive: false,
      splitViewLeftId: null,
      splitViewRightId: null,
      splitViewPinned: false,
      splitViewPosition: 50,
      columnDragOver: null as 'left' | 'right' | null,
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
      isTaskPanelOpen: false,
      activeTaskId: null as string | null,
      taskPanelPresets: null as Partial<AppTask> | null,
      taskPanelWidth: 500,
      aiWasOpenBeforeTaskPanel: false,
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
        spaces: { sortMode: 'lastModified', itemLimit: 20 },
      },
      trackerColumnSortModes: {
        todo: 'automatic',
        inProgress: 'automatic',
        today: 'automatic',
        overdue: 'automatic',
        completed: 'recently_added'
      },
      trackerColumnSortLocks: {
        todo: true,
        inProgress: true,
        today: true,
        overdue: true,
        completed: true,
      },
      hiddenEntityIds: [],
      isCommandPaletteOpen: false,
      selectedSidebarIds: [],
      aiSessionContext: null,
      activeMode: 'default' as BotMode,
      activeReplyMessage: null,
      assistantInput: "",
      thinkingEnabled: false,
      advisorEnabled: false,
      pendingAdvisorState: null,
      showPaidModels: false,
      manualTimezone: null,
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
        const sid = getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
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
      setReadMode: (entityId, value) => set((state) => ({ readModeStates: { ...state.readModeStates, [entityId]: value } })),
      setInterfaceSize: (interfaceSize) => set({ interfaceSize }),
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      toggleSidebarPinned: () => set((state) => ({ isSidebarPinned: !state.isSidebarPinned })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setAiSidebarWidth: (width) => set({ aiSidebarWidth: width }),
      toggleToolbar: () => set((state) => ({ isToolbarVisible: !state.isToolbarVisible })),
      setToolbarVisible: (visible) => set({ isToolbarVisible: visible }),
      setChatNewNoteButtonVisible: (visible) => set({ isChatNewNoteButtonVisible: visible }),
      setToolbarPosition: (pos) => set({ toolbarPosition: pos }),
      toggleSplitView: () => {
        const state = get();
        if (state.splitViewActive) {
          // Exit split: keep left column entity as active
          let nextTabs = [...state.openTabIds];
          if (state.splitViewLeftId && !nextTabs.includes(state.splitViewLeftId)) {
            nextTabs.push(state.splitViewLeftId);
          }
          if (state.splitViewRightId && !nextTabs.includes(state.splitViewRightId)) {
            nextTabs.push(state.splitViewRightId);
          }
          set({
            splitViewActive: false,
            openTabIds: nextTabs,
            activeEntityId: state.splitViewLeftId ?? state.activeEntityId,
            activeTabId: state.splitViewLeftId ?? state.activeEntityId,
            splitViewLeftId: null,
            splitViewRightId: null,
            splitViewPinned: false,
            selectedSidebarIds: [],
          });
        } else {
          if (state.activeTabId === 'chat') return; // Chat cannot be in split view

          // Enter split
          let leftId: string;
          let rightId: string | null;
          let isPinned: boolean;
          let nextTabs = [...state.openTabIds];

          if (state.selectedSidebarIds.length === 2) {
            // Two entities selected in sidebar — open both side by side
            leftId = state.selectedSidebarIds[0];
            rightId = state.selectedSidebarIds[1];
            isPinned = false;
            // Ensure both are in openTabIds
            for (const id of [leftId, rightId]) {
              if (!nextTabs.includes(id)) nextTabs.push(id);
            }
          } else if (state.selectedSidebarIds.length === 1 && state.selectedSidebarIds[0] !== state.activeTabId) {
            // One entity selected in sidebar + another already active -> open both
            leftId = state.activeTabId ?? state.openTabIds[0] ?? 'dashboard';
            rightId = state.selectedSidebarIds[0];
            isPinned = false;
            // Ensure both are in openTabIds
            for (const id of [leftId, rightId]) {
              if (!nextTabs.includes(id)) nextTabs.push(id);
            }
          } else {
            // Default: active entity → left, paired entity → right (or empty)
            leftId = state.activeTabId ?? state.openTabIds[0] ?? 'dashboard';
            const leftEntity = state.entities.find(e => e.id === leftId);
            rightId = leftEntity?.pairedEntityId ?? null;
            isPinned = !!(leftEntity?.pairedEntityId);
          }

          const leftIsReal = leftId && (leftId === 'dashboard' || leftId === 'tracker' || state.entities.some(e => e.id === leftId));
          const rightIsReal = rightId && (rightId === 'dashboard' || rightId === 'tracker' || state.entities.some(e => e.id === rightId));
          if (!leftIsReal && !rightIsReal) {
            return; // Prevent entering split view with two empty columns
          }

          set({
            splitViewActive: true,
            splitViewLeftId: leftId,
            splitViewRightId: rightId,
            splitViewPinned: isPinned,
            splitViewPosition: 50,
            openTabIds: nextTabs,
            activeEntityId: leftId,
            activeTabId: leftId,
            selectedSidebarIds: [],
          });
        }
        get().syncUIStateToCloud();
      },
      setColumnEntity: (column, entityId) => {
        const state = get();
        if (column === 'left') {
          if (entityId && entityId === state.splitViewRightId) return;
          set({ splitViewLeftId: entityId });
          if (entityId) set({ activeEntityId: entityId, activeTabId: entityId });
        } else {
          if (entityId && entityId === state.splitViewLeftId) return;
          set({ splitViewRightId: entityId });
        }
        // Recompute pinned state
        const next = get();
        const leftE = next.entities.find(e => e.id === next.splitViewLeftId);
        const rightE = next.entities.find(e => e.id === next.splitViewRightId);
        const pinned = !!(leftE?.pairedEntityId && leftE.pairedEntityId === next.splitViewRightId &&
                           rightE?.pairedEntityId && rightE.pairedEntityId === next.splitViewLeftId);
        set({ splitViewPinned: pinned });
      },
      togglePin: () => {
        const state = get();
        const leftId = state.splitViewLeftId;
        const rightId = state.splitViewRightId;
        if (!leftId || !rightId) return;

        if (state.splitViewPinned) {
          // Unpin: clear pairedEntityId on both
          set(s => ({
            entities: s.entities.map(e =>
              e.id === leftId ? { ...e, pairedEntityId: null } :
              e.id === rightId ? { ...e, pairedEntityId: null } : e
            ),
            splitViewPinned: false,
          }));
        } else {
          // Pin: set bidirectional pairedEntityId
          set(s => ({
            entities: s.entities.map(e =>
              e.id === leftId ? { ...e, pairedEntityId: rightId } :
              e.id === rightId ? { ...e, pairedEntityId: leftId } : e
            ),
            splitViewPinned: true,
          }));
        }
      },
      swapColumns: () => {
        const state = get();
        set({
          splitViewLeftId: state.splitViewRightId,
          splitViewRightId: state.splitViewLeftId,
          activeEntityId: state.splitViewRightId ?? state.activeEntityId,
          activeTabId: state.splitViewRightId ?? state.activeTabId,
        });
        get().syncUIStateToCloud();
      },
      exitSplitView: () => {
        const state = get();
        const activeInSplit = state.splitViewLeftId ?? state.splitViewRightId;
        set({
          splitViewActive: false,
          activeEntityId: activeInSplit ?? state.activeEntityId,
          activeTabId: activeInSplit ?? state.activeEntityId,
          splitViewLeftId: null,
          splitViewRightId: null,
          splitViewPinned: false,
        });
      },
      setSplitViewPosition: (pos) => set({ splitViewPosition: Math.max(15, Math.min(85, pos)) }),
      setColumnDragOver: (col) => set({ columnDragOver: col }),
      toggleFullWidth: () => set((state) => ({ isFullWidth: !state.isFullWidth })),
      toggleTabsHeader: () => set((state) => ({ isTabsHeaderVisible: !state.isTabsHeaderVisible })),
      setAppStyle: (appStyle) => set({ appStyle }),
      setManualTimezone: (manualTimezone) => set({ manualTimezone }),

      setSpaces: (spaces) => {
        const prevSpaces = get().spaces;
        set({ spaces });
        // Only navigate to default space on first load (initial sync), not on every update.
        // activeSpaceId starts as 'ws-personal' (legacy default), treat as "unset".
        if (prevSpaces.length === 0) {
          const currentId = get().activeSpaceId;
          const isUnset = currentId === null || currentId === 'ws-personal';
          const defaultSpace = isUnset ? spaces.find(s => s.isDefault) : null;
          if (defaultSpace) {
            set({ activeSpaceId: defaultSpace.id });
            const nextRecent = [defaultSpace.id, ...get().recentEntityIds.filter(rid => rid !== defaultSpace.id)].slice(0, 10);
            set({ recentEntityIds: nextRecent });
            import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('recentEntityIds', nextRecent));
          }
        }
      },

      setActiveSpaceId: (id) => {
        set({ activeSpaceId: id, activeChatId: null, aiMessages: [], pendingNewChat: true, isTempChat: false });
        if (id && id !== 'dashboard') {
          const nextRecent = [id, ...get().recentEntityIds.filter(rid => rid !== id)].slice(0, 10);
          set({ recentEntityIds: nextRecent });
          import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('recentEntityIds', nextRecent));
        }
        // Reload chat conversations for the new space
        const { loadChatConversations } = get();
        loadChatConversations();
      },

      setTrackerFilterTags: (tags: string[]) => {
        set({ trackerFilterTags: tags });
      },
      setTrackerFilterEntityIds: (ids: string[]) => {
        set({ trackerFilterEntityIds: ids });
      },
      toggleTrackerFilterTag: (tag: string) => {
        set((state) => {
          const current = state.trackerFilterTags;
          if (current.includes(tag)) {
            return { trackerFilterTags: current.filter(t => t !== tag) };
          } else {
            return { trackerFilterTags: [...current, tag] };
          }
        });
      },
      toggleTrackerFilterEntityId: (id: string) => {
        set((state) => {
          const current = state.trackerFilterEntityIds;
          if (current.includes(id)) {
            return { trackerFilterEntityIds: current.filter(i => i !== id) };
          } else {
            return { trackerFilterEntityIds: [...current, id] };
          }
        });
      },
      clearTrackerFilters: () => {
        set({ trackerFilterTags: [], trackerFilterEntityIds: [] });
      },
      clearTrackerFilterTags: () => {
        set({ trackerFilterTags: [] });
      },
      clearTrackerFilterEntityIds: () => {
        set({ trackerFilterEntityIds: [] });
      },

      createSpace: (input) => {
        const id = input.id ?? generateId();
        const workspace: Space = {
          id,
          name: input.name ?? 'Space',
          type: input.type ?? 'personal',
          ownerId: input.ownerId ?? null,
          createdAt: Date.now(),
          lastModified: Date.now(),
          icon: input.icon,
          color: input.color,
          settings: input.settings,
          syncMode: 'cloud-only',
        };
        set(s => ({ spaces: [...s.spaces, workspace] }));
        debouncedPushSpace(workspace);
        return id;
      },

      updateSpace: (id, patch) => {
        set(s => ({
          spaces: s.spaces.map(w => w.id === id ? { ...w, ...patch, lastModified: Date.now() } : w),
        }));
        const updated = get().spaces.find(w => w.id === id);
        if (updated) debouncedPushSpace(updated);
      },

      deleteSpace: (id) => {
        set(s => ({
          spaces: s.spaces.filter(w => w.id !== id),
          activeSpaceId: s.activeSpaceId === id
            ? (s.spaces.find(w => w.id !== id)?.id ?? null)
            : s.activeSpaceId,
        }));
        import('@/lib/sync').then(({ deleteSpaceFromDB }) => deleteSpaceFromDB(id));
      },

      deleteAllSpaceData: async (spaceId) => {
        const state = get();

        // Phase 1: Delete tasks FIRST (they have FK constraint to entities)
        const spaceTasks = state.tasks.filter(t => t.spaceId === spaceId);
        if (spaceTasks.length > 0) {
          const { deleteTaskFromDB } = await import('@/lib/sync');
          await Promise.all(spaceTasks.map(t => deleteTaskFromDB(t.id)));
        }

        // Phase 2: Delete entities (now that FK-blocking tasks are gone)
        const spaceEntities = state.entities.filter(e => e.spaceId === spaceId);
        if (spaceEntities.length > 0) {
          const { deleteEntityFromDB } = await import('@/lib/sync');
          await Promise.all(spaceEntities.map(e => deleteEntityFromDB(e.id)));
        }

        // Phase 3: Delete conversations
        const spaceConvs = state.chatConversations.filter(c => c.space_id === spaceId);
        if (spaceConvs.length > 0) {
          const { deleteConversation } = await import('@/lib/chat');
          await Promise.all(spaceConvs.map(c => deleteConversation(c.id)));
        }

        // Phase 4: Remove scoped shortcut keys for this space
        const currentShortcuts = { ...state.shortcuts };
        let shortcutsChanged = false;
        for (const key of Object.keys(currentShortcuts)) {
          if (key.startsWith(`${spaceId}:`)) {
            delete currentShortcuts[key];
            shortcutsChanged = true;
          }
        }
        if (shortcutsChanged) {
          set({ shortcuts: currentShortcuts });
          const { upsertSetting } = await import('@/lib/sync');
          await upsertSetting('shortcuts', currentShortcuts);
        }

        // Phase 5: Delete the space itself
        const { deleteSpaceFromDB } = await import('@/lib/sync');
        await deleteSpaceFromDB(spaceId);

        // Clear local cache and reload
        localStorage.removeItem('flowr-storage');
        window.location.reload();
      },

      setAIKey: (aiApiKey) => {
        if (aiApiKey) localStorage.setItem('flowr_ai_key', aiApiKey);
        else localStorage.removeItem('flowr_ai_key');
        set({ aiApiKey });
      },
      toggleAIAssistant: () => set((state) => ({
        isAIAssistantOpen: !state.isAIAssistantOpen,
        isTaskPanelOpen: state.isAIAssistantOpen ? state.isTaskPanelOpen : false,
        activeTaskId: state.isAIAssistantOpen ? state.activeTaskId : null,
      })),
      setAIAssistantOpen: (open) => set({ isAIAssistantOpen: open }),
      openTaskPanel: (taskId: string, presets?: Partial<AppTask>) => set((state) => ({
        isTaskPanelOpen: true,
        activeTaskId: taskId,
        taskPanelPresets: presets || null,
        aiWasOpenBeforeTaskPanel: state.isAIAssistantOpen,
        isAIAssistantOpen: false,
      })),
      closeTaskPanel: () => set((state) => ({
        isTaskPanelOpen: false,
        activeTaskId: null,
        taskPanelPresets: null,
        isAIAssistantOpen: state.aiWasOpenBeforeTaskPanel,
        aiWasOpenBeforeTaskPanel: false,
      })),
      setTaskPanelWidth: (width) => set({ taskPanelWidth: width }),
      setAISessionContext: (context) => set({ aiSessionContext: context }),
      
      fetchAISessionContext: async (chatId) => {
        let sessionData: any = null;
        let fetchSuccess = false;
        try {
          const res = await fetch(`/api/ai/memory/context?chatId=${encodeURIComponent(chatId)}&t=${Date.now()}`);
          if (res.ok) {
            sessionData = await res.json();
            fetchSuccess = true;
          }
        } catch (err) {
          console.error('Failed to fetch session context:', err);
        }
        
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
            ...(fetchSuccess ? { sessionContextsMap: { ...s.sessionContextsMap, [chatId]: sessionData } } : {})
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
        const sid = getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
        set(s => ({
          aiMessages: [],
          tempChatMessages: [],
          aiSessionContext: null,
          activeMode: 'default',
          thinkingEnabled: false,
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
        
        const { activeEntityId, activeSpaceId, isTempChat, activeChatId } = get();
        const sid = getChatSessionId(null, activeEntityId, activeSpaceId, 'temp');
        
        // If already in temp chat for this entity, click should clear it
        if (isTempChat && activeChatId === null) {
          await get().clearAIChat();
          return;
        }

        set(s => {
          const existingMessages = s.chatMessagesMap[sid] || [];
          const existingContext = s.sessionContextsMap[sid] || null;
          const existingInput = s.chatInputs[sid] || '';

          return {
            activeChatId: null,
            newEmptyChatId: null,
            isTempChat: true,
            pendingNewChat: false,
            showTempNotice: true,
            tempChatMessages: existingMessages,
            aiMessages: existingMessages,
            aiSessionContext: existingContext,
            pendingAdvisorState: null,
            assistantInput: existingInput,
            isAILoading: s.loadingStatesMap[sid] || false,
            tempChatGreeting: existingMessages.length > 0 ? s.tempChatGreeting : getRandomTempGreeting(),
          };
        });

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
          activeMode: 'default',
          thinkingEnabled: false,
        });
      },

      loadConversation: async (id: string) => {
        await get().cleanupActiveChatIfEmpty();
        const sid = getChatSessionId(id, get().activeEntityId, get().activeSpaceId, 'global');

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
            aiSessionContext: get().sessionContextsMap[sid] || null,
            pendingAdvisorState: null,
            assistantInput: get().chatInputs[id] || '',
            isAILoading: true,
            aiAbortController: get().abortControllersMap[id] || null,
          });
          return;
        }

        if (!isSupabaseEnabled) {
          const localMsgs = get().chatMessagesMap[id] || [];
          set({
            activeChatId: id,
            isTempChat: false,
            pendingNewChat: false,
            tempChatMessages: [],
            aiMessages: localMsgs,
            chatMessagesMap: { ...get().chatMessagesMap, [id]: localMsgs },
            aiSessionContext: get().sessionContextsMap[sid] || null,
            pendingAdvisorState: null,
            assistantInput: get().chatInputs[id] || '',
            isAILoading: false,
            aiAbortController: null,
          });
          return;
        }

        try {
          set({ isChatMessagesLoading: true });
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
            intentTag: (m as any).intentTag,
            toolResults: (m as any).toolResults,
            citations: (m as any).citations,
            tokens_used: (m as any).tokens_used,
          }));
          set(s => ({
            activeChatId: id,
            isTempChat: false,
            pendingNewChat: false,
            tempChatMessages: [],
            aiMessages: aiMsgs,
            chatMessagesMap: { ...s.chatMessagesMap, [id]: aiMsgs },
            aiSessionContext: s.sessionContextsMap[sid] || null,
            pendingAdvisorState: null,
            assistantInput: s.chatInputs[id] || '',
            isAILoading: false,
            isChatMessagesLoading: false,
            aiAbortController: null,
          }));
          get().fetchAISessionContext(sid);
        } catch (e) {
          console.error('Failed to load conversation', e);
          set({ isChatMessagesLoading: false });
          const localMsgs = get().chatMessagesMap[id] || [];
          set({
            activeChatId: id,
            isTempChat: false,
            pendingNewChat: false,
            tempChatMessages: [],
            aiMessages: localMsgs,
            chatMessagesMap: { ...get().chatMessagesMap, [id]: localMsgs },
            aiSessionContext: get().sessionContextsMap[sid] || null,
            pendingAdvisorState: null,
            assistantInput: get().chatInputs[id] || '',
            isAILoading: false,
            aiAbortController: null,
          });
        }
      },

      deleteChatConversation: async (id: string) => {
        try {
          if (isSupabaseEnabled) {
            await deleteConversationFromDB(id);
          }
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

      toggleFavoriteChatConversation: async (id: string, is_favorite: boolean) => {
        try {
          await updateConversationFavorite(id, is_favorite);
          set(s => ({
            chatConversations: s.chatConversations.map(c =>
              c.id === id ? { ...c, is_favorite, updated_at: new Date().toISOString() } : c
            ),
          }));
        } catch (e) {
          console.error('Failed to toggle favorite conversation', e);
        }
      },

      loadChatConversations: async () => {
        if (!isSupabaseEnabled) {
          set({ isChatHistoryLoading: false });
          return;
        }
        try {
          set({ isChatHistoryLoading: true });
          const { activeSpaceId } = get();
          const convs = await fetchConversations(activeSpaceId || undefined);
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
          set({ chatConversations: cleanConvs, isChatHistoryLoading: false });

          if (toDelete.length > 0) {
            console.log(`[Store] Background cleaning up ${toDelete.length} empty conversations:`, toDelete);
            Promise.all(toDelete.map(id => deleteConversationFromDB(id))).catch(err => {
              console.error('Failed background cleanup of empty conversations:', err);
            });
          }
        } catch (e) {
          console.error('Failed to load conversations', e);
          set({ isChatHistoryLoading: false });
        }
      },

      saveTempChat: async () => {
        const { aiMessages, chatConversations, aiSessionContext, activeSpaceId } = get()
        try {
          let conv;
          if (!isSupabaseEnabled) {
            conv = {
              id: crypto.randomUUID(),
              user_id: 'local',
              title: 'New Chat',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
              space_id: activeSpaceId || undefined,
            };
          } else {
            conv = await createConversation('New Chat', activeSpaceId || undefined)
          }

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
            if (isSupabaseEnabled) {
              await updateConversationTitle(conv.id, title)
            }
            conv.title = title
          }
          const mapped = userAndAssistant.map(m => ({
            id: m.id || crypto.randomUUID(),
            role: m.role as 'user' | 'assistant',
            content: m.content || '',
            model: m.model,
            timestamp: m.timestamp || Date.now(),
            pipelineSteps: m.pipelineSteps,
            image_description: m.image_description,
            image_prompt: (m as any).image_prompt,
            attachments: m.attachments,
            toolResults: m.toolResults,
            citations: m.citations,
          }))
          set((s) => ({
            activeChatId: conv.id,
            isTempChat: false,
            tempChatMessages: [],
            chatConversations: [conv, ...chatConversations],
            chatMessagesMap: { ...s.chatMessagesMap, [conv.id]: mapped },
            aiMessages: mapped,
          }))
          const sid = getChatSessionId(conv.id, get().activeEntityId, get().activeSpaceId, 'global');
          get().fetchAISessionContext(sid)
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
          const sid = getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, 'global');
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
        const sid = chatId || getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
        const currentActiveId = getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
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
        } else {
          await get().fetchAISessionContext(sid);
        }
      },
      markMessageRevealed: (messageId) => {
        // Marks a single message as having finished its word-reveal animation
        // (persisted, unlike component-local state, so a chat-panel remount
        // doesn't replay the reveal). Called from ChatMessage once its own
        // useWordReveal instance reports isRevealing === false, NOT from
        // finishAILoading — the network stream can finish well before the
        // (fixed-pace) reveal animation catches up, and marking too early
        // would cut the animation off instead of letting it finish naturally.
        const mark = (m: AIMessage) => m.id === messageId ? { ...m, hasRevealed: true } : m;
        set(s => {
          const nextChatMessagesMap: typeof s.chatMessagesMap = {};
          let changed = false;
          for (const [sid, msgs] of Object.entries(s.chatMessagesMap)) {
            if (msgs.some(m => m.id === messageId)) {
              nextChatMessagesMap[sid] = msgs.map(mark);
              changed = true;
            } else {
              nextChatMessagesMap[sid] = msgs;
            }
          }
          return {
            ...(changed ? { chatMessagesMap: nextChatMessagesMap } : {}),
            aiMessages: s.aiMessages.some(m => m.id === messageId) ? s.aiMessages.map(mark) : s.aiMessages,
            tempChatMessages: s.tempChatMessages.some(m => m.id === messageId) ? s.tempChatMessages.map(mark) : s.tempChatMessages,
          };
        });
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
      setReplyMessage: (msg) => set({ activeReplyMessage: msg }),
      setShowPaidModels: (show) => set({ showPaidModels: show }),
      setAssistantInput: (input) => {
        const { activeChatId, activeEntityId, isTempChat } = get();
        const sid = getChatSessionId(activeChatId, activeEntityId, get().activeSpaceId, isTempChat ? 'temp' : 'global');
        set(s => ({
          assistantInput: input,
            chatInputs: { ...s.chatInputs, [sid]: input }
        }));
      },

      sendAIMessage: async (content, attachments = [], pageContext, isHidden = false) => {
        const CHAIN_TAGS = ['/search', '/research', '/image'];
        const parts = content.trim().split(' ');
        const extractedIntent = CHAIN_TAGS.includes(parts[0]) ? parts[0] : null;
        const cleanContent = extractedIntent ? content.trim().substring(extractedIntent.length).trim() : content;

        if (!cleanContent && attachments.length === 0 && !extractedIntent) return;

        // --- STEP 1: Compute UI state immediately ---
        const { aiMessages, activeReplyMessage, isTempChat, activeChatId, activeEntityId, activeSpaceId, pendingNewChat } = get();

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
          content: cleanContent,
          intentTag: extractedIntent || undefined,
          isHidden,
          timestamp: Date.now(),
          attachments,
        };

        const placeholderMessage: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        };

        const initialTargetChatId = getChatSessionId(activeChatId, activeEntityId, activeSpaceId, isTempChat ? 'temp' : 'global');

        // Optimistically trigger UI transition and append messages
        set(s => {
          const baseMessages = s.pendingNewChat ? [] : (s.chatMessagesMap[initialTargetChatId] || s.aiMessages);
          const updated = [...baseMessages, userMessage, placeholderMessage];
          return {
            chatMessagesMap: {
              ...s.chatMessagesMap,
              [initialTargetChatId]: updated
            },
            aiMessages: updated,
            ...(isTempChat ? { tempChatMessages: updated } : {}),
            newEmptyChatId: null,
            activeReplyMessage: null,
            isAILoading: true,
            loadingStatesMap: { ...s.loadingStatesMap, [initialTargetChatId]: true }
          };
        });

        // --- STEP 2: Create conversation on server if needed ---
        let finalActiveChatId = activeChatId;

        // Create pending new chat on first message
        if (pendingNewChat) {
          let conv;
          if (!isSupabaseEnabled) {
            const title = cleanContent.slice(0, 60);
            conv = {
              id: crypto.randomUUID(),
              user_id: 'local',
              title: title,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_archived: false,
              space_id: activeSpaceId || undefined,
            };
          } else {
            conv = await createConversation('New Chat', activeSpaceId || undefined);
            if (conv) {
              const title = cleanContent.slice(0, 60);
              await updateConversationTitle(conv.id, title);
              conv.title = title;
            }
          }

          if (conv) {
            finalActiveChatId = conv.id;
            const newTargetChatId = getChatSessionId(conv.id, activeEntityId, activeSpaceId, 'global');
            
            set(s => {
              const currentMessages = s.aiMessages;
              return {
                activeChatId: conv.id,
                pendingNewChat: false,
                isTempChat: false,
                chatConversations: [conv, ...s.chatConversations],
                chatMessagesMap: {
                  ...s.chatMessagesMap,
                  [initialTargetChatId]: [],
                  [newTargetChatId]: currentMessages
                },
                loadingStatesMap: {
                  ...s.loadingStatesMap,
                  [newTargetChatId]: true
                }
              };
            });
            await get().fetchAISessionContext(newTargetChatId);
          } else {
            set({ pendingNewChat: false, isTempChat: true });
          }
        }

        const isTemp = get().isTempChat;
        const aiApiKey = get().aiApiKey;
        const aiClassificationModelId = get().aiClassificationModelId;
        const activeMode = get().activeMode;
        const pendingState = get().pendingAdvisorState;
        const thinkingEnabled = get().thinkingEnabled;
        const advisorEnabled = get().advisorEnabled;
        const finalTargetChatId = getChatSessionId(finalActiveChatId, activeEntityId, activeSpaceId, isTemp ? 'temp' : 'global');

        // Persist user message if in a named conversation (and not hidden tool result)
        if (finalActiveChatId && !isTemp && !isHidden) {
          insertMessage(finalActiveChatId, 'user', content, undefined, undefined, undefined, undefined, attachments, undefined, extractedIntent || undefined).catch(e => console.warn('[Store] Failed to persist user message:', e));
        }

        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };

          if (isSupabaseEnabled) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              headers['Authorization'] = `Bearer ${session.access_token}`;
            }
          }

          // Resolve attachment URLs (storage links included) to base64 for the vision payload
          const resolvedAttachments = await resolveAttachmentsForVision(attachments);

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
              
              if (m.role === 'user' && m.attachments) {
                const textAttachments = m.attachments.filter(a => a.type === 'text' && a.textContent);
                if (textAttachments.length > 0) {
                  text += '\n\n' + textAttachments.map(a => `[ATTACHED FILE: ${a.name}]\n${a.textContent}\n`).join('\n\n');
                }
              }

              return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text }] }
            })

          const controller = new AbortController();
          set(s => ({
            aiAbortController: s.activeChatId === finalTargetChatId || (!s.activeChatId && finalTargetChatId === 'temp' && s.isTempChat) ? controller : s.aiAbortController,
            abortControllersMap: { ...s.abortControllersMap, [finalTargetChatId]: controller }
          }));

          let finalPrompt = content;
          const textAttachments = resolvedAttachments.filter(a => a.type === 'text' && a.textContent);
          if (textAttachments.length > 0) {
            finalPrompt += '\n\n' + textAttachments.map(a => `[ATTACHED FILE: ${a.name}]\n${a.textContent}\n`).join('\n\n');
          }
          
          if (finalPrompt.trim() === '' && imageAttachments.length > 0) {
            finalPrompt = 'Please analyze the attached file(s).';
          }

          const res = await fetch('/api/ai/chat', {
            method: 'POST',
            headers,
            signal: controller.signal,
            body: JSON.stringify({
              prompt: finalPrompt,
              buffer: imageBuffer,
              images: imagesArray,
              activeEntityId: finalTargetChatId,
              activeChatId: finalActiveChatId,
              aiApiKey,
              activeSpaceId,
              classificationModelId: aiClassificationModelId,
              mode: activeMode,
              intentTag: extractedIntent,
              replyContext,
              thinkingEnabled,
              advisorEnabled,
              pendingAdvisorState: pendingState,
              isTempChat: isTemp,
              clientHistory: historyMessages,
              pageContext: pageContext ?? null,
              clientTime: getClientTime(get().manualTimezone),
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Request failed' }));
            set(s => {
              const updated = (s.chatMessagesMap[finalTargetChatId] || []).map(m => m.id === placeholderMessage.id
                ? { ...m, content: err.error || 'Something went wrong.', model: err.model || 'system' }
                : m
              );
              const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.activeSpaceId, s.isTempChat ? 'temp' : 'global');
              const isActive = currentActiveId === finalTargetChatId;
              return {
                chatMessagesMap: { ...s.chatMessagesMap, [finalTargetChatId]: updated },
                ...(isActive ? { aiMessages: updated } : {}),
                ...(isTemp ? { tempChatMessages: updated } : {})
              };
            });
            await get().finishAILoading(finalTargetChatId);
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
            let lastTokensUsed: number | undefined = undefined;

            if (reader) {
              let flushTimer: ReturnType<typeof setTimeout> | null = null;
              let pendingContent = '';

              const flushUpdate = () => {
                flushTimer = null;
                const contentToSet = pendingContent;
                set((s) => {
                  const updatedMessages = (s.chatMessagesMap[finalTargetChatId] || []).map((m) =>
                    m.id === placeholderMessage.id
                  ? {
                      ...m,
                      content: contentToSet,
                      model: lastModel || m.model,
                      tokens_used: lastTokensUsed !== undefined ? lastTokensUsed : m.tokens_used,
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
                  const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.activeSpaceId, s.isTempChat ? 'temp' : 'global');
                  const isActive = currentActiveId === finalTargetChatId;
                  return {
                    chatMessagesMap: { ...s.chatMessagesMap, [finalTargetChatId]: updatedMessages },
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
                      } else if (parsed.content !== undefined || parsed.model !== undefined || parsed.toolResults !== undefined) {
                        const isFinalMetadata = parsed.type !== undefined;
                        if (isFinalMetadata && accumulatedContent.length > 0) {
                          // Final metadata with streamed content before it — skip to avoid double
                        } else {
                          // Streaming chunk, or final metadata with no prior stream (e.g. advisor)
                          accumulatedContent = isFinalMetadata ? (parsed.content || accumulatedContent) : accumulatedContent + (parsed.content || '');
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
                        if ((parsed as any).toolResults) {
                          lastToolResults = (parsed as any).toolResults;
                          get().syncToolResults(lastToolResults);
                        }
                        if ((parsed as any).advisor_questions) lastAdvisorQuestions = (parsed as any).advisor_questions;
                        if ((parsed as any).advisor_state) lastAdvisorState = (parsed as any).advisor_state;
                        if (parsed.tokens_used) lastTokensUsed = parsed.tokens_used;
                      } else if (parsed.status) {
                        set((s) => {
                          const updated = (s.chatMessagesMap[finalTargetChatId] || []).map((m) =>
                            m.id === placeholderMessage.id
                              ? { ...m, status: parsed.status }
                              : m
                          );
                          const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.activeSpaceId, s.isTempChat ? 'temp' : 'global');
                          const isActive = currentActiveId === finalTargetChatId;
                          return {
                            chatMessagesMap: { ...s.chatMessagesMap, [finalTargetChatId]: updated },
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
              if (!accumulatedContent && (!lastToolResults || lastToolResults.length === 0)) {
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
            await get().finishAILoading(finalTargetChatId);

            // ====== ZERO-LOOP XML INTERCEPTOR ======
            // Intercept complete XML tool calls from the AI response
            if (lastModel !== 'system' && accumulatedContent) {
              const xmlRegex = /<(create_note|edit_note|delete_entity|move_entity|read_tasks|read_workspace_content|read_all_content|web_search|deep_research|generate_image)[^>]*>([\s\S]*?)<\/\1>|<(delete_entity|move_entity|read_tasks|read_workspace_content|read_all_content)[^>]*\/>/i;
              const match = accumulatedContent.match(xmlRegex);
              if (match) {
                const tagFull = match[0];
                const tagName = (match[1] || match[3] || '').toLowerCase();
                const innerContent = match[2] || '';
                
                let resultObj: any = { success: false, error: 'Unknown tool' };
                let toolResultItem: any = null;
                
                try {
                  if (tagName === 'create_note') {
                    const lines = innerContent.trim().split('\\n');
                    const title = lines[0].startsWith('# ') ? lines[0].substring(2) : 'New Note';
                    const id = get().addEntity({ type: 'note', title, content: [] });
                    resultObj = { success: true, id, title };
                    toolResultItem = {
                      tool: 'create_content',
                      type: 'note',
                      success: true,
                      id,
                      title,
                    };
                  } else if (tagName === 'delete_entity') {
                    const idMatch = tagFull.match(/id="([^"]+)"/);
                    if (idMatch) {
                      get().deleteEntity(idMatch[1]);
                      resultObj = { success: true, message: `Entity ${idMatch[1]} deleted.` };
                      toolResultItem = {
                        tool: 'delete_content',
                        success: true,
                        id: idMatch[1],
                      };
                    } else {
                      resultObj = { success: false, error: 'Missing id attribute' };
                    }
                  } else if (tagName === 'edit_note') {
                    const idMatch = tagFull.match(/id="([^"]+)"/);
                    if (idMatch) {
                      // Note: proper block parsing would go here
                      get().updateEntityContent(idMatch[1], [{ id: crypto.randomUUID(), type: 'text', content: innerContent }]);
                      resultObj = { success: true, message: `Note ${idMatch[1]} updated.` };
                      toolResultItem = {
                        tool: 'update_content',
                        type: 'note',
                        success: true,
                        id: idMatch[1],
                      };
                    } else {
                      resultObj = { success: false, error: 'Missing id attribute' };
                    }
                  } else if (tagName === 'read_tasks') {
                    const statusMatch = tagFull.match(/status="([^"]+)"/);
                    const priorityMatch = tagFull.match(/priority="([^"]+)"/);
                    const tagMatch = tagFull.match(/tag="([^"]+)"/);
                    const dueDateMatch = tagFull.match(/due_date="([^"]+)"/);
                    const wsMatch = tagFull.match(/spaceId="([^"]+)"/);
                    
                    let filteredTasks = get().tasks;
                    if (statusMatch) filteredTasks = filteredTasks.filter(t => t.status === statusMatch[1]);
                    if (priorityMatch) filteredTasks = filteredTasks.filter(t => t.priority === priorityMatch[1]);
                    if (tagMatch) filteredTasks = filteredTasks.filter(t => t.tag === tagMatch[1]);
                    if (dueDateMatch) filteredTasks = filteredTasks.filter(t => t.dueDate === dueDateMatch[1]);
                    if (wsMatch) filteredTasks = filteredTasks.filter(t => t.spaceId === wsMatch[1] || (wsMatch[1] === 'ws-personal' && !t.spaceId));

                    const tasks = filteredTasks.map(t => ({
                      id: t.id,
                      title: t.title,
                      status: t.status,
                      priority: t.priority,
                      due_date: t.dueDate,
                      spaceId: t.spaceId || 'ws-personal',
                      tag: t.tag,
                      description: t.description || t.note,
                      subtasks: t.subtasks?.map(st => ({ text: st.text, completed: st.completed })),
                      attachments: t.attachments?.map(a => ({ name: a.name, type: a.type }))
                    }));
                    resultObj = { success: true, tasks };
                    toolResultItem = {
                      tool: 'read_tasks',
                      success: true,
                    };
                  } else if (tagName === 'read_workspace_content') {
                    const wsMatch = tagFull.match(/spaceId="([^"]+)"/);
                    const targetWsId = wsMatch ? wsMatch[1] : get().activeSpaceId;
                    const entities = get().entities
                      .filter(e => e.spaceId === targetWsId || (targetWsId === 'ws-personal' && !e.spaceId))
                      .map(e => ({ id: e.id, title: e.title, type: e.type }));
                    resultObj = { success: true, entities };
                    toolResultItem = {
                      tool: 'read_workspace_content',
                      success: true,
                    };
                  } else if (tagName === 'read_all_content') {
                    const entities = get().entities.map(e => ({ id: e.id, title: e.title, type: e.type }));
                    const tasks = get().tasks.map(t => ({ id: t.id, title: t.title, type: 'task' }));
                    resultObj = { success: true, entities, tasks };
                    toolResultItem = {
                      tool: 'read_all_content',
                      success: true,
                    };
                  } else {
                    // For tools handled by backend or not locally mockable yet (like web_search),
                    // they shouldn't trigger local intercept loop directly unless backend delegates it.
                    // But if they do, we'll just acknowledge it.
                    resultObj = { success: true, message: `Tool ${tagName} intercepted.` };
                    toolResultItem = {
                      tool: tagName,
                      success: true,
                    };
                  }
                } catch (err: any) {
                  resultObj = { success: false, error: err?.message || 'Execution failed' };
                  toolResultItem = {
                    tool: tagName === 'create_note' ? 'create_content' : tagName === 'edit_note' ? 'update_content' : tagName,
                    type: tagName === 'create_note' || tagName === 'edit_note' ? 'note' : undefined,
                    success: false,
                    error: err?.message || 'Execution failed',
                  };
                }

                if (toolResultItem) {
                  set((s) => {
                    const updated = (s.chatMessagesMap[finalTargetChatId] || []).map((m) => {
                      if (m.id === placeholderMessage.id || m.id === get().aiMessages[get().aiMessages.length - 1]?.id) {
                        return {
                          ...m,
                          toolResults: [...(m.toolResults || []), toolResultItem]
                        };
                      }
                      return m;
                    });
                    return {
                      chatMessagesMap: { ...s.chatMessagesMap, [finalTargetChatId]: updated },
                      aiMessages: updated,
                    };
                  });
                }

                // Silently re-enter API with the result
                const toolResultMsg = `[TOOL RESULT: ${tagName}]\\n${JSON.stringify(resultObj)}`;
                setTimeout(() => {
                  get().sendAIMessage(toolResultMsg, [], undefined, true);
                }, 500);
              }
            }
            // =======================================

            // Backfill image_description onto the user message so future history
            // turns can reference what was in the image, even for non-vision chains
            if (lastImageDescription) {
              set(s => {
                const updated = (s.chatMessagesMap[finalTargetChatId] || []).map(m =>
                  m.id === userMessage.id ? { ...m, image_description: lastImageDescription } : m
                );
                const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.activeSpaceId, s.isTempChat ? 'temp' : 'global');
                const isActive = currentActiveId === finalTargetChatId;
                return {
                  chatMessagesMap: { ...s.chatMessagesMap, [finalTargetChatId]: updated },
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
            if (finalActiveChatId && !isTemp && accumulatedContent) {
              insertMessage(finalActiveChatId, 'assistant', accumulatedContent, lastModel, lastPipelineSteps, lastImageDescription, lastImagePrompt, undefined, lastCitations, undefined, lastToolResults).catch(e => console.warn('[Store] Failed to persist assistant message:', e));
              // Auto-set title from first message if still default
              const conv = get().chatConversations.find(c => c.id === finalActiveChatId);
              if (conv && conv.title === 'New Chat' && content) {
                const title = content.slice(0, 60);
                get().renameChatConversation(finalActiveChatId, title);
              }
            }

            // Process toolResults: sync Zustand store with server-side tool changes
            // syncToolResults is already called inline during streaming (L1604).
            // Removed redundant call here to prevent double-appends.

            return;
          }

          const data = await res.json();
          set(s => {
            const updated = (s.chatMessagesMap[finalTargetChatId] || []).map(m => {
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
            const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.activeSpaceId, s.isTempChat ? 'temp' : 'global');
            const isActive = currentActiveId === finalTargetChatId;
            return {
              chatMessagesMap: { ...s.chatMessagesMap, [finalTargetChatId]: updated },
              ...(isActive ? { aiMessages: updated } : {}),
              ...(isTemp ? { tempChatMessages: updated } : {}),
            };
          });
          await get().finishAILoading(finalTargetChatId);

          // Persist non-streaming assistant reply
          if (finalActiveChatId && !isTemp && data.content) {
            insertMessage(finalActiveChatId, 'assistant', data.content, data.model, data.pipeline_steps, data.image_description, data.image_prompt, undefined, undefined, undefined, (data as any).toolResults).catch(e => console.warn('[Store] Failed to persist non-stream assistant message:', e));
            // Auto-set title from first message if still default
            const conv = get().chatConversations.find(c => c.id === finalActiveChatId);
            if (conv && conv.title === 'New Chat' && content) {
              const title = content.slice(0, 60);
              get().renameChatConversation(finalActiveChatId, title);
            }
          }
        } catch (e: any) {
          if (e?.name === 'AbortError') {
            const interruptedContent = 'Generation stopped by user.';
            set(s => {
              const updated = (s.chatMessagesMap[finalTargetChatId] || []).map(m =>
                m.id === placeholderMessage.id
                  ? { ...m, content: interruptedContent, interrupted: true }
                  : m
              );
              const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.activeSpaceId, s.isTempChat ? 'temp' : 'global');
              const isActive = currentActiveId === finalTargetChatId;
              return {
                chatMessagesMap: { ...s.chatMessagesMap, [finalTargetChatId]: updated },
                ...(isActive ? { aiMessages: updated } : {}),
                ...(isTemp ? { tempChatMessages: updated } : {}),
              };
            });
            await get().finishAILoading(finalTargetChatId);
            if (finalActiveChatId && !isTemp) {
              insertMessage(finalActiveChatId, 'assistant', interruptedContent).catch(e => console.warn('[Store] Failed to persist interrupted message:', e));
            }
          } else {
            const errMsg = e?.message ? `Connection error: ${e.message}. Please check your connection and try again.` : 'Connection error. Please try again.';
            set(s => {
              const updated = (s.chatMessagesMap[finalTargetChatId] || []).map(m => m.id === placeholderMessage.id
                ? { ...m, content: errMsg, model: 'system' }
                : m
              );
              const currentActiveId = getChatSessionId(s.activeChatId, s.activeEntityId, s.activeSpaceId, s.isTempChat ? 'temp' : 'global');
              const isActive = currentActiveId === finalTargetChatId;
              return {
                chatMessagesMap: { ...s.chatMessagesMap, [finalTargetChatId]: updated },
                ...(isActive ? { aiMessages: updated } : {}),
                ...(isTemp ? { tempChatMessages: updated } : {}),
              };
            });
            await get().finishAILoading(finalTargetChatId);
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

          // Resolve attachment URLs (storage links included) to base64 for the vision payload
          const resolvedAttachments = await resolveAttachmentsForVision(userAttachments);

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
              prompt: (() => {
                const CHAIN_TAGS = ['/search', '/research', '/image'];
                const parts = userContent.trim().split(' ');
                const extractedIntent = CHAIN_TAGS.includes(parts[0]) ? parts[0] : null;
                return extractedIntent ? userContent.trim().substring(extractedIntent.length).trim() : userContent;
              })(),
              buffer: imageBuffer,
              images: imagesArray,
              activeEntityId: get().activeEntityId,
              activeChatId: get().activeChatId,
              aiApiKey: get().aiApiKey,
              activeSpaceId: get().activeSpaceId,
              classificationModelId: get().aiClassificationModelId,
              mode: get().activeMode,
              intentTag: (() => {
                const CHAIN_TAGS = ['/search', '/research', '/image'];
                const parts = userContent.trim().split(' ');
                return CHAIN_TAGS.includes(parts[0]) ? parts[0] : null;
              })(),
              replyContext: null,
              thinkingEnabled: get().thinkingEnabled,
              advisorEnabled: get().advisorEnabled,
              isTempChat: get().isTempChat,
              clientHistory: historyMessages,
              clientTime: getClientTime(get().manualTimezone),
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
          nextRecent = [id, ...nextRecent.filter(rid => rid !== id)].slice(0, 10);
          import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('recentEntityIds', nextRecent));
        }

        let nextTabs = [...state.openTabIds];

        // Auto-split: if the opened entity has a pairedEntityId, enter split view
        const openingEntity = id ? state.entities.find(e => e.id === id) : null;
        const pairedId = openingEntity?.pairedEntityId;
        if (id && pairedId && !state.splitViewActive) {
          const pairedEntity = state.entities.find(e => e.id === pairedId);
          if (pairedEntity) {
            // Ensure paired entity is also in openTabIds
            if (!nextTabs.includes(pairedId)) {
              nextTabs.push(pairedId);
            }
            set({
              openTabIds: nextTabs,
              activeTabId: id,
              activeEntityId: id,
              recentEntityIds: nextRecent,
              splitViewActive: true,
              splitViewLeftId: id,
              splitViewRightId: pairedId,
              splitViewPinned: true,
              splitViewPosition: 50,
            });
            const newHistory = state.navigationHistory.slice(0, state.historyIndex + 1);
            newHistory.push(id);
            set({
              navigationHistory: newHistory,
              historyIndex: newHistory.length - 1,
            });
            return;
          }
        }

        // When split view is active and the user navigates, replace the current active column
        // rather than exiting split view.
        if (state.splitViewActive && id && id !== state.splitViewLeftId && id !== state.splitViewRightId) {
          if (id === 'chat') {
            // Chat forces exit of split view
            if (!nextTabs.includes(id)) {
              nextTabs.push(id);
            }
            set({
              openTabIds: nextTabs,
              activeTabId: id,
              activeEntityId: id,
              splitViewActive: false,
              splitViewLeftId: null,
              splitViewRightId: null,
              splitViewPinned: false,
              recentEntityIds: nextRecent,
            });
            const newHistory = state.navigationHistory.slice(0, state.historyIndex + 1);
            newHistory.push(id);
            set({
              navigationHistory: newHistory,
              historyIndex: newHistory.length - 1,
            });
            return;
          }

          const isLeftActive = state.activeEntityId === state.splitViewLeftId;
          const newLeftId = isLeftActive ? id : state.splitViewLeftId;
          const newRightId = !isLeftActive ? id : state.splitViewRightId;
          
          if (!nextTabs.includes(id)) {
            nextTabs.push(id);
          }
          
          set({
            openTabIds: nextTabs,
            activeTabId: id,
            activeEntityId: id,
            splitViewLeftId: newLeftId,
            splitViewRightId: newRightId,
            splitViewPinned: false,
            recentEntityIds: nextRecent,
          });
          const newHistory = state.navigationHistory.slice(0, state.historyIndex + 1);
          newHistory.push(id);
          set({
            navigationHistory: newHistory,
            historyIndex: newHistory.length - 1,
          });
          return;
        }

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
        get().syncUIStateToCloud();
      },

      addTab: (id = 'dashboard') => {
        const state = get();
        if (!id) return;

        const alreadyOpen = state.openTabIds.includes(id);
        if (alreadyOpen) {
          set({ activeTabId: id, activeEntityId: id });
          get().syncUIStateToCloud();
          return;
        }

        set({
          openTabIds: [...state.openTabIds, id],
          activeTabId: id,
          activeEntityId: id
        });
        get().syncUIStateToCloud();
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

        // In split view, closing a column entity exits split if it was the only tab
        if (state.splitViewActive) {
          const leftId = state.splitViewLeftId;
          const rightId = state.splitViewRightId;
          if (id === leftId || id === rightId) {
            if (nextTabs.length <= 1) {
              // Only one tab left — exit split view
              set({
                openTabIds: nextTabs,
                activeTabId: nextActive,
                activeEntityId: nextActive,
                splitViewActive: false,
                splitViewLeftId: null,
                splitViewRightId: null,
                splitViewPinned: false,
              });
              get().syncUIStateToCloud();
              return;
            }
            // Move partner to left column
            const survivingId = id === leftId ? rightId : leftId;
            if (survivingId && nextTabs.includes(survivingId)) {
              set({
                openTabIds: nextTabs,
                activeTabId: survivingId,
                activeEntityId: survivingId,
                splitViewLeftId: survivingId,
                splitViewRightId: null,
                splitViewPinned: false,
              });
              get().syncUIStateToCloud();
              return;
            } else {
              set({
                openTabIds: nextTabs,
                activeTabId: nextActive,
                activeEntityId: nextActive,
                splitViewActive: false,
                splitViewLeftId: null,
                splitViewRightId: null,
                splitViewPinned: false,
              });
              get().syncUIStateToCloud();
              return;
            }
          }
        }

        set({
          openTabIds: nextTabs,
          activeTabId: nextActive,
          activeEntityId: nextActive,
        });
        get().syncUIStateToCloud();
      },

      setActiveTab: (id) => {
        const { splitViewActive, splitViewLeftId } = get();
        if (splitViewActive) {
          // In split view, clicking a tab assigns it to the left column
          set({
            activeTabId: id,
            activeEntityId: id,
            splitViewLeftId: id,
          });
        } else {
          set({ activeTabId: id, activeEntityId: id });
        }
        get().syncUIStateToCloud();
      },
      setOpenTabs: (ids) => {
        set({ openTabIds: ids });
        get().syncUIStateToCloud();
      },

      setNavigationState: (id, history, index) => {
        set({ activeEntityId: id, navigationHistory: history, historyIndex: index });
        get().syncUIStateToCloud();
      },

      goBack: () => window.history.back(),
      goForward: () => window.history.forward(),

      syncUIStateToCloud: () => {
        if (!isSupabaseEnabled) return;
        if ((window as any).__uiSyncTimeout) clearTimeout((window as any).__uiSyncTimeout);
        (window as any).__uiSyncTimeout = setTimeout(() => {
          const state = get();
          const uiState = {
            openTabIds: state.openTabIds,
            activeTabId: state.activeTabId,
            activeEntityId: state.activeEntityId,
            splitViewActive: state.splitViewActive,
            splitViewLeftId: state.splitViewLeftId,
            splitViewRightId: state.splitViewRightId,
            splitViewPinned: state.splitViewPinned,
            splitViewPosition: state.splitViewPosition,
          };
          import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('ui_state', uiState));
        }, 1500);
      },

      addEntity: (entity) => {
        // Content quality gate for AI-generated notes
        if (entity.type === 'note' && Array.isArray(entity.content) && entity.content.length > 0) {
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
        const activeSpaceId = get().activeSpaceId;
        const maxSortOrder = Math.max(...get().entities.map(e => e.sortOrder || 0), 0);

        // Enforce flat hierarchy for spaces
        const isRootOnly = entity.type === 'workspace';
        const finalParentId = isRootOnly ? null : (entity.parentId ?? null);

        // Inherit sync mode from the entity's nearest ancestor workspace/collection
        // root — NOT from Entity.spaceId, which is an account-level id shared
        // by every entity in the same account regardless of sidebar workspace.
        const workspaceRoot = findWorkspaceRoot(get().entities, entity.parentId ?? null);
        const defaultSyncMode: import('./store.types').SyncMode = workspaceRoot ? workspaceRoot.syncMode : 'cloud-only';

        const finalEntity = {
          ...entity,
          id: entity.id || generateId(),
          parentId: finalParentId,
          spaceId: entity.spaceId || activeSpaceId,
          sortOrder: entity.sortOrder ?? (maxSortOrder + 1),
          syncMode: entity.syncMode ?? defaultSyncMode,
          lastModified: entity.lastModified || Date.now()
        } as Entity;
        set((state) => ({ entities: [...state.entities, finalEntity] }));
        if (finalEntity.syncMode !== 'local-only') debouncedPushEntity(finalEntity);
        return finalEntity.id;
      },

      deleteEntity: (id) => {
        const state = get();
        const descendantIds = getDescendantIds(state.entities, id);
        const idsToRemove = new Set([id, ...descendantIds]);

        let newActiveSpaceId = state.activeSpaceId;
        if (newActiveSpaceId && idsToRemove.has(newActiveSpaceId)) {
          const remainingSpaces = state.entities.filter(e => e.type === 'workspace' && !idsToRemove.has(e.id));
          newActiveSpaceId = remainingSpaces.length > 0 ? remainingSpaces[0].id : 'ws-personal';
        }

        set((s) => {
          const newOpenTabs = s.openTabIds.filter(tid => !idsToRemove.has(tid));
          const newActiveTabId = idsToRemove.has(s.activeTabId ?? '') ? (newOpenTabs.length > 0 ? newOpenTabs[newOpenTabs.length - 1] : 'dashboard') : s.activeTabId;
          const newActiveEntityId = idsToRemove.has(s.activeEntityId ?? '') ? newActiveTabId : s.activeEntityId;
          
          let newSplitActive = s.splitViewActive;
          let newSplitLeft = s.splitViewLeftId;
          let newSplitRight = s.splitViewRightId;

          if (newSplitActive) {
            if (newSplitLeft && idsToRemove.has(newSplitLeft)) newSplitLeft = null;
            if (newSplitRight && idsToRemove.has(newSplitRight)) newSplitRight = null;
            if (!newSplitLeft && !newSplitRight) {
              newSplitActive = false;
            }
          }

          return {
            entities: s.entities.filter(e => !idsToRemove.has(e.id)),
            favoriteIds: s.favoriteIds.filter(fid => !idsToRemove.has(fid)),
            recentEntityIds: s.recentEntityIds.filter(rid => !idsToRemove.has(rid)),
            activeEntityId: newActiveEntityId,
            activeTabId: newActiveTabId,
            openTabIds: newOpenTabs,
            activeSpaceId: newActiveSpaceId,
            splitViewActive: newSplitActive,
            splitViewLeftId: newSplitLeft,
            splitViewRightId: newSplitRight,
          };
        });
        idsToRemove.forEach(eid => deleteEntityFromDB(eid));
        get().syncUIStateToCloud();
      },

      fixDatabaseIntegrity: async () => {
        const state = get();
        const entityMap = new Map(state.entities.map(e => [e.id, e]));
        const reachableIds = new Set<string>();
        const correctSpaceMap = new Map<string, string>();

        // 1. Identify root entities
        for (const entity of state.entities) {
          if (entity.type === 'workspace') {
            reachableIds.add(entity.id);
            // Legacy: entities stored their own ID as space_id. Migrate to the actual space.
            const effectiveSpaceId = entity.spaceId !== entity.id ? (entity.spaceId || state.activeSpaceId || 'ws-personal') : state.activeSpaceId || 'ws-personal';
            correctSpaceMap.set(entity.id, effectiveSpaceId);
          } else if ((entity.type === 'note' || entity.type === 'canvas') && (!entity.parentId || !entityMap.has(entity.parentId))) {
            reachableIds.add(entity.id);
            // Migrate legacy 'ws-personal' spaceId to the actual space UUID
            const effectiveSpaceId = entity.spaceId && entity.spaceId !== 'ws-personal' ? entity.spaceId : state.activeSpaceId || 'ws-personal';
            correctSpaceMap.set(entity.id, effectiveSpaceId);
          } else if (entity.type === 'folder' && !entity.parentId) {
            // Root folders (deliberately unsorted) are kept; folders whose parent
            // is gone are NOT roots — they fall through to deletion below, with
            // their notes/canvases rescued to Unsorted.
            reachableIds.add(entity.id);
            const effectiveSpaceId = entity.spaceId && entity.spaceId !== 'ws-personal' ? entity.spaceId : state.activeSpaceId || 'ws-personal';
            correctSpaceMap.set(entity.id, effectiveSpaceId);
          }
        }

        // 2. Iteratively traverse downwards and propagate correct spaceId
        let changed = true;
        while (changed) {
          changed = false;
          for (const entity of state.entities) {
            if (!reachableIds.has(entity.id) && entity.parentId && reachableIds.has(entity.parentId)) {
              reachableIds.add(entity.id);
              const parentSpaceId = correctSpaceMap.get(entity.parentId);
              if (parentSpaceId) correctSpaceMap.set(entity.id, parentSpaceId);
              changed = true;
            }
          }
        }

        // 3. Fix corrupted spaceIds for reachable items
        let updatedEntities = state.entities.map(e => {
          if (reachableIds.has(e.id)) {
            const correctSpaceId = correctSpaceMap.get(e.id);
            if (correctSpaceId && e.spaceId !== correctSpaceId) {
              console.log(`[Store] Fixing spaceId for ${e.title} (${e.type}): ${e.spaceId} -> ${correctSpaceId}`);
              const fixed = { ...e, spaceId: correctSpaceId };
              debouncedPushEntity(fixed);
              return fixed;
            }
          }
          return e;
        });

        // 4. Handle truly dead/orphaned entities
        const deadEntities = updatedEntities.filter(e => !reachableIds.has(e.id));
        const rescuedIds = new Set<string>();

        if (deadEntities.length > 0) {
          console.log(`[Store] Found ${deadEntities.length} orphaned entities. Starting cleanup...`);
          
          updatedEntities = updatedEntities.map(e => {
            if (!reachableIds.has(e.id) && (e.type === 'note' || e.type === 'canvas')) {
              console.log(`[Store] Rescuing orphaned ${e.type}: ${e.title}`);
              rescuedIds.add(e.id);
              const rescued = { ...e, parentId: null, spaceId: state.activeSpaceId || 'ws-personal' };
              debouncedPushEntity(rescued); // Sync rescued status to DB
              return rescued;
            }
            return e;
          });
        }

        // 5. Delete the rest (e.g. dead folders)
        const toDelete = deadEntities.filter(e => !rescuedIds.has(e.id));
        const idsToRemove = new Set(toDelete.map(e => e.id));

        if (idsToRemove.size > 0) {
          console.log(`[Store] Deleting ${idsToRemove.size} unrecoverable orphaned folders/entities.`);
          toDelete.forEach(e => deleteEntityFromDB(e.id));
        }

        let newActiveSpaceId = state.activeSpaceId;
        if (newActiveSpaceId && idsToRemove.has(newActiveSpaceId)) {
          const remainingSpaces = updatedEntities.filter(e => e.type === 'workspace' && !idsToRemove.has(e.id));
          newActiveSpaceId = remainingSpaces.length > 0 ? remainingSpaces[0].id : 'ws-personal';
        }

        set((s) => ({
          entities: updatedEntities.filter(e => !idsToRemove.has(e.id)),
          favoriteIds: s.favoriteIds.filter(fid => !idsToRemove.has(fid)),
          recentEntityIds: s.recentEntityIds.filter(rid => !idsToRemove.has(rid)),
          activeEntityId: idsToRemove.has(s.activeEntityId ?? '') ? 'dashboard' : s.activeEntityId,
          activeSpaceId: newActiveSpaceId,
        }));

        // 6. Migrate legacy shortcuts (unscoped keys → scoped by active space)
        const currentShortcuts = { ...get().shortcuts };
        const shortcutSpaceId = state.activeSpaceId || 'ws-personal';
        let shortcutsMigrated = false;
        for (const key of Object.keys(currentShortcuts)) {
          if (!key.includes(':')) {
            const scopedKey = `${shortcutSpaceId}:${key}`;
            if (currentShortcuts[scopedKey] === undefined) {
              currentShortcuts[scopedKey] = currentShortcuts[key];
              shortcutsMigrated = true;
            }
            delete currentShortcuts[key];
          }
        }
        if (shortcutsMigrated) {
          set({ shortcuts: currentShortcuts });
          console.log(`[Store] Migrated legacy shortcuts to scoped keys (${shortcutSpaceId}).`);
        } else if (Object.keys(get().shortcuts).some(k => !k.includes(':'))) {
          // Unscoped keys exist but scoped versions already present — just clean up silently
          set({ shortcuts: currentShortcuts });
        }

        // 7. Migrate legacy task spaceIds (null → active space)
        const tasks = get().tasks;
        const hasLegacyTasks = tasks.some(t => !t.spaceId);
        if (hasLegacyTasks) {
          const migratedTasks = tasks.map(t => ({
            ...t,
            spaceId: t.spaceId || (state.activeSpaceId || 'ws-personal'),
          }));
          set({ tasks: migratedTasks });
          migratedTasks.forEach(t => debouncedPushTask(t));
          console.log(`[Store] Migrated legacy task spaceIds to ${state.activeSpaceId || 'ws-personal'}.`);
        }

        // 7.5. Migrate tasks whose spaceId references a space that no longer exists
        const knownSpaceIds = new Set(state.spaces.map(s => s.id));
        const tasks2 = hasLegacyTasks ? get().tasks : tasks;
        const targetSpaceId = state.activeSpaceId || 'ws-personal';
        
        const orphanedTasks = tasks2.filter(t => 
          t.spaceId && !knownSpaceIds.has(t.spaceId) && t.spaceId !== targetSpaceId
        );
        
        if (orphanedTasks.length > 0) {
          const fixedTasks = tasks2.map(t =>
            t.spaceId && !knownSpaceIds.has(t.spaceId) && t.spaceId !== targetSpaceId ? { ...t, spaceId: targetSpaceId } : t
          );
          set({ tasks: fixedTasks });
          orphanedTasks.forEach(t => debouncedPushTask({ ...t, spaceId: targetSpaceId }));
          console.log(`[Store] Migrated ${orphanedTasks.length} orphaned task spaceIds to ${targetSpaceId}.`);
        }
      },

      moveEntity: (id, newParentId, newSpaceId) => {
        const state = get();
        const prevEntity = state.entities.find(e => e.id === id);
        const isRootOnlyPrev = prevEntity && prevEntity.type === 'workspace';
        const finalParentIdForLookup = isRootOnlyPrev ? null : newParentId;

        const prevRoot = prevEntity ? findWorkspaceRoot(state.entities, prevEntity.parentId ?? null) : null;
        const nextRoot = findWorkspaceRoot(state.entities, finalParentIdForLookup);
        const rootChanged = (prevRoot?.id ?? null) !== (nextRoot?.id ?? null);
        const destinationSyncMode = rootChanged ? (nextRoot ? nextRoot.syncMode : undefined) : undefined;

        set((state) => ({
          entities: state.entities.map(e => {
            if (e.id !== id) return e;

            // Enforce flat hierarchy for spaces
            const isRootOnly = e.type === 'workspace';
            const finalParentId = isRootOnly ? null : newParentId;

            return {
              ...e,
              parentId: finalParentId,
              spaceId: newSpaceId !== undefined ? newSpaceId : e.spaceId,
              syncMode: destinationSyncMode ?? e.syncMode,
              lastModified: Date.now()
            };
          })
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated && updated.syncMode !== 'local-only') {
          debouncedPushEntity(updated);
          if (updated.type === 'folder' || updated.type === 'workspace') {
            const descendants = getAllDescendants(get().entities, id);
            descendants.forEach(d => {
              if (d.syncMode !== 'local-only') debouncedPushEntity(d);
            });
          }
        }
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
            debouncedPushEntity(updated);
          }
        });
      },

      renameEntity: (id, newTitle) => {
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, title: newTitle, lastModified: Date.now() } : e),
          spaces: state.spaces.map(w => w.id === id ? { ...w, name: newTitle, lastModified: Date.now() } : w),
          editingEntity: null
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated) {
          debouncedPushEntity(updated);
          if (updated.type === 'folder' || updated.type === 'workspace') {
            const descendants = getAllDescendants(get().entities, id);
            descendants.forEach(d => {
              if (d.syncMode !== 'local-only') debouncedPushEntity(d);
            });
          }
        }
        const updatedWs = get().spaces.find(w => w.id === id);
        if (updatedWs) debouncedPushSpace(updatedWs);
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
        newEntities.filter(e => e.syncMode !== 'local-only').forEach(e => debouncedPushEntity(e));
      },

      setEntityIcon: (id, icon) => {
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, icon, lastModified: Date.now() } : e),
          spaces: state.spaces.map(w => w.id === id ? { ...w, icon, lastModified: Date.now() } : w)
        }));
        const updated = get().entities.find(e => e.id === id);
        if (updated) debouncedPushEntity(updated);
        const updatedWs = get().spaces.find(w => w.id === id);
        if (updatedWs) debouncedPushSpace(updatedWs);
      },

      setEditingEntityId: (id, source) => set({
        editingEntity: id && source ? { id, source } : null,
        editingEntityId: id ?? null,
        editingSource: source ?? null,
      }),
      clearEditingEntityId: () => set({ editingEntity: null, editingEntityId: null, editingSource: null }),
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
        const divider = { id, title: '', type: 'divider' as const, parentId, lastModified: Date.now(), sortOrder: 9999, pairedEntityId: null, syncMode: 'cloud-only' as any };
        set(s => ({ entities: [...s.entities, divider] }));
        // Inherit divider sync from parent context if applicable (cast so compiler knows it's complete)
        const typedDivider = divider as Entity;
        if (typedDivider.syncMode !== 'local-only') debouncedPushEntity(typedDivider);
      },
      updateEntityContent: (id, content) => {
        const now = Date.now();
        set((state) => ({
          entities: state.entities.map(e => e.id === id ? { ...e, content, lastModified: now } : e),
          lastSaved: now
        }));

        const updated = get().entities.find(e => e.id === id);

        if (updated && updated.syncMode !== 'local-only') {
          debouncedPushEntity(updated);
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
          upsertCanvasBlock(block, undefined, canvas.spaceId || undefined);
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
            upsertCanvasBlock(block, undefined, canvas.spaceId || undefined);
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
              upsertCanvasBlock(block, undefined, canvas.spaceId || undefined);
            }
          }
        });
      },
      deleteCanvasBlock: (id: string) => {
        const block = get().blocks.find(b => b.id === id);
        const all = get().blocks;
        const dependents = all.filter(b =>
          b.startBinding?.blockId === id || b.endBinding?.blockId === id
        );
        const rewritten = new Map<string, Partial<EditorBlock>>();
        for (const dep of dependents) {
          const resolved = resolvePoints(dep, all);
          const upd: Partial<EditorBlock> = {};
          if (dep.startBinding?.blockId === id) {
            upd.startBinding = undefined;
            if (resolved.length > 0) upd.points = [resolved[0], ...(dep.points ?? [])];
          }
          if (dep.endBinding?.blockId === id) {
            upd.endBinding = undefined;
            const base = (upd.points ?? dep.points ?? []);
            if (resolved.length > 1) upd.points = [...base, resolved[resolved.length - 1]];
          }
          rewritten.set(dep.id, upd);
        }
        // Deleting a container (shape/arrow) also deletes its bound label, if any.
        const boundLabel = all.find(b => b.type === 'text' && b.containerId === id);
        set((state) => ({
          blocks: state.blocks
            .filter(b => b.id !== id && b.id !== boundLabel?.id)
            .map(b => rewritten.has(b.id) ? { ...b, ...rewritten.get(b.id) } : b)
        }));
        rewritten.forEach((_upd, depId) => {
          const dep = get().blocks.find(b => b.id === depId);
          if (dep && dep.canvasId) {
            const canvas = get().entities.find(e => e.id === dep.canvasId);
            if (canvas && canvas.syncMode !== 'local-only') {
              upsertCanvasBlock(dep, undefined, canvas.spaceId || undefined);
            }
          }
        });
        if (block && block.canvasId) {
          const canvas = get().entities.find(e => e.id === block.canvasId);
          if (canvas && canvas.syncMode !== 'local-only') {
            deleteCanvasBlockFromDB(id);
          }
        }
        if (boundLabel && boundLabel.canvasId) {
          const labelCanvas = get().entities.find(e => e.id === boundLabel.canvasId);
          if (labelCanvas && labelCanvas.syncMode !== 'local-only') {
            deleteCanvasBlockFromDB(boundLabel.id);
          }
        }
      },
      replaceCanvasBlocks: (canvasId: string, blocks: EditorBlock[]) => {
        const existing = get().blocks.filter(b => b.canvasId === canvasId);
        const incoming = blocks.map(b => ({ ...b, canvasId }));

        // Skip the write if the incoming set is structurally equal to what's already
        // there — this is what prevents an external .flowr edit that merely echoes
        // back the current state (e.g. a round-trip re-save) from looping back into
        // another local-file write.
        const normalize = (list: EditorBlock[]) =>
          JSON.stringify(
            [...list]
              .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
              .map(b => ({ ...b, canvasId: undefined }))
          );
        if (normalize(existing) === normalize(incoming)) {
          return;
        }

        set((state) => ({
          blocks: [...state.blocks.filter(b => b.canvasId !== canvasId), ...incoming]
        }));
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
            upsertCanvasBlock(frameBlock, undefined, canvas.spaceId || undefined);

            const childBlocks = get().blocks.filter(b => b.parentId === frameId);
            childBlocks.forEach(b => {
              upsertCanvasBlock(b, undefined, canvas.spaceId || undefined);
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
              upsertCanvasBlock(block, undefined, canvas.spaceId || undefined);
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
              upsertCanvasBlock(b, undefined, canvas.spaceId || undefined);
            }
          }
        });
      },

      // Clones the given blocks (plus each one's bound label, Task 7) into new blocks with
      // fresh ids, remapping every internal relationship — containerId, groupId, parentId
      // (section/frame membership, Task 8), and startBinding/endBinding (Tasks 3-5) — so the
      // copies form a self-consistent island. Bindings whose target lies OUTSIDE the copied
      // set are dropped (the original binding target isn't being duplicated, so pointing a
      // clone's binding at it would make two arrows share one endpoint unexpectedly).
      // Returns the top-level (non-label) new ids, in the same order as `ids`.
      duplicateBlocks: (ids: string[], offset?: { dx: number; dy: number }) => {
        const state = get();
        const dx = offset?.dx ?? 0;
        const dy = offset?.dy ?? 0;
        const idSet = new Set(ids);

        // Source set = requested blocks + each one's bound label (labels aren't independently
        // selectable, so they wouldn't otherwise be included).
        const src: EditorBlock[] = [];
        const seen = new Set<string>();
        ids.forEach((id) => {
          const b = state.blocks.find((x) => x.id === id);
          if (b && !seen.has(b.id)) { seen.add(b.id); src.push(b); }
        });
        state.blocks.forEach((b) => {
          if (b.type === 'text' && b.containerId && idSet.has(b.containerId) && !seen.has(b.id)) {
            seen.add(b.id);
            src.push(b);
          }
        });

        const idMap = new Map<string, string>(src.map((b) => [b.id, generateId()]));
        const groupIdMap = new Map<string, string>();
        src.forEach((b) => {
          if (b.groupId && !groupIdMap.has(b.groupId)) {
            groupIdMap.set(b.groupId, generateGroupId());
          }
        });
        const remapBinding = (bd?: import('./store.types').ArrowBinding) =>
          bd && idMap.has(bd.blockId) ? { ...bd, blockId: idMap.get(bd.blockId)! } : undefined;

        const clones: EditorBlock[] = src.map((b) => ({
          ...b,
          id: idMap.get(b.id)!,
          x: (b.x ?? 0) + dx,
          y: (b.y ?? 0) + dy,
          points: b.points ? b.points.map(([px, py]) => [px + dx, py + dy] as [number, number]) : b.points,
          containerId: b.containerId ? (idMap.get(b.containerId) ?? b.containerId) : undefined,
          groupId: b.groupId ? groupIdMap.get(b.groupId) : undefined,
          parentId: b.parentId && idMap.has(b.parentId) ? idMap.get(b.parentId) : b.parentId,
          startBinding: remapBinding(b.startBinding),
          endBinding: remapBinding(b.endBinding),
        }));

        set((s) => ({ blocks: [...s.blocks, ...clones] }));

        clones.forEach((clone) => {
          if (clone.canvasId) {
            const canvas = get().entities.find((e) => e.id === clone.canvasId);
            if (canvas && canvas.syncMode !== 'local-only') {
              upsertCanvasBlock(clone, undefined, canvas.spaceId || undefined);
            }
          }
        });

        // Return only the top-level clone ids (exclude bound labels), preserving input order.
        return ids.map((id) => idMap.get(id)).filter((x): x is string => !!x);
      },

      toggleFavorite: (id) => set((state) => ({ favoriteIds: state.favoriteIds.includes(id) ? state.favoriteIds.filter(fid => fid !== id) : [...state.favoriteIds, id] })),

      toggleCollapsed: (id) => set((state) => ({ collapsedIds: state.collapsedIds.includes(id) ? state.collapsedIds.filter(cid => cid !== id) : [...state.collapsedIds, id] })),

      addTask: (task) => {
        const activeSpaceId = get().activeSpaceId;
        const cleanTag = (task.tag && typeof task.tag === 'string' && task.tag.toLowerCase() !== 'none') ? task.tag : undefined;
        const finalTask = {
          id: generateId(),
          completed: false,
          ...task,
          tag: cleanTag,
          userDueDate: task.userDueDate || task.dueDate || undefined,
          spaceId: task.spaceId || activeSpaceId,
          lastModified: Date.now(),
        } as AppTask;
        set((state) => ({ tasks: [...state.tasks, finalTask] }));
        debouncedPushTask(finalTask);
        // Push is now debounced (fires 1.5s after the last edit to this id), so the
        // real Supabase result isn't available synchronously. No caller of addTask()
        // consumes this resolved value today; this preserves the Promise<{error}> contract.
        return Promise.resolve({ error: null });
      },

      toggleTask: (id) => {
        set((s) => ({
          tasks: s.tasks.map(t => {
            if (t.id === id) {
              const nextCompleted = !t.completed;
              return {
                ...t,
                completed: nextCompleted,
                completedAt: nextCompleted ? Date.now() : undefined,
                lastModified: Date.now()
              };
            }
            return t;
          })
        }));
        const updated = get().tasks.find(t => t.id === id);
        if (updated) debouncedPushTask(updated);
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
            [columnId]: mode === 'manual' ? false : (s.trackerColumnSortLocks?.[columnId] ?? true)
          }
        }));
      },

      toggleTrackerColumnSortLock: (columnId) => {
        set((s) => ({
          trackerColumnSortLocks: {
            ...s.trackerColumnSortLocks,
            [columnId]: !(s.trackerColumnSortLocks?.[columnId] ?? true)
          }
        }));
      },

      // Track tool calls already synced to prevent double-appends from
      // multiple SSE emissions of the same cumulative toolResults array.
      _syncedToolCallIds: new Set<string>(),

      syncToolResults: (toolResults) => {
        if (!toolResults || !Array.isArray(toolResults) || toolResults.length === 0) return;
        const currentEntities = get().entities;
        const currentBlocks = get().blocks;
        let entitiesUpdated = false;
        let blocksUpdated = false;

        for (const tr of toolResults) {
          // Deduplicate: skip if we already processed this exact tool call
          const trKey = `${tr.tool}-${tr.id}-${tr.title}-${tr.success}`;
          if (get()._syncedToolCallIds.has(trKey)) continue;
          get()._syncedToolCallIds.add(trKey);
          if (tr.tool === 'create_content' && tr.type === 'workspace' && tr.success && tr.id) {
            const exists = currentEntities.find(e => e.id === tr.id);
            if (!exists) {
              const newEntity = {
                id: tr.id,
                title: tr.title || 'New Space',
                type: 'workspace' as const,
                content: tr.content || [],
                parentId: null,
                lastModified: Date.now(),
                tags: [] as string[],
                syncMode: 'full-sync' as const,
              };
              get().addEntity(newEntity);
              entitiesUpdated = true;
            }
          }

          // create_task: add new task to store
          if (tr.tool === 'create_content' && tr.type === 'task' && tr.success && tr.id) {
            const currentTasks = get().tasks;
            if (!currentTasks.find(t => t.id === tr.id)) {
              get().addTask({
                id: tr.id,
                title: tr.title || 'New Task',
                status: (tr.status as any) || 'todo',
                completed: tr.status === 'done',
                spaceId: tr.spaceId || null,
                entityId: tr.assignedWorkspaceId || null,
                dueDate: tr.dueDate || null,
                endDate: tr.endDate || null,
                includeTime: tr.includeTime ?? false,
                reminder: tr.reminder || null,
                note: tr.description || null,
                priority: (tr.priority as any) || 'none',
                tag: (tr.tag && typeof tr.tag === 'string' && tr.tag.toLowerCase() !== 'none') ? tr.tag : null,
                syncMode: 'full-sync' as const
              });
            }
          }

          // update_task: update task in store
          if (tr.tool === 'update_content' && tr.success && tr.id && tr.id.startsWith('task-')) {
            const updates: any = {};
            if (tr.title) updates.title = tr.title;
            if (tr.status) {
              updates.status = tr.status;
              updates.completed = tr.status === 'done';
            }
            if (tr.dueDate) updates.dueDate = tr.dueDate;
            if (tr.endDate) updates.endDate = tr.endDate;
            if (tr.includeTime !== undefined) updates.includeTime = tr.includeTime;
            if (tr.description) updates.note = tr.description;
            if (tr.priority) updates.priority = tr.priority;
            if (tr.tag) updates.tag = tr.tag;
            get().updateTask(tr.id, updates);
          }

          // create_content: create entity and block if parentId is provided
          if (tr.tool === 'create_content' && tr.type !== 'workspace' && tr.type !== 'task' && tr.success && tr.id) {
            const exists = currentEntities.find(e => e.id === tr.id);
            if (!exists) {
              const newEntity = {
                id: tr.id,
                title: tr.title || 'New Note',
                type: (tr.type as any) || 'note',
                content: (typeof tr.content === 'string' ? markdownToBlocks(tr.content) : tr.content) || [],
                parentId: tr.parentId || null,
                lastModified: Date.now(),
                tags: [] as string[],
                syncMode: 'full-sync' as const,
              };
              get().addEntity(newEntity);
              entitiesUpdated = true;
            }
          }

          // update_content: update the entity in the store
          if (tr.tool === 'update_content' && tr.success && tr.id && !tr.id.startsWith('task-')) {
            set(s => ({
              entities: s.entities.map(e =>
                e.id === tr.id
                  ? { ...e, content: tr.content || tr.blocks ? (typeof tr.content === 'string' ? markdownToBlocks(tr.content) : (tr.content || tr.blocks)) : e.content, title: tr.title || e.title, lastModified: Date.now() }
                  : e
              ),
            }));
            entitiesUpdated = true;
          }

          // append_to_note: append blocks to the entity's content
          if (tr.tool === 'append_to_note' && tr.success && tr.id && (tr.content || tr.blocks)) {
            const newBlocks = typeof tr.content === 'string' ? markdownToBlocks(tr.content) : (tr.blocks || tr.content);
            set(s => ({
              entities: s.entities.map(e =>
                e.id === tr.id
                  ? { ...e, content: [...(Array.isArray(e.content) ? e.content : []), ...newBlocks], lastModified: Date.now() }
                  : e
              ),
            }));
            entitiesUpdated = true;
          }

          // delete_content: remove item from local store
          if (tr.tool === 'delete_content' && tr.success && tr.items) {
            for (const item of tr.items) {
              if (!item.success) continue;
              if (item.type === 'task') {
                get().deleteTask(item.id);
              } else if (item.type === 'canvas_block') {
                get().deleteCanvasBlock(item.id);
              } else {
                // entity (note, folder, canvas)
                get().deleteEntity(item.id);
              }
            }
          }
        }
      },

      updateTask: (id, updates) => {
        if (updates.tag !== undefined) {
          updates.tag = (updates.tag && typeof updates.tag === 'string' && updates.tag.toLowerCase() !== 'none') ? updates.tag : undefined;
        }
        set((s) => ({
          tasks: s.tasks.map(t => {
            if (t.id === id) {
              const nextCompleted = updates.completed !== undefined ? updates.completed : t.completed;
              const completedAt = nextCompleted 
                ? (t.completed ? t.completedAt : Date.now()) 
                : undefined;
              
              // If dueDate is changing, we should keep/update userDueDate
              const userDueDate = updates.dueDate !== undefined 
                ? (updates.dueDate || undefined)
                : t.userDueDate;

              return { ...t, ...updates, userDueDate, completedAt, lastModified: Date.now() };
            }
            return t;
          })
        }));
        const updated = get().tasks.find(t => t.id === id);
        if (updated) debouncedPushTask(updated);
        // See addTask() for why this resolves immediately rather than awaiting the
        // (now debounced) push — no caller consumes the resolved error value today.
        return Promise.resolve({ error: null });
      },

      updateWidgetLayout: (entityId, layout) => {
        set((s) => ({
          entities: s.entities.map(e =>
            e.id === entityId ? { ...e, widgetLayout: layout, lastModified: Date.now() } : e
          )
        }));
        const updated = get().entities.find(e => e.id === entityId);
        if (updated && updated.syncMode !== 'local-only') debouncedPushEntity(updated);
      },

      sortEntities: (criteria) => set((s) => ({ entities: [...s.entities].sort((a, b) => criteria === 'title' ? a.title.localeCompare(b.title) : (b.lastModified || 0) - (a.lastModified || 0)) })),

      sortTasks: (criteria) => set((s) => ({ tasks: [...s.tasks].sort((a, b) => criteria === 'title' ? a.title.localeCompare(b.title) : new Date(b.dueDate || 0).getTime() - new Date(a.dueDate || 0).getTime()) })),

      updateBlockPosition: (id, x, y) => set((state) => ({ blocks: state.blocks.map(b => b.id === id ? { ...b, x, y } : b) })),

      setTasks: (tasks) => set({ tasks }),

      openModal: (modal) => set({
        modal,
        contextMenu: null,
      }),
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
        const currentIndex = entity.content.findIndex((b: any) => b.id === afterBlockId);

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

      setShortcutsState: (shortcuts) => set({ shortcuts }),

      setShortcuts: (contextId, list) => set(s => {
        const nextShortcuts = { ...s.shortcuts, [contextId]: list };
        import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('shortcuts', nextShortcuts));
        return { shortcuts: nextShortcuts };
      }),

      addShortcut: (contextId, label, value, type) => set(s => {
        const list = s.shortcuts[contextId] || [];
        const newShortcut = {
          id: Math.random().toString(36).substring(2, 9),
          type,
          label,
          value
        };
        const nextShortcuts = {
          ...s.shortcuts,
          [contextId]: [...list, newShortcut].slice(0, 12)
        };
        import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('shortcuts', nextShortcuts));
        return { shortcuts: nextShortcuts };
      }),

      removeShortcut: (contextId, id) => set(s => {
        const list = s.shortcuts[contextId] || [];
        const nextShortcuts = {
          ...s.shortcuts,
          [contextId]: list.filter(item => item.id !== id)
        };
        import('@/lib/sync').then(({ upsertSetting }) => upsertSetting('shortcuts', nextShortcuts));
        return { shortcuts: nextShortcuts };
      }),

      setCachedDisplayName: (cachedDisplayName) => set({ cachedDisplayName }),
    }),
    {
      name: 'flowr-storage',
      version: 22,
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
          // Phase 4: workspace entity type + widgetLayout on entities + spaceId on tasks
          if (Array.isArray(state.entities)) {
            state.entities = state.entities.map((e: any) => ({
              ...e,
              widgetLayout: e.widgetLayout ?? undefined,
            }));
          }
          if (Array.isArray(state.tasks)) {
            state.tasks = state.tasks.map((t: any) => ({
              ...t,
              spaceId: t.spaceId ?? null,
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
          // Phase 01: introduce Space model — assign all existing entities/tasks to ws-personal
          if (!Array.isArray(state.spaces) || state.spaces.length === 0) {
            state = {
              ...state,
              spaces: [{
                id: 'ws-personal',
                name: 'Personal',
                type: 'personal',
                ownerId: null,
                createdAt: Date.now(),
              }],
              activeSpaceId: 'ws-personal',
            };
          }
          if (Array.isArray(state.entities)) {
            state.entities = state.entities.map((e: any) => ({
              ...e,
              spaceId: e.spaceId ?? 'ws-personal',
            }));
          }
          if (Array.isArray(state.tasks)) {
            state.tasks = state.tasks.map((t: any) => ({
              ...t,
              spaceId: t.spaceId ?? 'ws-personal',
            }));
          }
        }
        if (version < 14) {
          // Backfill spaceId on any entity or task that is still missing it
          if (Array.isArray(state.entities)) {
            state.entities = state.entities.map((e: any) => ({
              ...e,
              spaceId: e.spaceId || 'ws-personal',
            }));
          }
          if (Array.isArray(state.tasks)) {
            state.tasks = state.tasks.map((t: any) => ({
              ...t,
              spaceId: t.spaceId || 'ws-personal',
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
        // Version 21: migrate 'mixed' entities to 'note'
        if (version < 21) {
          if (Array.isArray(state.entities)) {
            state.entities = state.entities.map((e: any) =>
              e.type === 'mixed' ? { ...e, type: 'note' } : e,
            );
          }
        }
        // Version 22: split view v3 paired columns + pairedEntityId on entities
        if (version < 22) {
          // Drop old split state fields — new ones start fresh
          delete state.isSplitView;
          delete state.splitViewLeftId;
          delete state.splitViewRightId;

          // Add pairedEntityId: null to all entities
          if (Array.isArray(state.entities)) {
            state.entities = state.entities.map((e: any) => ({
              ...e,
              pairedEntityId: e.pairedEntityId ?? null,
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
        ...(!isDesktop() && {
          entities: state.entities,
          tasks: state.tasks,
          blocks: state.blocks,
          spaces: state.spaces,
          chatMessagesMap: state.chatMessagesMap,
        }),
        activeSpaceId: state.activeSpaceId,
        syncCursors: state.syncCursors,
        pendingModeWrites: state.pendingModeWrites,

        activeEntityId: state.activeEntityId,
        activeTabId: state.activeTabId,
        openTabIds: state.openTabIds,

        favoriteIds: state.favoriteIds,
        collapsedIds: state.collapsedIds,
        theme: state.theme,
        interfaceSize: state.interfaceSize,
        isSidebarCollapsed: state.isSidebarCollapsed,
        isSidebarPinned: state.isSidebarPinned,
        isToolbarVisible: state.isToolbarVisible,
        isChatNewNoteButtonVisible: state.isChatNewNoteButtonVisible,
        toolbarPosition: state.toolbarPosition,
        sidebarWidth: state.sidebarWidth,
        aiSidebarWidth: state.aiSidebarWidth,
        taskPanelWidth: state.taskPanelWidth,
        splitViewActive: state.splitViewActive,
        splitViewPosition: state.splitViewPosition,
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
        readModeStates: state.readModeStates,
        trackerColumnSortModes: state.trackerColumnSortModes,
        trackerColumnSortLocks: state.trackerColumnSortLocks,
        hiddenEntityIds: state.hiddenEntityIds,
        recentEntityIds: state.recentEntityIds,
        activeMode: state.activeMode,
        activeChatId: state.activeChatId,
        isTempChat: state.isTempChat,
        pendingNewChat: state.pendingNewChat,
        chatHistoryOpen: state.chatHistoryOpen,
        defaultsSeeded: state.defaultsSeeded,
        chatInputs: state.chatInputs,
        sessionContextsMap: state.sessionContextsMap,
        shortcuts: state.shortcuts,
        cachedDisplayName: state.cachedDisplayName,
      }),
    }
  )
);

// Retries any markForPurge/clearPurge cloud writes that failed (e.g. offline
// when the user confirmed a sync-mode switch). Safe to call anytime — it's a
// no-op when the queue is empty. Called after boot's Supabase load completes.
export async function drainPendingModeWrites(fns?: {
  markForPurge: typeof markForPurge;
  clearPurge: typeof clearPurge;
}): Promise<void> {
  const pending = useStore.getState().pendingModeWrites;
  if (pending.length === 0) return;
  const impl = fns ?? { markForPurge, clearPurge };
  const stillPending: PendingModeWrite[] = [];
  for (const w of pending) {
    const { error } = w.action === 'purge'
      ? await impl.markForPurge({ entityIds: w.entityIds, taskIds: w.taskIds, spaceIds: w.spaceIds })
      : await impl.clearPurge({ entityIds: w.entityIds, taskIds: w.taskIds, spaceIds: w.spaceIds }, w.mode as 'cloud-only' | 'full-sync');
    if (error) stillPending.push(w);
  }
  useStore.setState({ pendingModeWrites: stillPending });
}

if (typeof window !== 'undefined' && isDesktop()) {
  useStore.subscribe((state, prevState) => {
    for (const entity of state.entities) {
      if (entity.type !== 'note' && entity.type !== 'canvas') continue;
      // SQLite mirrors ALL sync modes, including cloud-only — consistent with the
      // task/space subscribers below, and required so that boot-time SQLite
      // hydration (loadFromSQLite + setEntities) is a complete local snapshot.
      // If cloud-only entities were excluded here, a boot-time setEntities()
      // call would wipe any cloud-only entities carried over from the
      // localStorage persist blob, with no guarantee Supabase's own load
      // (which may be slow, offline, or fail) re-adds them in time.
      const prev = prevState.entities.find(e => e.id === entity.id);
      if (!prev || prev.lastModified !== entity.lastModified) {
        const entityWithContent = entity.type === 'canvas'
          ? { ...entity, content: state.blocks.filter(b => b.canvasId === entity.id) }
          : entity;
        (window as any).flowrDB?.upsertEntity(entityToSQLiteRow(entityWithContent));
      }
    }
  });

  useStore.subscribe((state, prevState) => {
    for (const task of state.tasks) {
      const prev = prevState.tasks.find(t => t.id === task.id);
      if (!prev || prev.lastModified !== task.lastModified) {
        (window as any).flowrDB?.upsertTask(taskToSQLiteRow(task));
      }
    }
  });

  useStore.subscribe((state, prevState) => {
    for (const space of state.spaces) {
      const prev = prevState.spaces.find(s => s.id === space.id);
      if (!prev || prev.lastModified !== space.lastModified) {
        (window as any).flowrDB?.upsertSpace(spaceToSQLiteRow(space));
      }
    }
  });
}
