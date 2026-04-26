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
  'clock':            { label: 'Clock',           description: 'Live clock',                    component: ClockWidget,           defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,  category: 'General' },
  'timer':            { label: 'Timer',            description: 'Focus timer',                   component: TimerWidget,           defaultW: 2, defaultH: 1, minW: 2, minH: 1, maxW: 4, maxH: 2,  category: 'General' },
  'all-files':        { label: 'All Files',        description: 'Quick access to all files',     component: AllFilesWidget,        defaultW: 4, defaultH: 2, minW: 2, minH: 1, maxW: 6, maxH: 4,  category: 'Organization' },
  'tasks':            { label: 'Tasks',            description: 'Global task list',              component: TasksWidget,           defaultW: 4, defaultH: 2, minW: 2, minH: 1, maxW: 6, maxH: 4,  category: 'Organization' },
  'quick-links':      { label: 'Quick Links',      description: 'Bookmark shortcuts',            component: QuickLinksWidget,      defaultW: 4, defaultH: 1, minW: 2, minH: 1, maxW: 6, maxH: 2,  category: 'Organization' },
  'smart-tasks':      { label: 'Smart Tasks',      description: 'Stacked task views',            component: SmartTaskStackWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 1, maxW: 6, maxH: 4,  category: 'Organization' },
  'stacked-widgets':  { label: 'Stacked Widgets',  description: 'Combine up to 3 widgets',      component: GenericStackedWidget,  defaultW: 4, defaultH: 2, minW: 2, minH: 1, maxW: 6, maxH: 4,  category: 'General' },
  'shortcuts':        { label: 'Shortcuts',        description: 'App-like shortcuts',            component: ShortcutsWidget,       defaultW: 4, defaultH: 2, minW: 2, minH: 1, maxW: 6, maxH: 4,  category: 'General' },
  'recent':           { label: 'Recent',           description: 'Recently opened pages',         component: RecentWidget,          defaultW: 4, defaultH: 2, minW: 2, minH: 1, maxW: 6, maxH: 3,  category: 'General' },
};
