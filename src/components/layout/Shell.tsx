"use client";

import { useStore } from '@/data/store';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';
import { ContextMenu } from './ContextMenu';
import { NewCollectionModal } from '../modals/NewCollectionModal';
import { DeleteConfirmModal } from '../modals/DeleteConfirmModal';
import { MoveToModal } from '../modals/MoveToModal';
import { RenameModal } from '../modals/RenameModal';
import { NewItemModal } from '../modals/NewItemModal';
import { NewTaskModal } from '../modals/NewTaskModal';
import { SettingsModal } from '../modals/SettingsModal';
import { MediaViewerModal } from '../modals/MediaViewerModal';
import { NewWorkspaceModal } from '../modals/NewWorkspaceModal';


import { AIAssistant } from '../assistant/AIAssistant';
import { CommandPalette } from './CommandPalette';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { SmoothScroll } from './SmoothScroll';

export function Shell({ children }: { children: React.ReactNode }) {
  const theme = useStore(state => state.theme);
  const interfaceSize = useStore(state => state.interfaceSize);

  const modal = useStore(state => state.modal);
  const isSidebarCollapsed = useStore(state => state.isSidebarCollapsed);
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
  const toggleCommandPalette = useStore(state => state.toggleCommandPalette);
  const isInternalNavRef = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  // 1. Initial Hydration
  useEffect(() => {
    setHasHydrated(true);
  }, []);

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

  const sidebarWidth = useStore(state => state.sidebarWidth);
  const setSidebarWidth = useStore(state => state.setSidebarWidth);
  const aiSidebarWidth = useStore(state => state.aiSidebarWidth);
  const setAiSidebarWidth = useStore(state => state.setAiSidebarWidth);

  const isResizingLeftRef = useRef(false);
  const isResizingRightRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

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
          setAiSidebarWidth(Math.min(Math.max(window.innerWidth - e.clientX, 400), 800));
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

  const currentSidebarWidth = hasHydrated ? sidebarWidth : 280;
  const currentAiSidebarWidth = hasHydrated ? aiSidebarWidth : 400;

  const currentSidebarCollapsed = hasHydrated ? isSidebarCollapsed : false;
  const currentSidebarPinned = hasHydrated ? isSidebarPinned : true;

  return (
    <div 
      className={clsx(
        shellClass,
        "shell-container flex flex-row",
        currentSidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded",
        (isResizingLeft || isResizingRight) && "resizing-active"
      )}
      style={{ 
        ['--sidebar-w' as any]: currentSidebarCollapsed ? '64px' : `${currentSidebarWidth}px`,
        gridTemplateColumns: `${currentSidebarCollapsed ? '64px' : `${currentSidebarWidth}px`} 1fr`,
        transition: (isResizingLeft || isResizingRight) ? 'none' : 'grid-template-columns 300ms cubic-bezier(0.4, 0, 0.2, 1)'
      } as React.CSSProperties}
    >
      <SmoothScroll />
      {/* 1. Left Sidebar Section */}
      <div 
        className={clsx(
          "h-full overflow-hidden shrink-0 flex flex-row relative border-r border-[var(--bone-15)]",
          currentSidebarCollapsed ? "hidden md:flex" : "fixed inset-0 z-50 md:relative md:inset-auto md:flex"
        )}
        style={{ 
          width: currentSidebarCollapsed ? '64px' : `${currentSidebarWidth}px`,
          transition: (isResizingLeft || isResizingRight) ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1), border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {!currentSidebarCollapsed && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm md:hidden cursor-pointer" onClick={toggleSidebar} />
        )}
        <div className="relative h-full w-full">
          <Sidebar />
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
            className={clsx(
              "hidden md:block w-2 h-full cursor-col-resize absolute -right-1 top-0 z-50 transition-colors group",
              isResizingLeft ? "bg-accent/10" : ""
            )}
          >
            <div className={clsx(
              "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] transition-colors",
              isResizingLeft ? "bg-accent" : "bg-white/10 opacity-0 group-hover:opacity-100"
            )} />
          </div>
        )}
      </div>

      {/* 2. Main Content + Right AI Sidebar Wrapper */}
      <div className="flex-1 flex flex-row overflow-hidden relative min-w-0 h-full">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
          <HeaderBar />
          <main className="flex-1 flex flex-col overflow-hidden relative">
            {children}
          </main>
        </div>

        {/* Right Resizer Handle */}
        {isAIAssistantExtended && isAIAssistantOpen && (
          <div
            onMouseDown={() => {
              isResizingRightRef.current = true;
              setIsResizingRight(true);
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            className={clsx(
              "w-2 h-full cursor-col-resize absolute left-0 z-50 transition-colors group",
              isResizingRight ? "bg-accent/10" : ""
            )}
            style={{ 
              left: `calc(100% - ${currentAiSidebarWidth}px - 4px)`,
              pointerEvents: 'auto'
            }}
          >
            <div className={clsx(
              "absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] transition-all duration-300",
              isResizingRight ? "bg-accent opacity-100" : "bg-accent/30 opacity-0 group-hover:opacity-100"
            )} />
          </div>
        )}

        {/* Right AI Sidebar Wrapper */}
        <div 
          className={clsx(
            "h-full bg-sidebar shrink-0 overflow-hidden relative z-40",
            (!isAIAssistantExtended || !isAIAssistantOpen) && "w-0"
          )}
          style={{ 
            width: (isAIAssistantExtended && isAIAssistantOpen) ? `${currentAiSidebarWidth}px` : '0px',
            transition: (isResizingRight || isResizingLeft) ? 'none' : 'width 300ms cubic-bezier(0.4, 0, 0.2, 1), border-color 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <div className="h-full" style={{ width: `${currentAiSidebarWidth}px` }}> 
            {hasHydrated && isAIAssistantExtended && <AIAssistant />}
          </div>
        </div>
      </div>

      {/* Global overlays */}
      <ContextMenu />
      <NewCollectionModal key="new-collection" />
      <DeleteConfirmModal key={modal?.kind === 'deleteConfirm' ? modalKey : 'delete-none'} />
      <MoveToModal key={modal?.kind === 'moveTo' ? modalKey : 'move-none'} />
      <RenameModal key={modal?.kind === 'rename' ? modalKey : 'rename-none'} />
      <NewItemModal key={modal?.kind === 'newItem' ? modalKey : 'item-none'} />
      <NewTaskModal key="new-task" />
      <SettingsModal key="settings-modal" />
      <MediaViewerModal key="media-viewer" />
      <NewWorkspaceModal key="new-workspace" />
      <CommandPalette key="command-palette" />


      
      {/* Only render the floating assistant if we are NOT in sidebar mode */}
      {hasHydrated && !isAIAssistantExtended && (
        <AIAssistant key="ai-assistant-floating" isFloating />
      )}

    </div>
  );
}


