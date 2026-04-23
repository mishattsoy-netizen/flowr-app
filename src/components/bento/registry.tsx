import { ComponentType } from 'react';

// Dashboard widgets
import { ClockWidget } from '@/components/workspace/widgets/ClockWidget';

// Workspace widgets
import { AllFilesWidget } from '@/components/workspace/widgets/AllFilesWidget';
import { TasksWidget } from '@/components/workspace/widgets/TasksWidget';
import { QuickLinksWidget } from '@/components/workspace/widgets/QuickLinksWidget';
import { TimerWidget } from '@/components/workspace/widgets/TimerWidget';
import { ShortcutsWidget } from '@/components/workspace/widgets/ShortcutsWidget';
import { RecentWidget } from '@/components/workspace/widgets/RecentWidget';
import { SmartTaskStackWidget } from '@/components/workspace/widgets/SmartTaskStackWidget';
import { GenericStackedWidget } from '@/components/workspace/widgets/GenericStackedWidget';

// Life mode widgets
import { HabitGridWidget } from '@/components/workspace/widgets/HabitGridWidget';
import { MoodWidget } from '@/components/workspace/widgets/MoodWidget';
import { JournalWidget } from '@/components/workspace/widgets/JournalWidget';
import { GoalsWidget } from '@/components/workspace/widgets/GoalsWidget';
import { RoutinesWidget } from '@/components/workspace/widgets/RoutinesWidget';
import { PlannerWidget } from '@/components/workspace/widgets/PlannerWidget';
import { TodayOverviewWidget } from '@/components/workspace/widgets/TodayOverviewWidget';

// Knowledge widgets
import { TopicBrowserWidget } from '@/components/workspace/widgets/TopicBrowserWidget';
import { KnowledgeSearchWidget } from '@/components/workspace/widgets/KnowledgeSearchWidget';
import { TagIndexWidget } from '@/components/workspace/widgets/TagIndexWidget';

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
  category: 'General' | 'Organization' | 'Life' | 'Knowledge';
}

export const widgetRegistry: Record<string, WidgetRegistryEntry> = {
  // w2 = 1 col, w4 = 2 col, w6 = full width; h in rows
  'clock':            { label: 'Clock',           description: 'Live clock',                    component: ClockWidget,           defaultW: 2, defaultH: 1, minW: 1, minH: 1, maxW: 4, maxH: 2,  category: 'General' },
  'timer':            { label: 'Timer',            description: 'Focus timer',                   component: TimerWidget,           defaultW: 2, defaultH: 1, minW: 1, minH: 1, maxW: 4, maxH: 2,  category: 'General' },
  'all-files':        { label: 'All Files',        description: 'Quick access to all files',     component: AllFilesWidget,        defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
  'tasks':            { label: 'Tasks',            description: 'Global task list',              component: TasksWidget,           defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
  'quick-links':      { label: 'Quick Links',      description: 'Bookmark shortcuts',            component: QuickLinksWidget,      defaultW: 2, defaultH: 1, minW: 1, minH: 2, maxW: 6, maxH: 2,  category: 'Organization' },
  'habit-grid':       { label: 'Habit Grid',       description: 'Daily habit tracker',           component: HabitGridWidget,       defaultW: 6, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'Life' },
  'mood':             { label: 'Mood',             description: 'Daily mood check-in',           component: MoodWidget,            defaultW: 2, defaultH: 1, minW: 1, minH: 2, maxW: 4, maxH: 2,  category: 'Life' },
  'journal':          { label: 'Journal',          description: 'Daily journal prompt',          component: JournalWidget,         defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'Life' },
  'goals':            { label: 'Goals',            description: 'Active goals',                  component: GoalsWidget,           defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'Life' },
  'routines':         { label: 'Routines',         description: 'Daily routine checklist',       component: RoutinesWidget,        defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 3,  category: 'Life' },
  'planner':          { label: 'Planner',          description: 'Week planner',                  component: PlannerWidget,         defaultW: 6, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'Life' },
  'today-overview':   { label: 'Today Overview',   description: 'Today at a glance',             component: TodayOverviewWidget,   defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 3,  category: 'Life' },
  'topic-browser':    { label: 'Topic Browser',    description: 'Browse knowledge topics',       component: TopicBrowserWidget,    defaultW: 2, defaultH: 2, minW: 1, minH: 2, maxW: 4, maxH: 4,  category: 'Knowledge' },
  'knowledge-search': { label: 'Knowledge Search', description: 'Search your knowledge base',   component: KnowledgeSearchWidget, defaultW: 4, defaultH: 1, minW: 1, minH: 2, maxW: 6, maxH: 2,  category: 'Knowledge' },
  'tag-index':        { label: 'Tag Index',        description: 'Browse by tag',                 component: TagIndexWidget,        defaultW: 2, defaultH: 2, minW: 1, minH: 2, maxW: 4, maxH: 4,  category: 'Knowledge' },
  'smart-tasks':      { label: 'Smart Tasks',      description: 'Stacked task views',            component: SmartTaskStackWidget,  defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'Organization' },
  'stacked-widgets':  { label: 'Stacked Widgets',  description: 'Combine up to 3 widgets',      component: GenericStackedWidget,  defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
  'shortcuts':        { label: 'Shortcuts',        description: 'App-like shortcuts',            component: ShortcutsWidget,       defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 4,  category: 'General' },
  'recent':           { label: 'Recent',           description: 'Recently opened pages',         component: RecentWidget,          defaultW: 4, defaultH: 2, minW: 1, minH: 2, maxW: 6, maxH: 3,  category: 'General' },
};
