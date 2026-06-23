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
    version: '1.4.6.2',
    build: '2317',
    date: '2026-06-23',
    title: 'Temp Chat Isolation, Auto-Cleanup, Sidebar Empty Session & Layout Shifting Fixes',
    sections: [
      {
        type: 'added',
        items: [
          'Added automatic cleanup of empty chat conversations when switching views or starting new sessions.',
          'Added custom "/clear" chat command to reset message history and inputs instantly.',
          'Integrated automatic search citation extraction from system prompts when empty.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Isolated temporary chat state to prevent saving to or retrieving from database session states.',
          'Aligned assistant chat pill styles with notes button pills for unified branding.',
          'Implemented safe absolute URL parsing for citation URLs and standard links to prevent crashes on relative hostnames.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed a bug where empty chat sessions from previous runs or closed tabs continued to persist in the sidebar.',
          'Added automatic load-time database querying and filtering to delete and prune empty chat conversations in the background.',
          'Filtered out raw [SEARCH] queries from displaying in message blocks and sanitized them in output guard.',
          'Fixed subpixel layout shifting and alignment jitters on sidebar row items (workspaces, folders, tasks, sessions) during hover and click states.'
        ]
      }
    ]
  },
  {
    version: '1.4.5',
    build: '2316',
    date: '2026-06-21',
    title: 'Tooltip Overlay Suppression & Link Style Unification',
    sections: [
      {
        type: 'added',
        items: [
          'Centralized tooltip overlay suppression system to hide tooltips during modals, context menus, drag states, and link popovers.',
          'Unified standard link styles across notes and chat to have consistent text and underline colors.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed URL parsing crash in editor link popover when entering relative domains or plain hostnames.',
          'Resolved missing underline issue on standard links inside chat messages and advisor cards.',
          'Fixed typing box loading state and cursor not disappearing after message generation completes.',
          'Fixed temporary chat session isolation to ensure clean independent session starts.',
          'Corrected chat link styling to preserve standard text links in prose while rendering search citations as capsule pills.'
        ]
      }
    ]
  },
  {
    version: '1.4.4',
    build: '2315',
    date: '2026-06-21',
    title: 'Citation Pills & Editor Drag Interactions',
    sections: [
      {
        type: 'added',
        items: [
          'Differentiated standard inline text links from rounded capsule citation pills.',
          'Configured assistant mode prompts to output citations as capsule pills while retaining standard links for main body content references.',
          'Added link popover editor to support inline link editing, label editing, and direct navigation.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed tooltip and popup triggers during editor block drag-and-drop interactions to prevent accidental clicks.',
          'Resolved pill layout and popover offset constraints inside nested editor blocks (lists and tables).'
        ]
      }
    ]
  },
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
