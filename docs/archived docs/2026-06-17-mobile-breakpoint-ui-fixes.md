# Mobile Breakpoint UI Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the fully broken mobile/breakpoint UI by implementing responsive drawer behaviors, hierarchical title navigation, full-screen mobile floating panels, and stacked mobile Bento dashboard views.

**Architecture:** Use CSS media queries combined with light `isMobile` client-side hooks to selectively toggle between absolute grid positioning on desktop and natural vertical flow on mobile. Shift interactive backdrops and floating panels to behave as full-screen drawers on mobile viewports.

**Tech Stack:** React, Tailwind CSS, Zustand, Lucide Icons

---

### Task 1: Clean Shell Grid Columns for Mobile viewports

**Files:**
- Modify: `src/components/layout/Shell.tsx:273-288`

**Step 1: Write the failing test**

Since this is a visual UI styling check, we'll write a manual validation instruction.
Expected: Grid columns on mobile are set by stylesheet (`1fr` or `100%`) instead of inline overriding `gridTemplateColumns`.

**Step 2: Run test to verify it fails**

In Chrome DevTools, inspect the shell container element `.shell-container` on mobile size.
Expected: `grid-template-columns` is inline-styled to `var(--sidebar-w, 280px) 1fr`, squishing the content.

**Step 3: Write minimal implementation**

Modify `src/components/layout/Shell.tsx`:
```tsx
    <div
      className={cn(
        shellClass,
        "shell-container",
        !allowTransitions && "preload",
        currentSidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded",
        (isResizingLeft || isResizingRight) && "resizing-active"
      )}
      style={{
        transition: 'none'
      } as React.CSSProperties}
    >
```

**Step 4: Run test to verify it passes**

Inspect `.shell-container` in mobile layout. It must fall back to the CSS stylesheet definition (`grid-template-columns: 1fr`).

**Step 5: Commit**

```bash
git add src/components/layout/Shell.tsx
git commit -m "style: remove inline grid columns to let css control mobile width"
```

---

### Task 2: Fix Left Sidebar Backdrop Sizing on Mobile

**Files:**
- Modify: `src/components/layout/Shell.tsx:288-330`

**Step 1: Write the failing test**

Click the hamburger menu on mobile to open the sidebar. Observe backdrop coverage.
Expected: Backdrop covers 100% of the screen width and height.

**Step 2: Run test to verify it fails**

On mobile, open the sidebar. The backdrop only covers the 280px width of the sidebar wrapper.

**Step 3: Write minimal implementation**

1. Add `isMobile` state detection using resize listener.
2. Render Left Sidebar Backdrop overlay as a direct child of the shell container with `fixed inset-0 z-40`.
3. Wrap Left Sidebar in `hidden md:flex` if collapsed, and position it as a drawer `fixed inset-y-0 left-0 z-50` when expanded on mobile.

```tsx
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
```

And in the JSX:
```tsx
      <SmoothScroll />
      {/* Mobile Sidebar Backdrop */}
      {!currentSidebarCollapsed && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden cursor-pointer" onClick={toggleSidebar} />
      )}

      {/* 1. Left Sidebar Section */}
      <div
        className={cn(
          "h-full min-w-0 min-h-0 shrink-0 flex flex-row relative",
          (!currentSidebarCollapsed || !isTabsHeaderVisible) && "border-r border-[var(--bone-10)]",
          currentSidebarCollapsed ? "hidden md:flex" : "fixed inset-y-0 left-0 z-50 md:relative md:inset-auto md:flex"
        )}
        style={{
          width: isMobile ? (currentSidebarCollapsed ? '0px' : '280px') : 'var(--sidebar-w, 280px)',
          transition: 'none'
        }}
      >
```

**Step 4: Run test to verify it passes**

Open the sidebar on mobile. The backdrop must cover the entire viewport and correctly close the sidebar when clicked.

**Step 5: Commit**

```bash
git add src/components/layout/Shell.tsx
git commit -m "layout: fix mobile sidebar backdrop overlay and drawer positioning"
```

---

### Task 3: Auto-Collapse Sidebar on Page Navigation on Mobile

**Files:**
- Modify: `src/components/layout/Shell.tsx:265-273`

**Step 1: Write the failing test**

Open the sidebar on mobile, click "Tasks".
Expected: Sidebar slides closed, showing the Tasks page.

**Step 2: Run test to verify it fails**

Sidebar stays open when navigation occurs on mobile.

**Step 3: Write minimal implementation**

In `src/components/layout/Shell.tsx`, add an effect monitoring `activeEntityId`:
```tsx
  // Auto-collapse sidebar on mobile when activeEntityId changes
  useEffect(() => {
    if (isMobile && !isSidebarCollapsed) {
      toggleSidebar();
    }
  }, [activeEntityId, isMobile]);
```

**Step 4: Run test to verify it passes**

Clicking any item in the sidebar drawer on mobile must immediately close the drawer.

**Step 5: Commit**

```bash
git add src/components/layout/Shell.tsx
git commit -m "feat: auto-collapse sidebar on mobile page navigation"
```

---

### Task 4: Hide Horizontal Page Tabs on Mobile

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx:208-289`

**Step 1: Write the failing test**

Open any note page on mobile. Inspect the header bar.
Expected: No horizontal tabs bar visible.

**Step 2: Run test to verify it fails**

Header shows cramped, overflowing tab buttons.

**Step 3: Write minimal implementation**

Wrap the tabs container in `hidden md:flex`:
```tsx
      {/* Tabs */}
      <div className="hidden md:flex flex-1 items-center gap-1 h-full px-2 min-w-0">
        {openTabIds.map((tabId) => {
          ...
```

**Step 4: Run test to verify it passes**

Open page. Observe that tabs row is gone on mobile.

**Step 5: Commit**

```bash
git add src/components/layout/HeaderBar.tsx
git commit -m "style: hide header tabs row on mobile viewports"
```

---

### Task 5: Implement Mobile Page Title & Back Chevron Navigation

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx:9-35`
- Modify: `src/components/layout/HeaderBar.tsx:165-207`

**Step 1: Write the failing test**

Open a note page on mobile.
Expected: Title displays "Untitled Note" (or note title), and top-left shows a ChevronLeft icon.

**Step 2: Run test to verify it fails**

No title is visible (it was in the hidden tabs), the top-left button remains the Hamburger Menu icon, and importing `ChevronLeft` is missing causing compile errors.

**Step 3: Write minimal implementation**

1. Import `ChevronLeft` and `MoreHorizontal` from `lucide-react` in `src/components/layout/HeaderBar.tsx`:
```tsx
import { 
  ArrowLeft, 
  ArrowRight, 
  RotateCw, 
  Star, 
  Link, 
  FolderInput, 
  Copy, 
  Pencil, 
  Trash2,
  LayoutDashboard,
  MessageSquare,
  Calendar,
  ListTodo,
  Type,
  Menu,
  Minus,
  X,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Plus,
  Database,
  History,
  PanelLeft,
  FileText,
  Frame,
  Layers
} from 'lucide-react';
```
2. Render a clean title block visible only on mobile:
```tsx
      {/* Mobile Title View */}
      <div className="flex md:hidden flex-1 items-center px-1 min-w-0 font-semibold text-sm text-[var(--bone-100)] truncate">
        {isDashboard ? 'Home' : 
         activeEntityId === 'tracker' ? 'Tasks' :
         activeEntityId === 'chat' ? 'Chat' : 
         stripHtml(entities.find(e => e.id === activeEntityId)?.title || '')}
      </div>
```
3. Render `ChevronLeft` instead of `Menu` if not on dashboard:
```tsx
        <button 
          onClick={toggleSidebar}
          className="md:hidden p-1 rounded-[var(--radius-small)] hover:bg-hover text-[var(--bone-70)] hover:text-[var(--bone-100)]"
        >
          {isDashboard ? (
            <Menu strokeWidth={2} className="w-5 h-5" />
          ) : (
            <ChevronLeft strokeWidth={2} className="w-5 h-5" />
          )}
        </button>
```

**Step 4: Run test to verify it passes**

Title renders correctly. Clicking the ChevronLeft back button opens the sidebar drawer.

**Step 5: Commit**

```bash
git add src/components/layout/HeaderBar.tsx
git commit -m "feat: show mobile title and chevron navigation back to sidebar list"
```

---

### Task 6: Group Right Header Actions into Popover on Mobile

**Files:**
- Modify: `src/components/layout/HeaderBar.tsx:365-412`

**Step 1: Write the failing test**

Open a note page on mobile.
Expected: A single `...` icon button on the right. Clicking it displays a dropdown list of options (Pin, Rename, Duplicate, Delete).

**Step 2: Run test to verify it fails**

Header right displays a crowded list of 6-8 small icons.

**Step 3: Write minimal implementation**

1. Group the actions on mobile under a single `MoreHorizontal` button.
2. Call `openContextMenu(activeEntityId, rect.left - 120, rect.bottom + 4, 'sidebar')` on click.
3. Hide the desktop actions using `hidden md:flex`.

```tsx
      {/* Right side actions — only for content pages (note / mixed / canvas) */}
      {(() => {
        const activeEntity = activeEntityId ? entities.find(e => e.id === activeEntityId) : null;
        const isContentPage = activeEntity && ['note', 'mixed', 'canvas'].includes(activeEntity.type);
        if (!isContentPage) return null;
        return (
          <>
            {/* Mobile Dropdown Trigger */}
            <div className="ml-auto flex md:hidden items-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openContextMenu(activeEntityId, rect.left - 120, rect.bottom + 4, 'sidebar');
                }}
                className="w-6 h-6 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
              >
                <MoreHorizontal strokeWidth={2} className="w-4 h-4" />
              </button>
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex ml-auto items-center gap-0.5">
              {ACTIONS.map(action => {
                const isNoteOrMixed = activeEntity.type === 'note' || activeEntity.type === 'mixed';
                if (action.id === 'layout' && !isNoteOrMixed) return null;

                return (
                  <Tooltip 
                    key={action.id} 
                    content={action.label}
                    disabled={!!modal || (contextMenu?.entityId === activeEntityId)}
                  >
...
                  </Tooltip>
                );
              })}
            </div>
          </>
        );
      })()}
```

**Step 4: Run test to verify it passes**

Only a single ellipsis is rendered on mobile. Clicking it opens the context menu dropdown correctly.

**Step 5: Commit**

```bash
git add src/components/layout/HeaderBar.tsx
git commit -m "feat: group note header actions under more button on mobile"
```

---

### Task 7: Bento Dashboard Grid Auto-Stack on Mobile

**Files:**
- Modify: `src/components/bento/BentoDashboard.tsx:428-568`

**Step 1: Write the failing test**

View the Dashboard on mobile.
Expected: All widgets stack vertically and scroll cleanly, with natural sizing.

**Step 2: Run test to verify it fails**

Widgets are positioned absolutely and squished horizontally.

**Step 3: Write minimal implementation**

1. Set `isMobile` check inside `BentoDashboard.tsx`.
2. Stack widgets vertically on mobile:
```tsx
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
```
3. Update the container layout grid classes and child grid positioning:
```tsx
          <div
            ref={gridRef}
            className={cn('relative w-full', reallyLoading && 'bento-no-transitions', isMobile ? 'flex flex-col gap-3 overflow-y-auto h-full pr-1 pb-8' : '')}
            style={{ flex: 1, minHeight: 0 }}
          >
```
4. Set height and style dynamically for children based on computed row height `item.h`:
```tsx
              let mobileHeight = '200px';
              if (item.h === 1) mobileHeight = '150px';
              if (item.h === 2) mobileHeight = '220px';
              if (item.h >= 3) mobileHeight = '320px';
```
And cell rendering:
```tsx
                  <div
                    className={cn(
                      isMobile ? 'relative w-full shrink-0' : 'absolute bento-widget-cell',
                      isDragged && 'opacity-0 pointer-events-none',
                      editMode && 'cursor-grab active:cursor-grabbing hover:z-10 overflow-visible',
                      isSwapTarget && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-[var(--radius-big)]',
                      isStackTarget && 'ring-2 ring-accent ring-offset-2 ring-offset-background rounded-[var(--radius-big)] bg-accent/5 z-20 scale-105 transition-all duration-300'
                    )}
                    style={isMobile ? { height: mobileHeight, marginBottom: '4px' } : { ...style, transition: (isDragged || !!verticalDividerDrag || !!dividerDrag) ? 'none' : 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
```
5. Hide the layout edit toolbar buttons on mobile header using `hidden md:flex`.

**Step 4: Run test to verify it passes**

Inspect home page in mobile browser. Widgets must be full width, stack vertically, and have correct margins.

**Step 5: Commit**

```bash
git add src/components/bento/BentoDashboard.tsx
git commit -m "layout: stack bento widgets vertically on mobile viewports"
```

---

### Task 8: Disable Bento Grid Resizers on Mobile

**Files:**
- Modify: `src/components/bento/BentoDashboard.tsx:315-412`

**Step 1: Write the failing test**

Hover near widgets on mobile dashboard.
Expected: Resizing handlers/drag borders are not rendered and cannot be interacted with.

**Step 2: Run test to verify it fails**

Divider bars are still generated in memory and could potentially interfere with touch events.

**Step 3: Write minimal implementation**

Return `[]` from dividers and verticalDividers hooks on mobile:
```tsx
  const dividers = useMemo(() => {
    if (isMobile) return [];
    if (!editMode || dragState) return [];
    ...
  }, [layout, positions, editMode, dragState, isMobile]);

  const verticalDividers = useMemo(() => {
    if (isMobile) return [];
    if (!editMode || dragState) return [];
    ...
  }, [layout, positions, editMode, dragState, isMobile]);
```

**Step 4: Run test to verify it passes**

Observe dividers list length is 0. No drag interfaces are rendered.

**Step 5: Commit**

```bash
git add src/components/bento/BentoDashboard.tsx
git commit -m "perf: disable dashboard resizer dividers on mobile"
```

---

### Task 9: AI Assistant Mobile Layout Floating & Backdrop drawer

**Files:**
- Modify: `src/components/layout/Shell.tsx:345-380`
- Modify: `src/components/assistant/AIAssistant.tsx:580-588`

**Step 1: Write the failing test**

Open floating AI assistant on mobile.
Expected: Viewport is covered completely by the floating assistant, and no desktop gaps remain.

**Step 2: Run test to verify it fails**

Assistant floats off-screen with fixed width.

**Step 3: Write minimal implementation**

1. Modify `src/components/assistant/AIAssistant.tsx` to handle full screen on mobile floating:
```tsx
          chatPageMode
            ? "relative w-full h-auto"
            : actualExtended
              ? "relative w-full h-full"
              : "fixed inset-0 w-full h-full max-h-screen z-[100] rounded-none border-none overflow-hidden zoom-in-95 md:inset-auto md:bottom-6 md:right-6 md:w-[380px] md:h-[680px] md:max-h-[calc(100vh-3rem)] md:rounded-[var(--radius-big)] md:border md:border-[var(--bone-10)]"
```
2. Modify `src/components/layout/Shell.tsx` to handle the backdrop and drawer width for side-by-side mode on mobile:
```tsx
        {/* Right AI Sidebar Backdrop */}
        {isAIAssistantExtended && isAIAssistantOpen && activeEntityId !== 'chat' && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden cursor-pointer" 
            onClick={() => useStore.getState().setAIAssistantOpen(false)} 
          />
        )}
```
And:
```tsx
        {/* Right AI Sidebar Wrapper */}
        <div
          className={cn(
            "h-full bg-sidebar shrink-0 overflow-hidden transition-colors duration-200",
            (isAIAssistantExtended && isAIAssistantOpen && activeEntityId !== 'chat') && "border-l border-[var(--bone-10)]",
            isMobile ? "fixed inset-y-0 right-0 z-50 w-[85vw] max-w-[400px]" : "relative z-40"
          )}
          style={{
            width: isMobile ? undefined : ((isAIAssistantExtended && isAIAssistantOpen && activeEntityId !== 'chat') ? `${currentAiSidebarWidth}px` : '0px'),
            transition: (isResizingRight || isResizingLeft) ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
```

**Step 4: Run test to verify it passes**

Open the AI Assistant in both floating and side-by-side configurations. Observe clean overlay behaviors.

**Step 5: Commit**

```bash
git add src/components/layout/Shell.tsx src/components/assistant/AIAssistant.tsx
git commit -m "layout: render right drawer and full-screen floating panels for mobile AI assistant"
```

---

### Task 10: Fix Full-width Padding on Mobile Notes

**Files:**
- Modify: `src/components/editor/NoteEditor.tsx:1203-1207`

**Step 1: Write the failing test**

Open a note page in full-width mode on mobile.
Expected: Content has standard padding (`px-4`) instead of massive margins.

**Step 2: Run test to verify it fails**

Content has massive `px-20` padding, making text area extremely narrow and vertical.

**Step 3: Write minimal implementation**

Change the full width padding conditional class in `src/components/editor/NoteEditor.tsx`:
```tsx
          className={cn(
            isFullWidth ? "w-full md:px-20 px-4" : "max-w-[850px] px-4",
            "mx-auto pt-8 pb-32 flex-1 min-w-0 w-full relative z-10"
          )}
```

**Step 4: Run test to verify it passes**

Note text is readable on mobile with clear margins.

**Step 5: Commit**

```bash
git add src/components/editor/NoteEditor.tsx
git commit -m "style: prevent squishing layout on mobile full-width notes"
```

---

## Verification Plan

### Automated Tests
Run verification build:
```bash
npm run build
```
Expected: successful compilation.

### Manual Verification
1. Inspect the dashboard bento cards in Chrome DevTools mobile view. Verify they stack cleanly and scroll vertically.
2. Click the top-left menu icon. The Left Sidebar should slide open as a drawer with a full viewport backdrop.
3. Click any workspace, page, chat, or tracker link in the Left Sidebar. Verify the sidebar closes immediately.
4. Verify the top HeaderBar displays the page title and ChevronLeft icon on sub-pages.
5. Verify note page actions are grouped into a `...` button.
6. Open the floating AI assistant. Verify it occupies the full viewport.
7. Toggle full-width mode on a note page. Margins must scale down to standard `px-4`.
