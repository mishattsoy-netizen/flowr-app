import { ComponentType } from 'react';

// Dashboard widgets
import { ClockWidget } from '@/components/workspace/widgets/ClockWidget';

// Space widgets
import { AllFilesWidget } from '@/components/workspace/widgets/AllFilesWidget';
import { TasksWidget } from '@/components/workspace/widgets/TasksWidget';
import { TimerWidget } from '@/components/workspace/widgets/TimerWidget';
import { ShortcutsWidget } from '@/components/workspace/widgets/ShortcutsWidget';
import { RecentWidget } from '@/components/workspace/widgets/RecentWidget';
import { SmartTaskStackWidget } from '@/components/workspace/widgets/SmartTaskStackWidget';
import { GenericStackedWidget } from '@/components/workspace/widgets/GenericStackedWidget';
import { TopicBrowserWidget } from '@/components/workspace/widgets/TopicBrowserWidget';
import { TodayOverviewWidget } from '@/components/workspace/widgets/TodayOverviewWidget';
import { TagIndexWidget } from '@/components/workspace/widgets/TagIndexWidget';
import { RoutinesWidget } from '@/components/workspace/widgets/RoutinesWidget';
import { PlannerWidget } from '@/components/workspace/widgets/PlannerWidget';
import { KnowledgeSearchWidget } from '@/components/workspace/widgets/KnowledgeSearchWidget';
import { HeaderWidget } from '@/components/workspace/widgets/HeaderWidget';
import { GoalsWidget } from '@/components/workspace/widgets/GoalsWidget';
import { FoldersWidget } from '@/components/workspace/widgets/FoldersWidget';

// Width constants (in half-columns on a 3-column / 6-half-col grid)
// 2 = 1 col (narrow), 3 = 1.5 col, 4 = 2 col, 6 = 3 col (full width)
// Height is in rows (1–4).

export interface WidgetRegistryEntry {
  label: string;
  description: string;
  component: ComponentType<any>;
  // Default dimensions (half-col units for w, rows for h)
  defaultW: number;
  defaultH: number;
  // Minimum allowed dimensions
  minW: number;
  minH: number;
  // Maximum allowed dimensions
  maxW: number;
  maxH: number;
  category: 'General' | 'Organization';
}

export const widgetRegistry: Record<string, WidgetRegistryEntry> = {
  // w2 = 1 col, w4 = 2 col, w6 = full width; h in rows
  'clock':            { label: 'Clock',           description: 'Live clock',                    component: ClockWidget,           defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2,  category: 'General' },
  'timer':            { label: 'Timer',            description: 'Focus timer',                   component: TimerWidget,           defaultW: 2, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
  'all-files':        { label: 'All Files',        description: 'Quick access to all files',     component: AllFilesWidget,        defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
  'tasks':            { label: 'Tasks',            description: 'Global task list',              component: TasksWidget,           defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },

  'smart-tasks':      { label: 'Smart Tasks',      description: 'Stacked task views',            component: SmartTaskStackWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
  'stacked-widgets':  { label: 'Stacked Widgets',  description: 'Combine up to 3 widgets',      component: GenericStackedWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
  'shortcuts':        { label: 'Shortcuts',        description: 'App-like shortcuts',            component: ShortcutsWidget,       defaultW: 4, defaultH: 2, minW: 4, minH: 2, maxW: 6, maxH: 2,  category: 'General' },
  'recent':           { label: 'Recent',           description: 'Recently opened pages',         component: RecentWidget,          defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },

  'topic-browser':    { label: 'Topic Browser',    description: 'Browse topics and notes',        component: TopicBrowserWidget,    defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
  'today-overview':   { label: 'Today Overview',   description: 'Today\'s tasks and events',      component: TodayOverviewWidget,   defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
  'tag-index':        { label: 'Tag Index',        description: 'Browse all tags',                component: TagIndexWidget,        defaultW: 2, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
  'routines':         { label: 'Routines',         description: 'Daily routines',                 component: RoutinesWidget,        defaultW: 2, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
  'planner':          { label: 'Planner',          description: 'Plan your day',                  component: PlannerWidget,         defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
  'knowledge-search': { label: 'Knowledge Search', description: 'Search knowledge items',         component: KnowledgeSearchWidget, defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
  'header':           { label: 'Header',           description: 'Custom header widget',           component: HeaderWidget,          defaultW: 6, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2,  category: 'General' },
  'goals':            { label: 'Goals',            description: 'Track your goals',               component: GoalsWidget,           defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
  'folders':          { label: 'Folders',          description: 'Browse folder structure',        component: FoldersWidget,         defaultW: 4, defaultH: 2, minW: 2, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
};
