// No imports — this is the foundation layer.
import type { ChatConversation, ChatMessage as ChatMessageRecord } from '@/lib/chat';

// Life types
export interface Habit { id: string; title: string; frequency: string; icon?: string; color?: string; workspaceId?: string; }
export interface HabitCheck { id: string; habitId: string; date: string; done: boolean; }
export interface MoodEntry { id: string; mood: number; note?: string; date: string; workspaceId?: string; }
export interface JournalEntry { id: string; content: string; date: string; workspaceId?: string; }
export interface Goal { id: string; title: string; targetDate?: string; completed: boolean; workspaceId?: string; }
export interface Routine { id: string; title: string; frequency: string; workspaceId?: string; }
export interface RoutineCheck { id: string; routineId: string; stepId: string; date: string; done: boolean; }

// Knowledge types
export interface Resource { id: string; title: string; url: string; topicId?: string; tags: string[]; workspaceId?: string; }
export interface Snippet { id: string; title: string; content: string; topicId?: string; tags: string[]; workspaceId?: string; }
export interface Guide { id: string; title: string; steps: any[]; topicId?: string; tags: string[]; workspaceId?: string; }

export type EntityType = 'collection' | 'folder' | 'note' | 'canvas' | 'mixed' | 'workspace' | 'divider';

export type SidebarSectionId = 'pinned' | 'unsorted' | 'workspaces';
export type SortMode = 'lastModified' | 'alphabetical' | 'manual';
export type TrackerSortMode = 'manual' | 'automatic' | 'recently_added';

export interface SidebarSectionSettings {
  sortMode: SortMode;
  itemLimit: number;
}



export type WorkspaceType = 'personal' | 'shared';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  ownerId: string | null;
  createdAt: number;
  icon?: string;
  color?: string;
  cloudSyncEnabled?: boolean;
  settings?: Record<string, unknown>;
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
  | 'embed'
  | 'database'
  | 'table'
  | 'image'
  | 'video'
  | 'shape'
  | 'section'
  | 'comment'
  | 'connection'
  | 'link';

export type EmbedDisplayMode = 'list-item' | 'widget-sm' | 'widget-md' | 'widget-lg';
export type DatabaseViewType = 'table' | 'board' | 'gallery' | 'list';
export type DatabaseColumnType = 'text' | 'number' | 'select' | 'date' | 'checkbox';

export interface DatabaseColumn {
  id: string;
  name: string;
  type: DatabaseColumnType;
  options?: string[];
  width?: number;
}

export interface DatabaseRow {
  id: string;
  cells: Record<string, string>;
}

export type ShapeKind = 'rect' | 'ellipse' | 'diamond' | 'line' | 'arrow' | 'freedraw';

export interface CanvasStyleExt {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  cornerRadius?: number;
  opacity?: number;
  locked?: boolean;
}

export interface EditorBlock {
  id: string;
  type: BlockType;
  content: string;
  style?: BlockStyle;
  checked?: boolean;
  columnCount?: number;
  children?: EditorBlock[];
  embedEntityId?: string;
  embedDisplayMode?: EmbedDisplayMode;
  dbViewType?: DatabaseViewType;
  dbColumns?: DatabaseColumn[];
  dbRows?: DatabaseRow[];
  dbGroupByColumnId?: string;
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
  canvasStyleExt?: CanvasStyleExt;
  groupId?: string;
  fromId?: string;
  toId?: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
  isFolded?: boolean;
  foldingEnabled?: boolean;
  linkUrl?: string;
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
  workspaceId?: string | null;

  sortOrder?: number;
  cloudSyncEnabled?: boolean;
}

export interface SubTask {
  id: string;
  text: string;
  completed: boolean;
}

export interface AppTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  userDueDate?: string;
  entityId?: string | null;
  workspaceId?: string | null;
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
}

export type SettingsTab = 'profile' | 'interface' | 'account' | 'notifications' | 'integrations' | 'subscription' | 'security' | 'admin' | 'logs' | 'updates';

export type ModalType =
  | null
  | { kind: 'newItem'; parentId?: string | null; initialType?: EntityType; defaultToFirstCollection?: boolean }
  | { kind: 'newCollection' }
  | { kind: 'deleteConfirm'; entityId?: string; entityIds?: string[]; isChat?: boolean }
  | { kind: 'moveTo'; entityId: string }
  | { kind: 'rename'; entityId: string }
  | { kind: 'newTask'; taskId?: string }
  | { kind: 'settings'; tab?: SettingsTab }
  | { kind: 'newWorkspace' }
  | { kind: 'mediaViewer'; url: string; mediaType: 'image' | 'audio' | 'video' | 'file'; description?: string; messageId?: string }
  | { kind: 'habitDetail'; id: string | null }
  | { kind: 'goalDetail'; id: string | null }
  | { kind: 'journalDetail'; id: string | null }
  | { kind: 'routineDetail'; id: string | null }
  | { kind: 'summaryPreview'; summary: string };

export type EditingSource = 'sidebar' | 'sidebar-section' | 'header' | 'view' | 'favorites' | 'recent' | 'canvas' | 'editor' | 'modal' | 'all-files' | 'folders' | 'spaces' | 'sidebar-toggle';

export interface PipelineStep {
  chain: string
  goal: string
  status: 'pending' | 'running' | 'done' | 'failed'
  label?: string
  output?: string
}

export interface AIAttachment {
  type: 'image' | 'audio' | 'file' | 'pdf';
  url: string;
  name: string;
}

export interface AIMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
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

  lifeHabits: Habit[];
  lifeHabitChecks: HabitCheck[];
  lifeMoods: MoodEntry[];
  lifeJournals: JournalEntry[];
  lifeGoals: Goal[];
  lifeRoutines: Routine[];
  lifeRoutineChecks: RoutineCheck[];

  knowledgeResources: Resource[];
  knowledgeSnippets: Snippet[];
  knowledgeGuides: Guide[];

  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  trackerFilterWorkspace: string | null;


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
  mixedLayoutSplit: number;
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
  cloudSyncEnabled: boolean;
  aiSessionContext: AISessionContext | null;
  activeMode: BotMode;
  activeIntentTag: string | null;
  activeReplyMessage: AIMessage | null;
  thinkingEnabled: boolean;
  advisorEnabled: boolean;
  pendingAdvisorState: AdvisorSessionState | null;
  assistantInput: string;
  showPaidModels: boolean;
  isInitialSync: boolean;
  pendingCompaction: boolean;
  isCompacting: boolean;
  chatInputs: Record<string, string>;
  loadingStatesMap: Record<string, boolean>;
  abortControllersMap: Record<string, AbortController | null>;
  chatMessagesMap: Record<string, AIMessage[]>;
  sessionContextsMap: Record<string, any>;

  // Chat page state
  activeChatId: string | null;
  isTempChat: boolean;
  tempChatMessages: AIMessage[];
  chatHistoryOpen: boolean;
  chatConversations: ChatConversation[];

  // Actions
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
  setMixedLayoutSplit: (split: number) => void;
  toggleFullWidth: () => void;
  toggleTabsHeader: () => void;
  setAppStyle: (style: 'v1' | 'v2' | 'v3') => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setTrackerFilterWorkspace: (id: string | null) => void;
  createWorkspace: (input: Partial<Workspace>) => string;
  updateWorkspace: (id: string, patch: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  setAIKey: (key: string | null) => void;
  toggleAIAssistant: () => void;
  setAIAssistantOpen: (open: boolean) => void;
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
  setActiveIntentTag: (tag: string | null) => void;
  setReplyMessage: (msg: AIMessage | null) => void;
  setAIClassificationModelId: (id: string) => void;
  setShowPaidModels: (show: boolean) => void;
  setAssistantInput: (input: string) => void;
  setAISessionContext: (context: AISessionContext | null) => void;
  fetchAISessionContext: (chatId: string) => Promise<void>;
  finishAILoading: (chatId?: string) => Promise<void>;
  sendAIMessage: (content: string, attachments?: AIAttachment[]) => Promise<void>;
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
  moveEntity: (id: string, newParentId: string | null, newWorkspaceId?: string | null) => void;
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
  moveCanvasSection: (sectionId: string, deltaX: number, deltaY: number) => void;
  toggleFavorite: (id: string) => void;
  toggleCollapsed: (id: string) => void;
  addTask: (task: Partial<AppTask> & { title: string }) => void;
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
  updateTask: (id: string, updates: Partial<AppTask>) => void;
  updateWidgetLayout: (entityId: string, layout: WidgetConfig[]) => void;
  sortEntities: (criteria: 'title' | 'lastModified') => void;
  sortTasks: (criteria: 'title' | 'dueDate') => void;
  updateBlockPosition: (id: string, x: number, y: number) => void;
  setEntities: (entities: Entity[]) => void;
  setTasks: (tasks: AppTask[]) => void;
  addHabit: (habit: Habit) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  checkHabit: (habitId: string, date: string, done: boolean) => void;
  setMood: (entry: MoodEntry) => void;
  deleteMood: (id: string) => void;
  upsertJournal: (entry: JournalEntry) => void;
  deleteJournal: (id: string) => void;
  addGoal: (goal: Goal) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  addRoutine: (routine: Routine) => void;
  updateRoutine: (id: string, updates: Partial<Routine>) => void;
  deleteRoutine: (id: string) => void;
  checkRoutineStep: (routineId: string, stepId: string, date: string, done: boolean) => void;
  setLifeData: (data: Partial<AppState>) => void;
  addResource: (resource: Resource) => void;
  updateResource: (id: string, updates: Partial<Resource>) => void;
  deleteResource: (id: string) => void;
  addSnippet: (snippet: Snippet) => void;
  updateSnippet: (id: string, updates: Partial<Snippet>) => void;
  deleteSnippet: (id: string) => void;
  addGuide: (guide: Guide) => void;
  updateGuide: (id: string, updates: Partial<Guide>) => void;
  deleteGuide: (id: string) => void;
  setCloudSyncEnabled: (enabled: boolean) => void;
  setWorkspaceCloudSync: (rootEntityId: string, enabled: boolean) => Promise<void>;
  setLastSaved: (time: number | null) => void;
  setKnowledgeData: (data: Partial<AppState>) => void;
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

