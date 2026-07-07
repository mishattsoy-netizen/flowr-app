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
  featured?: boolean;
  sections: PatchSection[];
  images?: {
    before: string;
    after: string;
    beforeTitle?: string;
    afterTitle?: string;
  };
}

export const PATCHES: Patch[] = [
  {
    version: '1.2.0',
    build: '1200',
    date: '2026-07-07',
    title: 'Excalidraw Canvas, Split View v3, Space Rename & Notion Date Picker',
    featured: true,
    sections: [
      {
        type: 'added',
        items: [
          'Brand new Notion-style date & time picker: set dates, ranges, reminders, and times in a single unified popup.',
          'Interactive calendar gestures: drag to select date ranges or drag single dates to reschedule instantly.',
          'Split View v3: open two notes or canvases side-by-side with tab-style headers, drag-and-drop support, and column pinning.',
          'Canvas arrows with Excalidraw-style binding: snap arrows directly to shapes, ellipses, and diamonds, following them as they move.',
          'Transparent, auto-sizing canvas text and direct text labeling inside shapes and arrows.',
          'Canvas Sections: clip, group, and move elements together in container boxes.',
          'Canvas eraser tool, straight/curved arrow toggles, style presets, Alt+drag duplicate, and keyboard nudging.',
          'Canvases now save as standard .flowr files in your vault, fully compatible with Excalidraw.',
          'AI can now schedule tasks: create and update tasks with start dates, due dates, specific times, and reminders in one command.',
          'Rename Workspaces to Spaces: simplified terminology across the entire app for a cleaner interface.',
          'Task enhancements: support for adding tags and attachments directly to tasks.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Unified brand styling: all blue accents, focus rings, toggles, and handles now use a single --brand-blue variable.',
          'Split view sidebar layout: active columns are highlighted together, and sidebars auto-hide to maximize editing space.',
          'Optimized month navigation in the date picker with zero layout shifting.',
          'Performance upgrades: modularized canvas logic files for faster rendering and smoother canvas editing.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed five critical canvas interaction bugs: arrow preview clipping, ghost-drag jumps, corner-radius resizing, binding hover states, and waypoint glitches.',
          'Fixed split view bugs: resolved sidebar highlighting, unpinned columns getting stuck, and drag handle overflow clipping.',
          'Fixed date picker time fields that were uneditable or snapping back during typing.'
        ]
      }
    ]
  },
  {
    version: '1.1.4',
    build: '1104',
    date: '2026-07-03',
    title: 'Canvas Rebuilt: Real Arrow Binding, Free Text, Sections',
    sections: [
      {
        type: 'added',
        items: [
          'Arrows now connect to shapes exactly like Excalidraw: bind to a side, to a spot inside the shape, or to a free point on the edge — the arrow follows the shape wherever it moves.',
          'Text on the canvas is now transparent and grows as you type, just like Excalidraw — no more boxed text blocks.',
          'You can now type directly inside a shape or on an arrow to add a label — it stays centered and moves with its shape or arrow.',
          'Frames are now called Sections: a simple labeled container that clips its contents and moves them together, with no nested sections.',
          'Added an eraser tool — drag over anything to delete it in one step.',
          'Arrows and lines can now be toggled between straight and curved.',
          'Alt+drag now duplicates your selection; arrow keys nudge it by 1px (10px with Shift).',
          'Canvases now save as .flowr files in your vault, right alongside your notes — and since the format matches Excalidraw, you can rename one to .excalidraw and open it on excalidraw.com.'
        ]
      },
      {
        type: 'changed',
        items: [
          'Removed canvas comments entirely.',
          'Canvas connection points are no longer always-on dots — they appear only when you hover a shape with the arrow tool active.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Rebuilt the canvas arrow-binding math from scratch so arrows clip correctly to rectangles, ellipses, and diamonds instead of just bounding boxes.',
          'Split the large canvas page component into focused files to make future canvas features easier to build.'
        ]
      }
    ]
  },
  {
    version: '1.1.3',
    build: '1103',
    date: '2026-07-02',
    title: 'Obsidian-Style Sync, Settings Popup & Smooth Table Typing',
    sections: [
      {
        type: 'added',
        items: [
          'You can now edit your notes in external editors like Notepad or Obsidian, and Flowr will update them in real-time.',
          'Workspaces and folders in Flowr are now saved as real folders on your computer, matching the sidebar structure.',
          'Manually adding markdown files to your vault folder imports them instantly under "Unsorted" with full sync enabled.',
          'Converted the Settings page into a clean popup window so you can tweak options from anywhere without losing your page.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed table editing so typing quickly in different columns saves instantly and never discards your text.',
          'Corrected the Mac installation guide instructions path and fixed text overflow in the popup.',
          'Fixed desktop background startup routines to ensure the local database launches reliably.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Made the application download size much smaller and lighter by compressing code resources.',
          'Stripped out developer panels and administrative charts from production builds to improve launch speed.',
          'Configured app auto-updates to work seamlessly in the background while keeping the main code private.'
        ]
      }
    ]
  },
  {
    version: '1.1.2',
    build: '1102',
    date: '2026-07-02',
    title: 'AI That Can Actually Edit Your Notes',
    sections: [
      {
        type: 'added',
        items: [
          'The AI assistant can now edit your notes directly — just say "edit this note" or "add a section about..." and it makes the changes for you, no more copying and pasting markdown.',
          'The AI can find any note by name now, so "edit my shopping list" works even if you\'re looking at something else.',
          'The AI learned all the different ways to format your notes — headings, lists, checkboxes, tables, images, quotes, dividers, links — and when to use each tool.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'The AI finally knows which note you\'re talking about — no more editing the wrong page.',
          'Changes from the AI now show up immediately after it finishes, no page reload needed.',
          'Creating, editing, or adding to notes all properly update the screen right away.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Tightened up dashboard and workspace page card sizing for a cleaner look.'
        ]
      }
    ]
  },
  {
    version: '1.1.1',
    build: '1101',
    date: '2026-07-02',
    title: 'Citation Pills That Stay & Smarter Syncing',
    sections: [
      {
        type: 'fixed',
        items: [
          'Web search source pills now stay as interactive popup pills when you leave a chat and come back — they won\'t turn into plain underlined links anymore.',
        ]
      },
      {
        type: 'added',
        items: [
          'When you change the sync mode of a workspace, all notes, folders, and canvases inside it now automatically update to match — no more mismatched sync settings scattered across your vault.',
        ]
      },
      {
        type: 'changed',
        items: [
          'When all AI models fail, the app now shows "System Overload" directly instead of silently trying expensive backup models that could consume credits.',
          'Version and build numbers in settings now stay in sync automatically with the actual release.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Local app builds no longer attempt to package and publish desktop installers to the release channel — saving time and preventing accidental releases during development.',
          'Backend improvements to support AI providers in regions with restricted API access.'
        ]
      }
    ]
  },
  {
    version: '1.1.0',
    build: '1100',
    date: '2026-07-02',
    title: 'Smoother Panels & Cloud-Only Sync Cleanup',
    sections: [
      {
        type: 'improved',
        items: [
          'Task and chat side panels now slide open and closed smoothly instead of snapping, with content sliding along with the panel rather than popping in or vanishing mid-animation.',
          'Switching directly between the task panel and chat panel is now instant, with no flicker.',
          'Sidebar collapse/expand now animates in lockstep with the header instead of detaching partway through.',
          'Creating a task from the sidebar, command palette, or a kanban column now opens the task panel directly instead of a separate popup.',
          'Improved proportional widget sizing on the dashboard and workspace pages.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed a bug where notes and canvases set to "Cloud Only" could still end up with a local file on disk, mismatched with your actual sync setting.',
          'Fixed local files sometimes being saved with the wrong sync mode written into them.',
          'The app now checks your vault folder on startup and flags any leftover local files that no longer belong there, so you can clean them up in one click.'
        ]
      },
      {
        type: 'added',
        items: [
          'Added a confirmation popup when switching a note to "Cloud Only" if a local copy already exists — choose to delete it or keep it as an offline snapshot.',
          'Your choice to keep a local copy is now remembered, so you won\'t be asked about the same file again.'
        ]
      },
      {
        type: 'changed',
        items: [
          'Removed the old standalone "new task" popup in favor of opening the task panel directly.'
        ]
      }
    ]
  },
  {
    version: '1.0.9',
    build: '1009',
    date: '2026-07-01',
    title: 'Robust Offline File Sync & Hover Link Preview Overhaul',
    sections: [
      {
        type: 'added',
        items: [
          'Added a robust new three-way sync selector (Full Sync, Local Only, Cloud Only) inside Workspace settings to control exactly where your data is stored.',
          'Added instant sync mode visual indicators showing whether a workspace is currently saved to the cloud, local database, or local file system.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Redesigned the inline link creation popup in the editor toolbar to match the slick design of the link hover popup.',
          'Refined the quick-create plus button popup layout globally across the sidebar, folders, and workspace header to focus on Note and Canvas creation.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed note content saving inconsistencies to guarantee edits are saved persistently when switching pages.',
          'Fixed hover popups for standard underlined markdown text links in both chat and note editor.',
          'Fixed position of the sidebar plus button popup to appear directly below the button.'
        ]
      }
    ]
  },
  {
    version: '1.0.8',
    build: '1008',
    date: '2026-07-01',
    title: 'Smarter Shortcuts, Crisper Note Previews & Cross-Device Recents',
    sections: [
      {
        type: 'added',
        items: [
          'Your shortcuts are now remembered — pin your favorite pages and links once and they stay put instead of disappearing on reload.',
          'You can rearrange shortcuts by dragging them, with a smooth little animation when you drop one in place.',
          'When adding a shortcut to a page, you can now search for the page by typing its name instead of scrolling through a long list.',
          'The shortcuts grid now grows neatly to fit more items, so your board stays tidy as you add more.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Note previews on your dashboard now show links and text the way they actually look — cleaner, more readable, and no more weird stray symbols.',
          'Your recently opened pages now follow you across devices, so switching computers keeps your shortcuts and recents right where you left them.',
          'The little highlight bar that slides between tabs no longer flashes or jumps when you open a page — it waits until it knows where to go.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed a glitch where some sidebar and widget icons looked like they had a doubled, fuzzy outline — they\'re now crisp and clean.',
          'Fixed your name briefly showing as "Guest" in the sidebar for a moment when the app loads.'
        ]
      },
      {
        type: 'changed',
        items: [
          'Refreshed the app\'s accent color and card backgrounds for a tighter, more consistent look in both light and dark mode.'
        ]
      }
    ]
  },
  {
    version: '1.0.7',
    build: '1007',
    date: '2026-06-30',
    title: 'macOS & Linux Desktop Downloads',
    sections: [
      {
        type: 'added',
        items: [
          'Added macOS and Linux CI build runners so the desktop app is now downloadable as a .dmg (Mac) and .AppImage (Linux) — no more 404 errors when clicking the download button on a Mac.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'macOS: if Gatekeeper says "Flowr can\'t be verified", right-click the app → Open, or run: xattr -dr com.apple.quarantine "/Applications/Flowr Beta.app"'
        ]
      }
    ]
  },
  {
    version: '1.0.6',
    build: '1006',
    date: '2026-06-29',
    title: 'Manual Update Control & Vector Stroke Optimizations',
    sections: [
      {
        type: 'added',
        items: [
          'Added an interactive manual update checking mechanism with a checking/refreshing animation inside the updates popup and settings.',
          'Added manual "Check for updates" buttons in both the suggestion card and settings tab.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Resized and aligned AI assistant sidebar header utility buttons to match left sidebar brand actions.',
          'Refined temporary chat notice bubble widths and layout offsets in sidebar mode.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed vector stacked/overlapping stroke artifacts globally across translucent icons (search, download, sidebar toggles, bento widgets, and headers).',
          'Resolved double-rendered dashed bubble strokes in temporary chat onboarding greetings.'
        ]
      }
    ]
  },
  {
    version: '1.0.5',
    build: '1005',
    date: '2026-06-29',
    title: 'Multi-Selection Bounding Box & Desktop Design Update',
    sections: [
      {
        type: 'added',
        items: [
          'Added Figma-style multi-selection boxes so you can select, drag, and style multiple canvas items at once.',
          'Added a clean, frameless title bar that seamlessly blends into the app interface.',
          'Added quick buttons to collapse the sidebar or search your workspace in one click.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Polished the app update suggestion banner with smoother transitions, interactive hover effects, and premium ambient lighting.',
          'Refined context menus and popups to feel more compact and lightweight.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed startup issues that caused blank white screens or login redirect loops on desktop.',
          'Hardened overall database connection security to keep your personal data safe.'
        ]
      }
    ]
  },
  {
    version: '1.0.2',
    build: '1002',
    date: '2026-06-28',
    title: 'Desktop App Beta Release',
    sections: [
      {
        type: 'added',
        items: [
          'Added a quick setup guide on first startup to choose where to store your notes and files locally.',
          'Added a directory picker in Account Settings to let you easily switch your local storage folder.',
          'Added a automatic desktop app updater to make sure you always have the latest additions.',
          'Added a direct desktop download button in the sidebar to download the app setup instantly.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Improved the desktop app compilation to ensure it launches faster and runs without issues.',
          'Optimized app background communication layers to handle settings changes securely.'
        ]
      },
      {
        type: 'fixed',
        items: [
          'Fixed a deployment configuration bug that caused the web app to temporarily crash.',
          'Fixed file sync types to ensure your local storage and cloud stay perfectly synchronized.'
        ]
      }
    ]
  }
];

export const ARCHIVED_PATCHES: Patch[] = [
  {
    version: '1.5.1',
    build: '2321',
    date: '2026-06-27',
    title: 'Workspace Simplification & Performance Overhaul',
    sections: [
      {
        type: 'changed',
        items: [
          'Decluttered and simplified the workspace by deprecating unused legacy components, specifically removing "Life Mode" and separate "Knowledge" categorizations in favor of a unified, lightning-fast notes system.',
          'Simplified the document editor experience by deprecating old database table blocks and embedding frameworks, making note rendering much faster.'
        ]
      },
      {
        type: 'added',
        items: [
          'Added a "Local Cache Control" section in Settings, enabling users to easily clear local cache storage and force-reload the app if synchronization gets stuck.'
        ]
      },
      {
        type: 'improved',
        items: [
          'Streamlined AI Assistant prompt loading by using inlined, static context descriptions rather than requesting metadata from the database on every chat launch, improving responsiveness.',
          'Optimized database synchronization loops by removing deprecated schema definitions, hooks, and unused database fields.'
        ]
      }
    ]
  },
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
    ],
    images: {
      before: '/patches/before-1.5.0.png',
      after: '/patches/after-1.5.0.png',
      beforeTitle: 'Original Layout (v1.4.8)',
      afterTitle: 'Overhauled Workspace (v1.5.0)',
    }
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
