"use client";

import { useStore } from '@/data/store';
import { Dashboard } from './dashboard/Dashboard';
import { NotePage } from './editor/NotePage';
import { CanvasPage } from './canvas/CanvasPage';
import { FolderView } from './folder/FolderView';
import { SpacePage } from './workspace/SpacePage';
import { TrackerPage } from './tracker/TrackerPage';
import ChatPage from './chat/ChatPage';
import { SettingsPage } from './settings/SettingsPage';
import { DashboardSkeleton } from './dashboard/DashboardSkeleton';
import { ChatMainSkeleton } from './chat/ChatSkeleton';
import { TrackerSkeleton } from './tracker/TrackerSkeleton';

import { useEffect, useState } from 'react';

/**
 * Renders the appropriate page component for a given entity ID.
 * Used by both WorkspaceRouter (single-column) and SplitViewLayout (two-column).
 */
export function EntityPageRenderer({ entityId }: { entityId: string }) {
  const entities = useStore(state => state.entities);
  const [isMounted, setIsMounted] = useState(false);
  const [storeHydrated, setStoreHydrated] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    if (useStore.persist.hasHydrated()) {
      setStoreHydrated(true);
    } else {
      const unsub = useStore.persist.onFinishHydration(() => {
        setStoreHydrated(true);
        unsub();
      });
      return unsub;
    }
  }, []);

  const hasHydrated = isMounted && storeHydrated;

  if (!hasHydrated) {
    if (entityId === 'chat') return <ChatMainSkeleton />;
    if (entityId === 'tracker') return <TrackerSkeleton />;
    return <DashboardSkeleton />;
  }

  if (entityId === 'dashboard') {
    return <Dashboard />;
  }

  if (entityId === 'tracker') {
    return <TrackerPage />;
  }

  if (entityId === 'chat') {
    return <ChatPage />;
  }

  if (entityId === 'settings') {
    return <SettingsPage />;
  }

  const entity = entities.find(e => e.id === entityId);

  if (!entity) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select an item from the sidebar.
      </div>
    );
  }

  switch (entity.type) {
    case 'note':
      return <NotePage entity={entity} />;
    case 'canvas':
      return <CanvasPage entity={entity} />;
    case 'workspace':
      return <SpacePage entity={entity} />;
    case 'folder':
      return <FolderView entity={entity} />;
    default:
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Unsupported view.
        </div>
      );
  }
}

export default EntityPageRenderer;
