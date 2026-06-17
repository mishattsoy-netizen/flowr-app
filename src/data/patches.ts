export type PatchType = 'added' | 'fixed' | 'changed' | 'improved';

export interface PatchSection {
  type: PatchType;
  items: string[];
}

export interface Patch {
  version: string;
  build: string;
  date: string;
  title: string;
  sections: PatchSection[];
}

export const PATCHES: Patch[] = [
  {
    version: '1.4.3',
    build: '2312',
    date: '2026-06-18',
    title: 'Clean Proxy Auth & AI Improvements',
    sections: [
      {
        type: 'added',
        items: [
          'Added a dedicated "What\'s New" updates feed in settings with scroll-fade overlays and interactive release history card listings.',
          'Added clean authentication domain rewrites (/auth/v1, /rest/v1, /storage/v1) mapping directly to Supabase endpoints, completely removing raw Supabase URLs from app transitions.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Unified toggle switches across all settings modals, sidebars, and panels using a standard central Toggle component.',
          'Standardized toggle track colors for consistent visibility across both light and dark themes.'
        ]
      },
      {
        type: 'changed',
        items: [
          'Removed legacy image upscaling models, database columns, and associated cache stores.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed chat completion stream termination hangs.',
          'Fixed Gemini provider routing configurations and self-healing OpenRouter fallbacks.',
          'Resolved database config cardinality violations and compiled prompt schema errors.',
          'Fixed TypeScript compiler errors related to the custom WebSocket transport injection and Sidebar drag-and-drop sibling check types.'
        ]
      }
    ]
  },
  {
    version: '1.4.2',
    build: '2306',
    date: '2026-06-17',
    title: 'Visual Polish & Switch Unification',
    sections: [
      {
        type: 'added',
        items: [
          'Added unified visual track color for all toggle switches in both light and dark themes.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed stream termination hangs in chat completion responses.',
          'Resolved Gemini provider routing and advisor initialization errors.'
        ]
      },
      {
        type: 'changed',
        items: [
          'Unified assistant panel switches with the central Toggle component.'
        ]
      }
    ]
  },
  {
    version: '1.4.1',
    build: '2298',
    date: '2026-06-17',
    title: 'Mobile Optimization',
    sections: [
      {
        type: 'fixed',
        items: [
          'Fixed overlapping layout elements on mobile screen sizes.'
        ]
      }
    ]
  },
  {
    version: '1.4.0',
    build: '2280',
    date: '2026-06-16',
    title: 'Drag and Drop Experience',
    sections: [
      {
        type: 'added',
        items: [
          'Integrated Pragmatic Drag and Drop for kanban task list sorting.'
        ]
      }
    ]
  }
];
