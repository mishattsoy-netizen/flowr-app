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

import { ChatMainSkeleton } from './chat/ChatSkeleton';
import { TrackerSkeleton } from './tracker/TrackerSkeleton';
import { NoteSkeleton } from './editor/NoteSkeleton';

import { useAppReady } from '@/hooks/useAppReady';


/**
 * Renders the appropriate page component for a given entity ID.
 * Used by both WorkspaceRouter (single-column) and SplitViewLayout (two-column).
 */
export function EntityPageRenderer({ entityId }: { entityId: string }) {
  const entities = useStore(state => state.entities);
  const { isReady, storeHydrated } = useAppReady();

  // Determine entity based on either state or persist data if possible
  const entity = storeHydrated ? entities.find(e => e.id === entityId) : undefined;
  
  const isLoading = !isReady;

  if (entityId === 'dashboard') {
    return <Dashboard isLoading={isLoading} />;
  }

  if (entityId === 'tracker') {
    return <TrackerPage isLoading={isLoading} />;
  }

  if (entityId === 'chat') {
    return <ChatPage isLoading={isLoading} />;
  }

  if (entityId === 'settings') {
    return <SettingsPage />;
  }

  if (!entity) {
    if (!storeHydrated) {
      // We don't know what this entity is yet because the store hasn't
      // loaded from storage — show a content skeleton, not the "missing"
      // empty-state message. This is NOT the same case as below.
      return <NoteSkeleton />;
    }
    // Store IS hydrated and we still can't find this entity — it genuinely
    // doesn't exist (deleted, bad id, etc).
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Select an item from the sidebar.
      </div>
    );
  }

  switch (entity.type) {
    case 'note':
      return <NotePage entity={entity} isLoading={isLoading} />;
    case 'canvas':
      return <CanvasPage entity={entity} />;
    case 'workspace':
      return <SpacePage entity={entity} isLoading={isLoading} />;
    case 'folder':
      return <FolderView entity={entity} isLoading={isLoading} />;
    default:
      return (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Unsupported view.
        </div>
      );
  }
}

export default EntityPageRenderer;
