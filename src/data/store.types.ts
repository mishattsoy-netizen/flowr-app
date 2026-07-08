// No imports — this is the foundation layer.
import type { ChatConversation, ChatMessage as ChatMessageRecord } from '@/lib/chat';

// Life types removed in M1
// Knowledge types removed in M1

export type EntityType = 'folder' | 'note' | 'canvas' | 'workspace' | 'divider' | 'tag';

export type SidebarSectionId = 'pinned' | 'unsorted' | 'spaces';
export type SortMode = 'lastModified' | 'alphabetical' | 'manual';
export type TrackerSortMode = 'manual' | 'automatic' | 'recently_added';

export interface SidebarSectionSettings {
  sortMode: SortMode;
  itemLimit: number;
}



export type SpaceType = 'personal' | 'shared';

export type SyncMode = 'cloud-only' | 'local-only' | 'full-sync';

export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  ownerId: string | null;
  createdAt: number;
  icon?: string;
  color?: string;
  settings?: Record<string, unknown>;
  syncMode: SyncMode;
}

export type BlockStyle = 'title' | 'heading' | 'subheading' | 'body' | 'mono';
export type BlockType =
  | 'text'
  | 'checklist'
  | 'bulletList'
  | 'dashedList'
  | 'numberedList'
  | 'quote'
  | 'divider'
  | 'columns'
  | 'column'
  | 'table'
  | 'image'
  | 'video'
  | 'shape'
  | 'section'
  | 'frame'
  | 'link';

/** @deprecated Use 'frame' instead. Migrated on canvas load. */
export type DeprecatedSectionType = 'section';

export type ShapeKind = 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'freedraw';

export interface ArrowBinding {
  blockId: string;
  focus?: number;
  gap?: number;
  fixedPoint?: [number, number];
}

export type ArrowheadType = 'none' | 'arrow' | 'triangle' | 'filled-triangle' | 'circle' | 'diamond' | 'reverse-triangle';

export interface ArrowheadStyle {
  type: ArrowheadType;
  size?: number;
}

export type EditMode = 'simple' | 'advanced';

export interface CanvasStyleExt {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  cornerRadius?: number;
  /** Sharp (false/undefined) vs round (true) corner preset. When true, the actual radius is
   * derived proportionally from the shape's current size (see getCornerRadius), not stored as
   * a fixed pixel value, so it keeps tracking correctly as the shape is resized. */
  roundCorners?: boolean;
  opacity?: number;
  locked?: boolean;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  aspectRatioLocked?: boolean;
  pivot?: [number, number];
  startArrowhead?: ArrowheadStyle;
  endArrowhead?: ArrowheadStyle;
  editMode?: EditMode;
  pointRadiuses?: number[];
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
}

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: string;
  style?: BlockStyle;
  checked?: boolean;
  columnCount?: number;
  children?: EditorBlock[];
  tableData?: string[][];
  align?: 'left' | 'center' | 'right' | 'justify';
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  mediaWidth?: 1 | 2 | 3 | 4;
  mediaCaption?: string;
  textColor?: string;
  bgColor?: string;
  pinned?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  canvasId?: string;
  parentId?: string;
  zIndex?: number;
  shapeType?: 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line' | 'arrow';
  canvasStyle?: {
    fill?: string;
    stroke?: string;
    opacity?: number;
    cornerRadius?: number;
  };
  shapeKind?: ShapeKind;
  points?: [number, number][];
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
  startBinding?: ArrowBinding;
  endBinding?: ArrowBinding;
  editMode?: EditMode;
  pointRadiuses?: number[];
  /** Arrow/line path style: straight polyline (default), smooth curve, or orthogonal elbow. */
  pathMode?: 'straight' | 'curved' | 'elbow';
  startArrowhead?: ArrowheadStyle;
  endArrowhead?: ArrowheadStyle;
  canvasStyleExt?: CanvasStyleExt;
  groupId?: string;
  isFolded?: boolean;
  foldingEnabled?: boolean;
  linkUrl?: string;
  /** For text blocks: id of the shape/arrow this label is bound to (Excalidraw-style bound text). */
  containerId?: string;
}

/** @deprecated Use BentoLayoutItem from '@/components/bento/types' instead. */
export type WidgetType = 'header' | 'all-files' | 'folders' | 'tasks' | 'upcoming-tasks' | 'overdue-tasks' | 'inbox-tasks' | 'pinned' | 'recent' | 'quick-links' | 'timer' | 'clock' | 'habit-grid' | 'mood' | 'journal' | 'goals' | 'routines' | 'planner' | 'today-overview' | 'knowledge-topic-browser' | 'knowledge-search' | 'knowledge-tags';

/** @deprecated Use BentoLayoutItem from '@/components/bento/types' instead. */
export type WidgetSize = 'S' | 'M' | 'L';

/** @deprecated Use BentoLayoutItem from '@/components/bento/types' instead. */
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  gridColumn?: string;
  gridRow?: string;
  data?: any;
}

export interface Entity {
  id: string;
  title: string;
  type: EntityType;
  parentId: string | null;
  lastModified: number;
  icon?: string;
  tags?: string[];
  content?: EditorBlock[];
  widgetLayout?: WidgetConfig[];
  spaceId?: string | null;

  pairedEntityId: string | null;
  sortOrder?: number;
  syncMode: SyncMode;
}

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskAttachment {
  name: string;
  url: string;
  type: 'image' | 'audio' | 'video' | 'file' | 'pdf';
  uploading?: boolean;
  tempId?: string;
}

export interface AppTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  endDate?: string;
  includeTime?: boolean;
  reminder?: string;
  userDueDate?: string;
  entityId?: string | null;
  spaceId?: string | null;
  note?: string;
  description?: string;
  color?: string;
  priority?: 'low' | 'medium' | 'high' | null;
  subtasks?: SubTask[];
  difficulty?: number;
  status?: 'todo' | 'in-progress' | 'done';
  position?: number | null;
  createdAt?: number;
  completedAt?: number;
  syncMode: SyncMode;
  attachments?: TaskAttachment[];
  tag?: string;
}

export type SettingsTab = 'profile' | 'interface' | 'account' | 'notifications' | 'integrations' | 'subscription' | 'security' | 'admin' | 'logs' | 'updates' | 'ai';

export type ModalType =
  | null
  | { kind: 'newItem'; parentId?: string | null; initialType?: EntityType }
  | { kind: 'deleteConfirm'; entityId?: string; entityIds?: string[]; isChat?: boolean }
  | { kind: 'deleteSpaceConfirm'; spaceId: string }
  | { kind: 'moveTo'; entityId: string }
  | { kind: 'rename'; entityId: string }
  | { kind: 'settings'; tab?: SettingsTab }
  | { kind: 'newWorkspace' }
  | { kind: 'mediaViewer'; url: string; mediaType: 'image' | 'audio' | 'video' | 'file' | 'pdf'; description?: string; messageId?: string; title?: string }
  | { kind: 'summaryPreview'; summary: string }
  | { kind: 'pdfExport'; entityId: string; entityTitle: string; blocks: EditorBlock[] }
  | { kind: 'syncFileCleanup'; files: Array<{ path: string; entityId: string; entityTitle: string; recognized: boolean }> };

export type EditingSource = 'sidebar' | 'sidebar-section' | 'header' | 'view' | 'favorites' | 'recent' | 'canvas' | 'editor' | 'modal' | 'all-files' | 'folders' | 'spaces' | 'sidebar-toggle';

export interface PipelineStep {
  chain: string
  goal: string
  status: 'pending' | 'running' | 'done' | 'failed'
  label?: string
  output?: string
}

export interface AIAttachment {
  type: 'image' | 'audio' | 'file' | 'pdf' | 'text';
  url: string;
  name: string;
  uploading?: boolean;
  tempId?: string;
  textContent?: string;
}

export interface AIMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  intentTag?: string;
  isHidden?: boolean;
  thought?: string;
  timestamp?: number;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
  model?: string;
  attachments?: AIAttachment[];
  logId?: number;
  citations?: string[];
  model_chain?: string;
  classification_trace?: any[];
  routing_trace?: any[];
  tokens_used?: number;
  pipelineSteps?: PipelineStep[];
  image_description?: string;
  image_prompt?: string;
  status?: string;
  interrupted?: boolean;
  transcript_md?: string;
  toolResults?: Array<{
    type: string
    id?: string
    title?: string
    content_preview?: string
    success: boolean
    error?: string
  }>;
  advisor_questions?: string
  advisor_state?: string
  variants?: string[]
  variantIndex?: number
}

export interface AISessionContext {
  distilled_summary: string | null;
  token_usage_total: number;
  context_limit: number;
  compaction_threshold: number;
  active_mode?: BotMode;
  status_messages?: Record<string, { label: string; emoji: string }>;
}

export interface AdvisorSessionState {
  phase: 'planning' | 'ready' | 'pass'
  round: number
  conversation: Array<{ role: 'advisor' | 'user', content: string }>
  gatheredConstraints: string[]
  ready: boolean
  finalBrief?: string
  approvedPlan?: string
  originalPrompt: string
}

export interface AICursor {
  id?: string;
  type: 'writing' | 'reading' | 'thinking' | 'searching' | 'executing' | 'generating_image' | string;
  message?: string;
}

export type ModelStatus = 'checking' | 'free' | 'limited' | 'paid' | 'offline';

export interface PriorityModel {
  id: string;
  name: string;
  status: ModelStatus;
}

export interface ProjectQuota {
  projectId: string;
  quotas: Array<{
    model: string;
    metric: string;
    limit: string;
    usage: string;
  }>;
  timestamp: string;
}

export type BotMode = 'default' | 'pro'

export type FlowIntentCategory = 'tool_call' | 'web_search' | 'complex' | 'medium' | 'fast' | 'image_generation' | 'audio_voice' | 'CLASSIFIER';

export interface FlowRouterModel {
  id: string;
  label: string;
  provider: 'openrouter' | 'gemini' | 'google' | 'groq' | 'local' | 'vault' | 'cloudflare' | 'huggingface' | 'pollinations' | 'siliconflow';
  enabled: boolean;
  dailyLimit: number | null;
  openrouter_provider?: string;
  isPaid?: boolean;
}

export interface FlowRouterCategory {
  key: FlowIntentCategory;
  label: string;
  description: string;
  models: FlowRouterModel[];
  hidden?: boolean;
}

export interface FlowRouterConfig {
  enabled: boolean;
  preferKeyRotation: boolean;
  categories: FlowRouterCategory[];
  version?: number;
}

export interface CloudModel {
  id: string;
  label: string;
  provider: string;
  description?: string;
  isFree?: boolean;
  isThinking?: boolean;
  isDisabled?: boolean;
}

export interface AIRequestLog {
  id: string;
  model: string;
  modelId: string;
  modelLabel?: string;
  category: string;
  status: 'success' | 'error' | 'retrying';
  duration: number;
  tokens?: number;
  timestamp: string;
  provider?: string;
}

export interface AppState {
  entities: Entity[];
  tasks: AppTask[];
  blocks: EditorBlock[];

  spaces: Space[];
  activeSpaceId: string | null;
  trackerFilterTag: string | null;
  trackerFilterEntityId: string | null;


  activeEntityId: string | null;
  navigationHistory: string[];
  historyIndex: number;
  recentEntityIds: string[];

  openTabIds: string[];
  activeTabId: string | null;

  favoriteIds: string[];
  collapsedIds: string[];
  modal: ModalType;
  contextMenu: { entityId: string | null; x: number; y: number; source: EditingSource } | null;
  editingEntity: { id: string; source: EditingSource } | null;
  theme: 'dark' | 'light';
  interfaceSize: 'small' | 'regular' | 'big';
  isSidebarCollapsed: boolean;
  isSidebarPinned: boolean;
  sidebarWidth: number;
  aiSidebarWidth: number;
  isToolbarVisible: boolean;
  toolbarPosition: { x: number; y: number } | null;
  splitViewActive: boolean;
  splitViewLeftId: string | null;
  splitViewRightId: string | null;
  splitViewPinned: boolean;
  splitViewPosition: number;
  isFullWidth: boolean;
  isTabsHeaderVisible: boolean;
  appStyle: 'v1' | 'v2' | 'v3';
  dashboardLayout: WidgetConfig[];
  defaultDashboardLayout: WidgetConfig[];
  isDashboardEditing: boolean;

  aiMessages: AIMessage[];
  aiApiKey: string | null;
  isAIAssistantOpen: boolean;
  isAIAssistantExtended: boolean;
  isTaskPanelOpen: boolean;
  activeTaskId: string | null;
  taskPanelPresets: Partial<AppTask> | null;
  taskPanelWidth: number;
  aiWasOpenBeforeTaskPanel: boolean;
  isAILoading: boolean;
  aiCursor: AICursor | null;
  aiBehaviorMode: 'fast' | 'thinking' | 'auto';
  aiClassificationModelId: string;
  imageProvider: 'pollinations' | 'puter';

  aiAbortController: AbortController | null;
  copiedBlock: EditorBlock | null;
  sidebarSectionSettings: Record<SidebarSectionId, SidebarSectionSettings>;
  trackerColumnSortModes: Record<string, TrackerSortMode>;
  trackerColumnSortLocks: Record<string, boolean>;
  hiddenEntityIds: string[];
  isCommandPaletteOpen: boolean;
  selectedSidebarIds: string[];
  // Multi-selected tasks in the tracker (for group move/delete via shift+click).
  selectedTaskIds: string[];
  // Right-click context menu over a kanban task.
  taskContextMenu: { taskId: string; column: string; x: number; y: number } | null;
  lastSaved: number | null;
  aiSessionContext: AISessionContext | null;
  activeMode: BotMode;
  activeReplyMessage: AIMessage | null;
  thinkingEnabled: boolean;
  advisorEnabled: boolean;
  pendingAdvisorState: AdvisorSessionState | null;
  assistantInput: string;
  showPaidModels: boolean;
  isInitialSync: boolean;
  pendingCompaction: boolean;
  isCompacting: boolean;
  manualTimezone: string | null;
  chatInputs: Record<string, string>;
  loadingStatesMap: Record<string, boolean>;
  abortControllersMap: Record<string, AbortController | null>;

  setManualTimezone: (tz: string | null) => void;
  chatMessagesMap: Record<string, AIMessage[]>;
  sessionContextsMap: Record<string, any>;
  shortcuts: Record<string, Shortcut[]>;
  cachedDisplayName: string;

  // Chat page state
  activeChatId: string | null;
  newEmptyChatId: string | null;
  isTempChat: boolean;
  pendingNewChat: boolean;
  showTempNotice: boolean;
  tempChatMessages: AIMessage[];
  chatHistoryOpen: boolean;
  chatConversations: ChatConversation[];
  tempChatGreeting: string | null;
  setShowTempNotice: (show: boolean) => void;

  // Actions
  setShortcutsState: (shortcuts: Record<string, Shortcut[]>) => void;
  setShortcuts: (contextId: string, list: Shortcut[]) => void;
  addShortcut: (contextId: string, label: string, value: string, type: 'url' | 'entity') => void;
  removeShortcut: (contextId: string, id: string) => void;
  setCachedDisplayName: (name: string) => void;
  setDashboardLayout: (layout: WidgetConfig[]) => void;
  setIsDashboardEditing: (editing: boolean) => void;
  resetDashboardLayout: () => void;
  stopAIGeneration: () => void;
  add_note: (title: string, content: string, parentId?: string | null) => void;
  toggleTheme: () => void;
  setInterfaceSize: (size: 'small' | 'regular' | 'big') => void;
  toggleSidebar: () => void;
  toggleSidebarPinned: () => void;
  setSidebarWidth: (width: number) => void;
  setAiSidebarWidth: (width: number) => void;
  toggleToolbar: () => void;
  setToolbarVisible: (visible: boolean) => void;
  setToolbarPosition: (pos: { x: number; y: number } | null) => void;
  toggleSplitView: () => void;
  setColumnEntity: (column: 'left' | 'right', entityId: string | null) => void;
  togglePin: () => void;
  swapColumns: () => void;
  exitSplitView: () => void;
  setSplitViewPosition: (pos: number) => void;
  toggleFullWidth: () => void;
  toggleTabsHeader: () => void;
  setAppStyle: (style: 'v1' | 'v2' | 'v3') => void;
  setSpaces: (spaces: Space[]) => void;
  setRecentEntityIds: (ids: string[]) => void;
  setActiveSpaceId: (id: string | null) => void;
  setTrackerFilterTag: (tag: string | null) => void;
  setTrackerFilterEntityId: (id: string | null) => void;
  createSpace: (input: Partial<Space>) => string;
  updateSpace: (id: string, patch: Partial<Space>) => void;
  deleteSpace: (id: string) => void;
  setAIKey: (key: string | null) => void;
  toggleAIAssistant: () => void;
  setAIAssistantOpen: (open: boolean) => void;
  openTaskPanel: (taskId: string, presets?: Partial<AppTask>) => void;
  closeTaskPanel: () => void;
  setTaskPanelWidth: (width: number) => void;
  clearAIChat: () => void;
  compactAIChat: () => Promise<void>;
  saveTempChat: () => Promise<void>;
  setAIHistory: (messages: AIMessage[]) => void;
  setIsAIAssistantExtended: (extended: boolean) => void;
  setAICursor: (cursor: AICursor | null) => void;
  toggleAIAssistantExtended: () => void;
  setAIBehaviorMode: (mode: 'fast' | 'thinking' | 'auto') => void;
  setActiveMode: (mode: BotMode) => void;
  setThinkingEnabled: (enabled: boolean) => void;
  setAdvisorEnabled: (enabled: boolean) => void;
  setPendingAdvisorState: (state: AdvisorSessionState | null) => void;
  setReplyMessage: (msg: AIMessage | null) => void;
  setAIClassificationModelId: (id: string) => void;
  setShowPaidModels: (show: boolean) => void;
  setAssistantInput: (input: string) => void;
  setAISessionContext: (context: AISessionContext | null) => void;
  fetchAISessionContext: (chatId: string) => Promise<void>;
  finishAILoading: (chatId?: string) => Promise<void>;
  sendAIMessage: (content: string, attachments?: AIAttachment[], pageContext?: string, isHidden?: boolean) => Promise<void>;
  regenerateAIMessage: (messageId: string, userContent: string, userAttachments?: AIAttachment[]) => Promise<void>;
  setVariantIndex: (messageId: string, index: number) => void;
  setActiveEntityId: (id: string | null) => void;
  addTab: (id?: string) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  setOpenTabs: (ids: string[]) => void;
  setNavigationState: (id: string | null, history: string[], index: number) => void;
  goBack: () => void;
  goForward: () => void;
  addEntity: (entity: Partial<Entity> & { type: EntityType; title: string }) => string;
  deleteEntity: (id: string) => void;
  fixDatabaseIntegrity: () => Promise<void>;
  moveEntity: (id: string, newParentId: string | null, newSpaceId?: string | null) => void;
  reorderEntities: (orderedIds: string[]) => void;
  renameEntity: (id: string, newTitle: string) => void;
  duplicateEntity: (id: string) => void;
  setEntityIcon: (id: string, icon: string) => void;
  setEditingEntityId: (id: string | null, source?: EditingSource | null) => void;
  setSectionSortMode: (sectionId: SidebarSectionId, mode: SortMode) => void;
  setSectionItemLimit: (sectionId: SidebarSectionId, limit: number) => void;
  toggleEntityVisibility: (id: string) => void;
  moveEntityInList: (id: string, direction: 'up' | 'down') => void;
  insertSidebarDivider: (parentId: string | null) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  updateEntityContent: (id: string, content: EditorBlock[]) => void;
  addTagToEntity: (id: string, tag: string) => void;
  removeTagFromEntity: (id: string, tag: string) => void;
  updateTagInEntity: (id: string, oldTag: string, newTag: string) => void;
  setTagsForEntity: (id: string, tags: string[]) => void;
  addEmptyTag: (id: string) => void;
  addCanvasBlock: (block: EditorBlock) => void;
  updateCanvasBlock: (id: string, updates: Partial<EditorBlock>) => void;
  updateCanvasBlocks: (updates: { id: string; updates: Partial<EditorBlock> }[]) => void;
  deleteCanvasBlock: (id: string) => void;
  replaceCanvasBlocks: (canvasId: string, blocks: EditorBlock[]) => void;
  moveCanvasFrame: (frameId: string, deltaX: number, deltaY: number) => void;
  /** @deprecated Use moveCanvasFrame instead. */
  moveCanvasSection: (sectionId: string, deltaX: number, deltaY: number) => void;
  toggleFavorite: (id: string) => void;
  toggleCollapsed: (id: string) => void;
  addTask: (task: Partial<AppTask> & { title: string }) => Promise<{ error: any }>;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  clearCompletedTasks: () => void;
  setTrackerColumnSortMode: (columnId: string, mode: TrackerSortMode) => void;
  toggleTrackerColumnSortLock: (columnId: string) => void;
  // Task multi-selection (tracker)
  toggleTaskSelection: (id: string) => void;
  setSelectedTaskIds: (ids: string[]) => void;
  clearTaskSelection: () => void;
  openTaskContextMenu: (taskId: string, column: string, x: number, y: number) => void;
  closeTaskContextMenu: () => void;
  updateTask: (id: string, updates: Partial<AppTask>) => Promise<{ error: any }>;
  syncToolResults: (toolResults: any[]) => void;
  updateWidgetLayout: (entityId: string, layout: WidgetConfig[]) => void;
  sortEntities: (criteria: 'title' | 'lastModified') => void;
  sortTasks: (criteria: 'title' | 'dueDate') => void;
  // Frame & Group actions
  groupBlocks: (ids: string[]) => string;
  ungroupBlocks: (groupId: string) => void;
  duplicateBlocks: (ids: string[], offset?: { dx: number; dy: number }) => string[];

  updateBlockPosition: (id: string, x: number, y: number) => void;
  setEntities: (entities: Entity[]) => void;
  setTasks: (tasks: AppTask[]) => void;
  setSyncMode: (entityId: string, mode: SyncMode) => Promise<void>;
  setLastSaved: (time: number | null) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  openContextMenu: (entityId: string | null, x: number, y: number, source: EditingSource) => void;
  closeContextMenu: () => void;
  copyBlock: (block: EditorBlock) => void;
  pasteBlock: (entityId: string, afterBlockId: string) => void;
  setSelectedSidebarIds: (ids: string[]) => void;
  clearSelectedSidebarIds: () => void;

  // Chat page actions
  setActiveChatId: (id: string | null) => void;
  setIsTempChat: (temp: boolean) => void;
  setChatHistoryOpen: (open: boolean) => void;
  startTempChat: () => Promise<void>;
  startNewChat: () => Promise<void>;
  cleanupActiveChatIfEmpty: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  deleteChatConversation: (id: string) => Promise<void>;
  renameChatConversation: (id: string, title: string) => Promise<void>;
  loadChatConversations: () => Promise<void>;
  openChatInPage: () => void;
  setInitialSync: (isInitialSync: boolean) => void;
}

export interface Shortcut {
  id: string;
  type: 'url' | 'entity';
  label: string;
  value: string;
  icon?: string;
}

