"use client";

import { useStore } from '@/data/store';
import { Sidebar } from './Sidebar';
import { isDesktop } from '@/lib/env';
import { HeaderBar } from './HeaderBar';
import { ContextMenu } from './ContextMenu';
import { NewSpaceModal } from '../modals/NewSpaceModal';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';
import { DeleteSpaceConfirmModal } from '../modals/DeleteSpaceConfirmModal';
import { DeleteAllDataModal } from '../modals/DeleteAllDataModal';
import { MoveToModal } from '../modals/MoveToModal';
import { RenameModal } from '../modals/RenameModal';
import { SettingsModal } from '../modals/SettingsModal';
import { MediaViewerModal } from '../modals/MediaViewerModal';
import { SummaryPreviewModal } from '../modals/SummaryPreviewModal';
import { VaultSetupModal } from '../modals/VaultSetupModal';
import { SyncFileCleanupModal } from '../modals/SyncFileCleanupModal';
import { LocalOnlyConfirmModal } from '../modals/LocalOnlyConfirmModal';
import { PdfExportModal } from '../modals/PdfExportModal';
import { SplitViewLayout } from './SplitViewLayout';


import { AIAssistant } from '../assistant/AIAssistant';
import { TaskInspectorPanel } from '../tracker/TaskInspectorPanel';
import { CommandPalette } from './CommandPalette';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { SmoothScroll } from './SmoothScroll';
import { TooltipOverlayProvider } from './TooltipOverlayContext';

export function Shell({ children, initialEntityId }: { children: React.ReactNode, initialEntityId?: string }) {
  const theme = useStore(state => state.theme);
  const interfaceSize = useStore(state => state.interfaceSize);

  const modal = useStore(state => state.modal);
  const isSidebarCollapsed = useStore(state => state.isSidebarCollapsed);
  const isTabsHeaderVisible = useStore(state => state.isTabsHeaderVisible);
  const isSidebarPinned = useStore(state => state.isSidebarPinned);
  const toggleSidebar = useStore(state => state.toggleSidebar);
  const activeEntityId = useStore(state => state.activeEntityId);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const setNavigationState = useStore(state => state.setNavigationState);
  const navigationHistory = useStore(state => state.navigationHistory);
  const historyIndex = useStore(state => state.historyIndex);
  const goBack = useStore(state => state.goBack);
  const goForward = useStore(state => state.goForward);
  const isAIAssistantOpen = useStore(state => state.isAIAssistantOpen);
  const isAIAssistantExtended = useStore(state => state.isAIAssistantExtended);
  const isTaskPanelOpen = useStore(state => state.isTaskPanelOpen);
  const toggleCommandPalette = useStore(state => state.toggleCommandPalette);
  const isInternalNavRef = useRef(false);
  const [isMounted, setIsMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Strip ?guest from URL after guest entry bypass
  useEffect(() => {
    if (window.location.search.includes('guest=1')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // 1. Initial Hydration
  useEffect(() => {
    setIsMounted(true);
    // Zustand hydration check
    const checkHydration = () => {
      if (useStore.persist.hasHydrated()) {
        setStoreHydrated(true);
      } else {
        const unsub = useStore.persist.onFinishHydration(() => {
          setStoreHydrated(true);
          unsub();
        });
      }
    };
    checkHydration();
  }, []);

  const hasHydrated = isMounted && storeHydrated;
  const [allowTransitions, setAllowTransitions] = useState(false);

  useEffect(() => {
    if (hasHydrated) {
      const timer = setTimeout(() => {
        setAllowTransitions(true);
        document.documentElement.classList.remove('preload');
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [hasHydrated]);

  const modalKey = useMemo(() => {
    if (!modal) return 'none';
    const kind = modal.kind;
    const entityId = 'entityId' in modal ? modal.entityId : undefined;
    if (entityId) return `${kind}-${entityId}`;
    return kind;
  }, [modal]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-interface-size', interfaceSize);
  }, [interfaceSize]);

  // Global Keyboard Shortcuts for Navigation
  useEffect(() => {
    const handleNavigationShortcuts = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        window.history.back();
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        window.history.forward();
      } else if (e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    window.addEventListener('keydown', handleNavigationShortcuts);
    return () => window.removeEventListener('keydown', handleNavigationShortcuts);
  }, []);

  // Global Copy Event Interceptor: Enforces plain text copying to prevent custom styling and background colors from leaking
  useEffect(() => {
    const handleGlobalCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection();
      if (selection && selection.toString()) {
        e.clipboardData?.setData('text/plain', selection.toString());
        e.preventDefault();
      }
    };
    document.addEventListener('copy', handleGlobalCopy);
    return () => document.removeEventListener('copy', handleGlobalCopy);
  }, []);

  // 2. Initial State & History Alignment
  useEffect(() => {
    if (!hasHydrated) return;

    const state = window.history.state;
    if (state && state.entityId) {
      setActiveEntityId(state.entityId);
    } else if (!activeEntityId || activeEntityId === 'dashboard') {
      // Default to dashboard if nothing is set
      setActiveEntityId('dashboard');
      window.history.replaceState({ entityId: 'dashboard', index: 0 }, '');
    }
  }, [hasHydrated]);

  // 3. Browser Back/Forward (popstate)
  useEffect(() => {
    if (!hasHydrated) return;

    const onPopState = (e: PopStateEvent) => {
      const entityId = e.state?.entityId;
      if (entityId) {
        isInternalNavRef.current = true;
        setActiveEntityId(entityId);
        // Reset flag shortly after
        setTimeout(() => { isInternalNavRef.current = false; }, 50);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [hasHydrated, setActiveEntityId]);

  // 4. Update History on App Navigation
  useEffect(() => {
    if (!hasHydrated) return;

    const currentState = window.history.state;
    if (activeEntityId && !isInternalNavRef.current && activeEntityId !== currentState?.entityId) {
      window.history.pushState({ entityId: activeEntityId, index: Date.now() }, '');
    }
  }, [activeEntityId, hasHydrated]);

  // Auto-collapse sidebar on mobile when activeEntityId changes
  useEffect(() => {
    if (isMobile && !isSidebarCollapsed) {
      toggleSidebar();
    }
  }, [activeEntityId, isMobile]);

  const sidebarWidth = useStore(state => state.sidebarWidth);
  const setSidebarWidth = useStore(state => state.setSidebarWidth);
  const aiSidebarWidth = useStore(state => state.aiSidebarWidth);
  const setAiSidebarWidth = useStore(state => state.setAiSidebarWidth);

  const splitViewActive = useStore(state => state.splitViewActive);

  // Sync --sidebar-w CSS var on <html> when sidebar width/collapse changes
  useLayoutEffect(() => {
    const existing = document.documentElement.style.getPropertyValue('--sidebar-w');
    if (existing && !hasHydrated) return;

    let w: number;
    if (hasHydrated) {
      // On desktop (Electron), collapsed sidebar shows icon-only strip (64px or 0).
      // On web, max-width handles the collapse animation, so always use sidebarWidth.
      w = (isDesktop() && isSidebarCollapsed) ? (isTabsHeaderVisible ? 0 : 64) : sidebarWidth;
    } else {
      // Fallback: read localStorage directly when script didn't set it
      try {
        const str = localStorage.getItem('flowr-storage');
        if (str) {
          const state = JSON.parse(str).state;
          if (state.isSidebarCollapsed) w = 0;
          else if (state.sidebarWidth != null) w = state.sidebarWidth;
          else w = 280;
        } else {
          w = 280;
        }
      } catch { w = 280; }
    }
    document.documentElement.style.setProperty('--sidebar-w', w + 'px');
  }, [isSidebarCollapsed, isTabsHeaderVisible, sidebarWidth, hasHydrated]);

  const isResizingLeftRef = useRef(false);
  const isResizingRightRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  // Hot-edge detection: expand unpinned collapsed sidebar when mouse approaches left edge
  const edgeTriggeredRef = useRef(false);
  useEffect(() => {
    const handleEdgeMove = (e: MouseEvent) => {
      const atEdge = e.clientX <= 8;
      if (atEdge && isSidebarCollapsed && !isSidebarPinned && !edgeTriggeredRef.current) {
        edgeTriggeredRef.current = true;
        toggleSidebar();
      } else if (!atEdge) {
        edgeTriggeredRef.current = false;
      }
    };
    document.addEventListener('mousemove', handleEdgeMove);
    return () => document.removeEventListener('mousemove', handleEdgeMove);
  }, [isSidebarCollapsed, isSidebarPinned, toggleSidebar]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingLeftRef.current && !isResizingRightRef.current) return;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (isResizingLeftRef.current) {
          setSidebarWidth(Math.min(Math.max(e.clientX, 250), 400));
        }
        if (isResizingRightRef.current) {
          // Both panels share the same width, so always write to aiSidebarWidth
          setAiSidebarWidth(Math.min(Math.max(window.innerWidth - e.clientX, 400), 500));
        }
      });
    };

    const stopResize = () => {
      if (!isResizingLeftRef.current && !isResizingRightRef.current) return;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      isResizingLeftRef.current = false;
      isResizingRightRef.current = false;
      setIsResizingLeft(false);
      setIsResizingRight(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);
    window.addEventListener('mouseleave', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('mouseleave', stopResize);
    };
  }, [setSidebarWidth, setAiSidebarWidth]);

  const shellClass = "h-screen w-full overflow-hidden bg-background text-foreground";

  const currentAiSidebarWidth = hasHydrated ? Math.min(aiSidebarWidth, 500) : 400;
  const isTaskPanelVisible = !isMobile && isTaskPanelOpen && !splitViewActive;
  const isAiPanelMounted = hasHydrated && isAIAssistantExtended && activeEntityId !== 'chat' && !splitViewActive;
  const isAiPanelOpen = isAiPanelMounted && isAIAssistantOpen;
  // Task panel and AI panel share the same width — no jump when switching
  const currentRightPanelWidth = currentAiSidebarWidth;
  const currentSidebarCollapsed = isSidebarCollapsed;

  const leftWidth = currentSidebarCollapsed ? (isTabsHeaderVisible ? 0 : 64) : sidebarWidth;
  const rightWidth = (isTaskPanelVisible || isAiPanelOpen) ? currentRightPanelWidth : 0;

  // Keep panel content visible for the full duration of the slide-out animation.
  // Without this, visibility:hidden fires instantly on close while max-width is still animating.
  const [isTaskPanelContentVisible, setIsTaskPanelContentVisible] = useState(false);
  const taskPanelCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isTaskPanelVisible) {
      if (taskPanelCloseTimer.current) clearTimeout(taskPanelCloseTimer.current);
      setIsTaskPanelContentVisible(true);
    } else {
      taskPanelCloseTimer.current = setTimeout(() => setIsTaskPanelContentVisible(false), 310);
    }
    return () => { if (taskPanelCloseTimer.current) clearTimeout(taskPanelCloseTimer.current); };
  }, [isTaskPanelVisible]);

  const [isAiPanelContentVisible, setIsAiPanelContentVisible] = useState(false);
  const aiPanelCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isAiPanelOpen) {
      if (aiPanelCloseTimer.current) clearTimeout(aiPanelCloseTimer.current);
      setIsAiPanelContentVisible(true);
    } else {
      aiPanelCloseTimer.current = setTimeout(() => setIsAiPanelContentVisible(false), 310);
    }
    return () => { if (aiPanelCloseTimer.current) clearTimeout(aiPanelCloseTimer.current); };
  }, [isAiPanelOpen]);

  return (
    <TooltipOverlayProvider>
      <div
        className={cn(
          shellClass,
          "shell-container",
          "flex flex-col",
          !allowTransitions && "preload",
          currentSidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded",
          (isResizingLeft || isResizingRight) && "resizing-active"
        )}
        style={{
          transition: 'none'
        } as React.CSSProperties}
      >
        <SmoothScroll />
        {/* Mobile Sidebar Backdrop */}
        {!currentSidebarCollapsed && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden cursor-pointer" onClick={toggleSidebar} />
        )}

        {/* Global Desktop Header */}
        {isDesktop() && (
          <HeaderBar leftWidth={leftWidth} rightWidth={rightWidth} />
        )}

        {/* Middle Layout (Sidebar + Main + AI Sidebar) */}
        <div className={cn(
          "flex-1 flex flex-row overflow-hidden relative w-full min-h-0",
          isDesktop() && "px-2 pb-2 gap-2 bg-[var(--app-dark)]"
        )}>
          {/* 1. Left Sidebar Section */}
          <div
            className={cn(
              "h-full min-w-0 min-h-0 shrink-0 flex flex-row relative",
              (!currentSidebarCollapsed || !isTabsHeaderVisible) && !isDesktop() && "border-r border-[var(--bone-10)]",
              isMobile
                ? (currentSidebarCollapsed ? "hidden" : "fixed inset-y-0 left-0 z-50")
                : "flex overflow-hidden"
            )}
            style={isMobile ? undefined : {
              width: 'var(--sidebar-w, 280px)',
              maxWidth: currentSidebarCollapsed ? (isTabsHeaderVisible ? '0px' : '64px') : 'var(--sidebar-w, 280px)',
              transition: isResizingLeft ? 'none' : 'max-width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div className={cn(
              "relative h-full w-full overflow-hidden",
              isDesktop() && "bg-sidebar border border-[var(--bone-10)] rounded-2xl shadow-sm"
            )}>
              <div className="h-full">
                <Sidebar forceFull={currentSidebarCollapsed && isTabsHeaderVisible} />
              </div>
            </div>

            {/* Left Resizer Handle */}
            {!isSidebarCollapsed && (
              <div
                onMouseDown={() => {
                  isResizingLeftRef.current = true;
                  setIsResizingLeft(true);
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                }}
                className={cn(
                  "hidden md:block w-2 h-full cursor-col-resize absolute -right-1 top-0 z-50 transition-colors duration-200 group",
                  isResizingLeft ? "bg-[var(--bone-15)]" : ""
                )}
              >
                <div className={cn(
                  "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] transition-all duration-200",
                  isResizingLeft ? "bg-[var(--bone-70)] opacity-100" : "bg-[var(--bone-30)] opacity-0 group-hover:opacity-100"
                )} />
              </div>
            )}
          </div>

          {/* 2. Main Content + Right AI Sidebar Wrapper */}
          <div className={cn("flex-1 flex flex-row overflow-hidden relative min-w-0 h-full", isDesktop() && "gap-2")}>
            {/* Main Content Area */}
            <div className={cn(
              "flex-1 flex flex-col h-full overflow-hidden relative min-w-0",
              isDesktop() && !splitViewActive && "bg-[var(--app-background)] border border-[var(--bone-10)] rounded-2xl shadow-sm"
            )}>
              {splitViewActive ? (
                <SplitViewLayout />
              ) : (
                <>
                  {!isDesktop() && <HeaderBar />}
                  <main className="flex-1 flex flex-col overflow-hidden relative">
                    {children}
                  </main>
                </>
              )}
            </div>

            {/* Right AI Sidebar Backdrop */}
            {isMobile && (isAiPanelOpen) && (
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden cursor-pointer"
                onClick={() => useStore.getState().setAIAssistantOpen(false)}
              />
            )}

            {/* Right Resizer Handle */}
            {!isMobile && (isTaskPanelVisible || isAiPanelOpen) && (
              <div
                onMouseDown={() => {
                  isResizingRightRef.current = true;
                  setIsResizingRight(true);
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                }}
                className={cn(
                  "w-2 h-full cursor-col-resize absolute left-0 z-50 transition-colors duration-200 group",
                  isResizingRight ? "bg-[var(--bone-15)]" : "bg-transparent"
                )}
                style={{
                  left: `calc(100% - ${currentRightPanelWidth}px - 4px)`,
                  pointerEvents: 'auto'
                }}
              >
                <div className={cn(
                  "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] transition-all duration-200",
                  isResizingRight ? "bg-[var(--bone-70)] opacity-100" : "bg-[var(--bone-30)] opacity-0 group-hover:opacity-100"
                )} />
              </div>
            )}

            {/* Right Panel — single flex shrink-0 element, max-width animated.
                overflow-hidden clips content as the panel opens/closes so the
                left edge and content always move as one unit. */}
            <div
              className={cn(
                isMobile
                  ? ((isAIAssistantOpen || isTaskPanelVisible) ? "fixed inset-y-0 right-0 z-50 w-[85vw] max-w-[400px] flex flex-col bg-sidebar" : "hidden")
                  : "h-full shrink-0 overflow-hidden"
              )}
              style={!isMobile ? {
                width: (isTaskPanelVisible || isAiPanelOpen) ? `${currentRightPanelWidth}px` : '0px',
                transition: (isResizingRight || isResizingLeft) ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)',
              } : undefined}
            >
              <div className={cn(
                "h-full",
                !isDesktop() && (isAiPanelOpen || isTaskPanelVisible) && "bg-sidebar border-l border-[var(--bone-10)]",
                isDesktop() && "bg-sidebar border border-[var(--bone-10)] rounded-2xl shadow-sm overflow-hidden"
              )} style={{ width: `${currentRightPanelWidth}px` }}>
                <div className="relative h-full w-full">
                  <div className="absolute inset-0" style={{ visibility: isTaskPanelContentVisible ? 'visible' : 'hidden' }}>
                    <TaskInspectorPanel />
                  </div>
                  {isAiPanelMounted && (
                    <div className="absolute inset-0" style={{ visibility: isAiPanelContentVisible && !isTaskPanelVisible ? 'visible' : 'hidden' }}>
                      <AIAssistant forceVisible={isAiPanelContentVisible && !isTaskPanelVisible} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div> {/* End Middle Layout */}

        {/* Global overlays */}
        <ContextMenu />
        <DeleteConfirmModal key={modal?.kind === 'deleteConfirm' ? modalKey : 'delete-none'} />
        <DeleteSpaceConfirmModal key={modal?.kind === 'deleteSpaceConfirm' ? modalKey : 'delete-space-none'} />
        <DeleteAllDataModal key={modal?.kind === 'deleteAllDataConfirm' ? modalKey : 'delete-all-none'} />
        <MoveToModal key={modal?.kind === 'moveTo' ? modalKey : 'move-none'} />
        <RenameModal key={modal?.kind === 'rename' ? modalKey : 'rename-none'} />
        {modal?.kind === 'pdfExport' && <PdfExportModal key={modalKey} />}
                <SettingsModal key="settings-modal" />
        <MediaViewerModal key="media-viewer" />
        <NewSpaceModal key="new-workspace" />
        <SummaryPreviewModal key="summary-preview" />
        <CommandPalette key="command-palette" />
        <VaultSetupModal key="vault-setup" />
        <SyncFileCleanupModal key="sync-file-cleanup" />
        <LocalOnlyConfirmModal key="local-only-confirm" />




      </div>
    </TooltipOverlayProvider>
  );
}


