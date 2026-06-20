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
    date: '2026-06-20',
    title: 'Branding, Drag-and-Drop & Editor Updates',
    sections: [
      {
        type: 'added',
        items: [
          'Added a dedicated "What\'s New" updates feed in settings with release history and visual logs.',
          'Added fully branded authentication routing, keeping the URL clean and matching your custom domain throughout login transitions.',
          'Added support for "/button" command to insert inline interactive capsule buttons inside editor text blocks.',
          'Added an interactive hover popover for editor links and buttons, supporting instant inline label editing, URL editing, and direct navigation.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Unified the design of toggle switches across all settings modals, sidebars, and panels for a consistent interface.',
          'Polished toggle switch visibility in light and dark themes.',
          'Refined message copy-to-note behavior, preserving citations as capsule buttons and body links as standard underlined text links.',
          'Improved drag-and-drop hierarchy handling in the sidebar, refining folder outdenting, hit target bounds, and parent drop detection.',
          'Added automatic linkification of plain URLs in markdown parsing when inserting/saving to notes.'
        ]
      },
      {
        type: 'changed',
        items: [
          'Cleaned up legacy image models and database configurations to optimize performance.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed connection hangs and improved response stability for the AI assistant.',
          'Resolved layout anomalies when dragging and dropping nested items in the sidebar.',
          'Fixed real-time synchronization connection drops.',
          'Fixed visual stacked border and stroke artifacts on link icon badges in the editor.'
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
