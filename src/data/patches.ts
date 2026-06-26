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
    version: '1.5.0',
    build: '2320',
    date: '2026-06-26',
    title: 'Canvas Overhaul: Floating Workspace panels, Alignment Guides & Spline Path Engine',
    sections: [
      {
        type: 'added',
        items: [
          'Added absolute pixel alignment and snapping guides (horizontal & vertical lines) during shape dragging and resizing.',
          'Added interactive vector waypoint editing mode for spline curves and arrows with direct double-click triggers.',
          'Added standalone line and vector connection layers with Supabase serialization and persistence.',
          'Added custom self-contained canvas color picker popover with viewport boundary constraint checking.',
          'Added real-time feedback (checkmark success indicators) to export and copy toolbar buttons.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Overhauled canvas layout with sleek floating sidebars (Layers & Style panels) using backdrop blurs and soft shadows.',
          'Moved canvas zoom, undo/redo, and toolbar controls to float overlays for maximum workspace area.',
          'Re-organized the Canvas Style Panel layout to group position, alignment, and rotation inputs with borderless scrubbing labels.',
          'Implemented high-performance O(1) DOM updates during waypoint editing to ensure butter-smooth 60fps dragging.',
          'Optimized export engine to support custom ratios, portrait/landscape orientations, and multi-scale image qualities.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed translation and rotation desyncs on rotated shapes where selection bounding boxes drifted from vector paths.',
          'Fixed waypoint coordinate mappings on rotated arrows to track cursor positions accurately.',
          'Fixed arrowhead marker style properties and size variables resetting on browser refresh.'
        ]
      }
    ]
  },
  {
    version: '1.4.8',
    build: '2319',
    date: '2026-06-25',
    title: 'AI Settings Tab, File-Based Image Caching, & Canvas Precision Drag/Resizing Engine',
    sections: [
      {
        type: 'added',
        items: [
          'Added custom AI settings section tab to configure user background/descriptions and system context prompts.',
          'Added server-based description syncing actions dynamically injecting custom background content in prompt pipelines.',
          'Added absolute pixel coordinates snapping guides matching shape dimensions and canvas alignments.',
          'Added shift-key dragging axis constraint locking block movements to pure horizontal or vertical coordinates.',
          'Added shift-key shape resize locking to maintain native shape aspect ratio rules.',
          'Added coordinate (X/Y) and dimension (width/height/radius/stroke) numeric scrub gesture labels to quickly drag and scale shape values.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Migrated canvas data structures to a global Zustand store layer to prevent out-of-sync local render configurations.',
          'Overhauled SVG arrow link algorithms to auto-center connections, fix broken command regex parses, and add snap lines.',
          'Updated canvas styling specifications, buttons, colors, toggles, sidebars, and right-click contextual menus to align with brand standards.',
          'Configured AI image generation to automatically write files directly to public directory caching paths to guarantee offline persistence.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed shapes double-click listeners failing to activate textarea overlays for shape text editing.',
          'Fixed floating toolbar selection actions firing off background page selections and closing context menus.',
          'Fixed right-click custom events to cleanly trigger absolute placement context controls.'
        ]
      }
    ]
  },
  {
    version: '1.4.7',
    build: '2318',
    date: '2026-06-24',
    title: 'Chat Bar Polish & Sidebar Button Refinement',
    sections: [
      {
        type: 'changed',
        items: [
          'Renamed Default mode to Regular and Pro to Professional.',
          'Increased mode name, mic, and send icon sizes for better visibility.',
          'Replaced send icon with upward arrow for a cleaner look.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Cleaned up mode popup by removing icons and uppercase styling from descriptions and toggle labels.',
          'Replaced On/Off labels under Thinking and Advisor toggles with hover tooltip descriptions.',
          'Unified styling of plus menu popup, header actions, and sidebar buttons across the app.',
          'Suppressed focus rings on mouse clicks for a smoother interaction feel.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed sidebar rows highlighting entirely when clicking utility buttons on non-selected items.',
          'Fixed plus button missing highlight state when its popup is open.',
          'Fixed new items not inheriting sync settings from their parent workspace.',
          'Fixed source pill spacing in chat messages.'
        ]
      }
    ]
  },
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
