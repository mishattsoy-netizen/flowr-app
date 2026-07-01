"use client";

import { Entity, EntityType, useStore, generateId } from '@/data/store';
import { getDescendantIds } from '@/data/store.helpers';
import { getEntityIcon } from '@/data/icons';
import { ChevronRight, ChevronDown, FileText, Frame, Folder, Layers, Plus, MoreHorizontal, StarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { IconPicker } from './IconPicker';
import { Tooltip } from './Tooltip';
import { draggable, dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { disableNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview';
import { stripHtml } from '@/lib/utils';

// Global cursor tracker — updated by both the source draggable's onDrag
// (Chrome) and a window-level pointermove listener (Safari fallback).
// Safari doesn't reliably provide location.current.input in drop target
// callbacks, so drop targets read from this instead.
const dragCursor = { x: 0, y: 0, ready: false };

// Bind a window-level listener so dragCursor is always in sync regardless
// of pragmatic-dnd adapter quirks per browser.
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => {
    dragCursor.x = e.clientX;
    dragCursor.y = e.clientY;
    dragCursor.ready = true;
  }, { passive: true });

  window.addEventListener('dragstart', (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }, { capture: true });

  window.addEventListener('dragover', (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }, { capture: true });
}

const getRootAncestorId = (entityId: string, currentEntities: Entity[]): string => {
  const cleanId = entityId.startsWith('pinned-') ? entityId.replace('pinned-', '') : entityId;
  let cur = currentEntities.find(e => e.id === cleanId);
  while (cur && cur.parentId) {
    const pId = cur.parentId;
    const parent = currentEntities.find(p => p.id === pId);
    if (!parent) break;
    cur = parent;
  }
  return cur ? cur.id : cleanId;
};

export interface RedirectedResult {
  overId: string;
  edge: Edge | null;
  depth: number;
}

export function getRedirectedTarget(
  entities: Entity[],
  collapsedIds: string[],
  dragId: string,
  targetEntity: Entity,
  targetDepth: number,
  siblings: Entity[],
  edge: Edge | null
): RedirectedResult {
  if (edge !== 'top') {
    return { overId: targetEntity.id, edge, depth: targetDepth };
  }

  const idx = siblings.findIndex(e => e.id === targetEntity.id);
  if (idx <= 0) {
    return { overId: targetEntity.id, edge, depth: targetDepth };
  }

  const prev = siblings[idx - 1];
  const hasChildren = entities.some(e => e.parentId === prev.id);
  if (!hasChildren || collapsedIds.includes(prev.id)) {
    return { overId: targetEntity.id, edge, depth: targetDepth };
  }

  // Find deepest expanded descendant container
  let current = prev;
  let currentDepth = targetDepth; // prev is at same level as targetEntity visually, which is targetDepth

  const cleanDragId = (dragId && typeof dragId === 'string')
    ? (dragId.startsWith('pinned-') ? dragId.replace('pinned-', '') : dragId)
    : '';
  const dragItem = cleanDragId ? entities.find(e => e.id === cleanDragId) : undefined;

  while (true) {
    if (dragItem && current.id === dragItem.parentId) {
      break;
    }

    const children = entities
      .filter(e => e.parentId === current.id)
      .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
    if (children.length === 0) break;

    const lastChild = children[children.length - 1];
    const isLastChildFolder = lastChild.type === 'folder' || lastChild.type === 'collection' || lastChild.type === 'workspace';
    const isLastChildExpanded = isLastChildFolder && !collapsedIds.includes(lastChild.id);

    if (isLastChildExpanded) {
      current = lastChild;
      currentDepth++;
    } else {
      break;
    }
  }

  // Now current is the deepest expanded container
  const isNoOpNest = cleanDragId === current.id || (dragItem && dragItem.parentId === current.id);

  if (isNoOpNest) {
    // If nesting is a no-op (item is already in this container), redirect to bottom edge of this container (outdent 1 level)
    return {
      overId: current.id,
      edge: 'bottom',
      depth: currentDepth
    };
  } else {
    // Otherwise, nest inside
    return {
      overId: current.id,
      edge: null,
      depth: currentDepth + 1
    };
  }
}

/** Small spacer rendered after a folder's children list. When hovered during a
 *  tree-item drag it shows an edge line at the folder's depth to signal
 *  "insert after this folder at the parent level." The Sidebar's onDrop
 *  recognizes the isAfterFolder flag and forces edge='bottom' on the folder. */
function AfterFolderSpacer({ folderId, depth, workspaceId }: { folderId: string; depth: number; workspaceId?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);
  const [activeDepth, setActiveDepth] = useState(depth + 1);

  const getTargetConfig = useCallback((clientX: number | undefined, dragId: string | undefined, dragType: EntityType | undefined) => {
    const el = ref.current;
    if (!el) return { targetDepth: depth + 1, ancestor: undefined, isNoOp: false };

    const rect = el.getBoundingClientRect();
    const safeClientX = clientX !== undefined ? clientX : (dragCursor.ready ? dragCursor.x : 0);
    const localX = safeClientX - rect.left;
    const minDepth = (dragType === 'workspace' || dragType === 'collection') ? 0 : 1;
    
    let targetDepth = depth + 1;
    while (targetDepth > minDepth) {
      const levelStart = 8 + targetDepth * 18;
      if (localX < levelStart - 4) {
        targetDepth--;
      } else {
        break;
      }
    }

    const freshEntities = useStore.getState().entities;
    const hiddenEntityIds = useStore.getState().hiddenEntityIds;
    let ancestor: Entity | undefined = undefined;
    if (targetDepth <= depth) {
      ancestor = freshEntities.find(e => e.id === folderId);
      let ancestorDepth = depth;
      while (ancestor && ancestorDepth > targetDepth) {
        const parentId = ancestor.parentId;
        ancestor = parentId ? freshEntities.find(e => e.id === parentId) : undefined;
        ancestorDepth--;
      }
    }

    // Check no-op
    let isNoOp = false;
    const dragEntityId = (dragId && typeof dragId === 'string')
      ? (dragId.startsWith('pinned-') ? dragId.replace('pinned-', '') : dragId)
      : '';
    const dragEntity = dragEntityId ? freshEntities.find(e => e.id === dragEntityId) : undefined;

    if (dragEntity) {
      if (targetDepth === depth + 1) {
        if (dragEntity.parentId === folderId) {
          const children = freshEntities
            .filter(e => e.parentId === folderId)
            .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
          if (children.length > 0 && children[children.length - 1].id === dragEntityId) {
            isNoOp = true;
          }
        }
      } else if (ancestor) {
        if ((dragEntity.parentId || null) === (ancestor.parentId || null) && (dragEntity.workspaceId || 'ws-personal') === (ancestor.workspaceId || 'ws-personal')) {
          const siblings = freshEntities
            .filter(e => e.parentId === ancestor!.parentId && !hiddenEntityIds.includes(e.id))
            .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
          const dragIdx = siblings.findIndex(e => e.id === dragEntityId);
          const targetIdx = siblings.findIndex(e => e.id === ancestor!.id);
          if (dragIdx !== -1 && targetIdx !== -1 && targetIdx === dragIdx - 1) {
            isNoOp = true;
          }
        }
      }
    }

    return { targetDepth, ancestor, isNoOp };
  }, [depth, folderId]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        if (source.data.type !== 'tree-item' || source.data.id === folderId) return false;
        if (source.data.isPinned) return false;
        const dragId = source.data.id as string;
        const dragType = source.data.entityType as EntityType;
        const freshEntities = useStore.getState().entities;

        // Workspace Depth Restriction
        const isDragWS = dragType === 'workspace' || dragType === 'collection';
        if (isDragWS && depth > 0) return false;

        // Folder Descendant Drag Suppression
        const descendantIds = getDescendantIds(freshEntities, dragId);
        if (descendantIds.includes(folderId)) return false;

        return true;
      },
      getData: ({ input, source }) => {
        const dragId = source.data.id as string;
        const dragType = source.data.entityType as EntityType;
        const clientX = input?.clientX;
        const { targetDepth, ancestor, isNoOp } = getTargetConfig(clientX, dragId, dragType);

        if (isNoOp) {
          return {
            type: 'tree-item',
            id: folderId,
            edge: null,
            isAfterFolder: false,
            isInsertInsideBottom: false,
            visualEdge: null,
            visualDepth: targetDepth,
          };
        }

        if (targetDepth === depth + 1) {
          return {
            type: 'tree-item',
            id: folderId,
            edge: null,
            isAfterFolder: false,
            isInsertInsideBottom: true,
            visualEdge: 'bottom',
            visualDepth: depth + 1,
          };
        }

        if (ancestor) {
          return {
            type: 'tree-item',
            id: ancestor.id,
            edge: 'bottom',
            isAfterFolder: true,
            isInsertInsideBottom: false,
            visualEdge: 'bottom',
            visualDepth: targetDepth,
          };
        }

        return {
          type: 'tree-item',
          id: folderId,
          edge: null,
          isAfterFolder: false,
          isInsertInsideBottom: true,
          visualEdge: 'bottom',
          visualDepth: depth + 1,
        };
      },
      onDragEnter: ({ location, source }) => {
        const dragId = source.data.id as string;
        const dragType = source.data.entityType as EntityType;
        const clientX = location.current.input?.clientX;
        const { targetDepth, isNoOp } = getTargetConfig(clientX, dragId, dragType);
        
        setIsOver(!isNoOp);
        setActiveDepth(targetDepth);
      },
      onDrag: ({ location, source }) => {
        const dragId = source.data.id as string;
        const dragType = source.data.entityType as EntityType;
        const clientX = location.current.input?.clientX;
        const { targetDepth, isNoOp } = getTargetConfig(clientX, dragId, dragType);
        
        setIsOver(!isNoOp);
        setActiveDepth(targetDepth);
      },
      onDragLeave: () => {
        setIsOver(false);
      },
      onDrop: () => {
        setIsOver(false);
      },
    });
  }, [folderId, depth, getTargetConfig]);

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height: '0px', zIndex: 10 + depth }}
    >
      {/* Invisible expanded hit target for dragging */}
      <div
        className="absolute right-0 h-5 -top-2 bg-transparent z-10 sidebar-spacer-hit-target"
        style={{ left: '0px' }}
      />
      {isOver && (
        <div
          className="absolute h-px bg-[var(--bone-30)] pointer-events-none z-20 top-0"
          style={{
            left: `${8 + activeDepth * 18}px`,
            right: '3px',
          }}
        />
      )}
    </div>
  );
}

interface TreeItemProps {
  entity: Entity;
  depth: number;
  idOverride?: string;
  isDragOverlay?: boolean;
  disableNesting?: boolean;
  isMultiSelected?: boolean;
  onShiftClick?: (entityId: string, e: React.MouseEvent) => void;
  /** On the drag-overlay clone only: show an "unpin on drop" hint badge. */
  showUnpinHint?: boolean;
}

export const TreeItem = React.memo(function TreeItem({ entity, depth, idOverride, isDragOverlay, disableNesting, isMultiSelected, onShiftClick, showUnpinHint }: TreeItemProps) {
  const entities = useStore(state => state.entities);
  const activeEntityId = useStore(state => state.activeEntityId);
  const collapsedIds = useStore(state => state.collapsedIds);
  const favoriteIds = useStore(state => state.favoriteIds);
  const setActiveEntityId = useStore(state => state.setActiveEntityId);
  const toggleCollapsed = useStore(state => state.toggleCollapsed);
  const openModal = useStore(state => state.openModal);
  const openContextMenu = useStore(state => state.openContextMenu);
  const editingEntity = useStore(state => state.editingEntity);
  const setEditingEntityId = useStore(state => state.setEditingEntityId);
  const renameEntity = useStore(state => state.renameEntity);
  const addEntity = useStore(state => state.addEntity);
  const aiCursor = useStore(state => state.aiCursor);
  const contextMenu = useStore(state => state.contextMenu);
  const sidebarSectionSettings = useStore(state => state.sidebarSectionSettings);
  const hiddenEntityIds = useStore(state => state.hiddenEntityIds);

  const elementRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const getSortedSiblings = useCallback((targetEntity: Entity) => {
    const isWorkspaceOrCollection = (type: EntityType) => type === 'workspace' || type === 'collection';
    
    const getSectionId = (): 'workspaces' | 'unsorted' | null => {
      if (targetEntity.parentId && entities.some(p => p.id === targetEntity.parentId)) return null;
      return isWorkspaceOrCollection(targetEntity.type) ? 'workspaces' : 'unsorted';
    };

    const getSectionSiblings = () => {
      const sectionId = getSectionId();
      if (sectionId === 'workspaces') {
        return entities.filter(e => 
          (e.type === 'workspace' || e.type === 'collection') && 
          (!e.parentId || !entities.some(p => p.id === e.parentId)) &&
          (e.workspaceId || 'ws-personal') === (targetEntity.workspaceId || 'ws-personal') &&
          !hiddenEntityIds.includes(e.id)
        );
      }
      if (sectionId === 'unsorted') {
        return entities.filter(e => 
          (e.type === 'note' || e.type === 'canvas' || e.type === 'mixed') && 
          (!e.parentId || !entities.some(p => p.id === e.parentId)) &&
          (e.workspaceId || 'ws-personal') === (targetEntity.workspaceId || 'ws-personal') &&
          !hiddenEntityIds.includes(e.id)
        );
      }
      return entities.filter(e => e.parentId === targetEntity.parentId && !hiddenEntityIds.includes(e.id));
    };

    const sortSiblings = (items: Entity[]) => {
      const sectionId = getSectionId();
      if (!sectionId) {
        return [...items].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
      }
      const mode = sidebarSectionSettings?.[sectionId]?.sortMode || 'lastModified';
      if (mode === 'alphabetical') {
        return [...items].sort((a, b) => a.title.localeCompare(b.title));
      }
      if (mode === 'lastModified') {
        return [...items].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
      }
      return [...items].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
    };

    return sortSiblings(getSectionSiblings());
  }, [entities, sidebarSectionSettings, hiddenEntityIds]);

  const getPinnedSiblings = useCallback(() => {
    const isEntityVisible = (e: Entity) => {
      return (e.workspaceId || 'ws-personal') === (entity.workspaceId || 'ws-personal') && !hiddenEntityIds.includes(e.id);
    };
    const items = entities.filter(e => favoriteIds.includes(e.id) && isEntityVisible(e));
    const mode = sidebarSectionSettings?.pinned?.sortMode || 'lastModified';
    if (mode === 'alphabetical') {
      return [...items].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (mode === 'lastModified') {
      return [...items].sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
    }
    return [...items].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  }, [entities, favoriteIds, entity.workspaceId, hiddenEntityIds, sidebarSectionSettings]);

  const [isDraggingLocal, setIsDraggingLocal] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [dropDepth, setDropDepth] = useState<number>(depth);
  const [isOver, setIsOver] = useState(false);
  const edgeRef = useRef<Edge | null>(null);
  const [isNestingBlocked, setIsNestingBlocked] = useState(false);


  const myId = idOverride || entity.id;
  const isFolder = entity.type === 'folder' || entity.type === 'collection' || entity.type === 'workspace';
  const isFolderDropTarget = isOver && isFolder && closestEdge === null && !isNestingBlocked;

  // Render ghost preview portal using createPortal
  const [preview, setPreview] = useState<boolean>(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || isDragOverlay) return;

    // Set cursor to grabbing immediately on native dragstart — before
    // pragmatic-dnd's lifecycle fires — so the browser never shows the
    // default copy/green-plus cursor.
    const handleDragStart = (e: DragEvent) => {
      e.dataTransfer!.effectAllowed = 'move';
      e.dataTransfer!.dropEffect = 'move';
      document.body.style.cursor = 'grabbing';
    };
    el.addEventListener('dragstart', handleDragStart, { capture: true });

    const cleanup = draggable({
      element: el,
      getInitialData: () => ({
        type: 'tree-item',
        id: myId,
        parentId: entity.parentId,
        workspaceId: entity.workspaceId,
        entityType: entity.type,
        isPinned: idOverride?.startsWith('pinned-') || false,
        depth: depth,
      }),
      onGenerateDragPreview: ({ nativeSetDragImage, source, location }) => {
        disableNativeDragPreview({ nativeSetDragImage });
        setPreview(true);
      },
      onDrag: ({ location }) => {
        const node = previewRef.current;
        if (!node) return;
        // The centering wrapper inside the portal offsets by -50%,
        // so positioning the outer wrapper's top-left at the cursor
        // keeps the preview centered on it.
        node.style.transform = `translate(${location.current.input.clientX}px, ${location.current.input.clientY}px)`;
        // Keep the global cursor tracker updated for Safari fallback
        dragCursor.x = location.current.input.clientX;
        dragCursor.y = location.current.input.clientY;
      },
      onDragStart: () => {
        setIsDraggingLocal(true);
        setPreview(true);
      },
      onDrop: () => {
        setIsDraggingLocal(false);
        setPreview(false);
      },
    });

    return () => {
      el.removeEventListener('dragstart', handleDragStart, { capture: true } as EventListenerOptions);
      cleanup();
    };
  }, [myId, entity.parentId, entity.workspaceId, idOverride, isDragOverlay, depth]);

  // Drop target is on the row div only (not the wrapper that includes children),
  // so the gap below an item's children doesn't get caught by the parent's drop
  // target — hover must be on a specific item's row to see edge zone lines.
  useEffect(() => {
    const el = rowRef.current;
    if (!el || isDragOverlay) return;

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        if (source.data.type !== 'tree-item') return false;
        const dragDepth = source.data.depth as number | undefined;
        const dragWsId = source.data.workspaceId as string | undefined;
        const sameWorkspace = (dragWsId || 'ws-personal') === (entity.workspaceId || 'ws-personal');
        const dragId = source.data.id as string;

        const dragRootId = getRootAncestorId(dragId, entities);
        const targetRootId = getRootAncestorId(entity.id, entities);
        const sameFolderTree = dragRootId === targetRootId;

        // Workspace Depth Restriction
        const dragType = source.data.entityType as EntityType;
        const isDragWS = dragType === 'workspace' || dragType === 'collection';
        if (isDragWS && depth > 0) return false;

        // Workspace/collection targets for regular items are handled by isRegularOnWorkspace
        // logic in getData — skip depth constraint so getData can compute the right redirect.
        const isTargetWorkspaceRow = depth === 0 && (entity.type === 'workspace' || entity.type === 'collection');
        const isDragWorkspace = source.data.entityType === 'workspace' || source.data.entityType === 'collection';
        if (isTargetWorkspaceRow && !isDragWorkspace) {
          return true;
        }

        if (dragDepth !== undefined && sameWorkspace && sameFolderTree) {
          if (depth < dragDepth - 2) {
            return false;
          }
        }
        return true;
      },
      getData: ({ input, element, source }) => {
        const rect = element.getBoundingClientRect();
        const clientY = input.clientY || (dragCursor.ready ? dragCursor.y : 0);
        const dragId = source.data.id as string;
        const dragEntityId = dragId.startsWith('pinned-') ? dragId.replace('pinned-', '') : dragId;
        const dragEntity = entities.find(e => e.id === dragEntityId);
        const isDraggingWorkspace = dragEntity?.type === 'workspace' || dragEntity?.type === 'collection';

        const isTargetDescendant = dragEntityId ? getDescendantIds(entities, dragEntityId).includes(entity.id) : false;
        const canInsertIn =
          isFolder &&
          !disableNesting &&
          !isDraggingWorkspace &&
          dragEntityId !== myId &&
          !isTargetDescendant;

        const hasChildren = entities.some(e => e.parentId === entity.id);
        const isPinned = idOverride?.startsWith('pinned-');
        const isCollapsible = hasChildren && !isPinned && !disableNesting;
        const isCollapsed = collapsedIds.includes(entity.id);
        const isExpanded = isCollapsible && !isCollapsed;

        let edge: Edge | null = null;
        const isTargetWorkspace = depth === 0 && (entity.type === 'workspace' || entity.type === 'collection');
        const isDragWorkspace = dragEntity?.type === 'workspace' || dragEntity?.type === 'collection';
        const isRegularOnWorkspace = isTargetWorkspace && !isDragWorkspace;

        if (isRegularOnWorkspace) {
          const threshold = rect.height * 0.5;
          const isTopHover = clientY < rect.top + threshold;

          if (isTopHover) {
            const siblings = getSortedSiblings(entity);
            const idx = siblings.findIndex(e => e.id === entity.id);
            if (idx > 0) {
              const prev = siblings[idx - 1];
              const hasChildren = entities.some(e => e.parentId === prev.id);
              const isCollapsed = collapsedIds.includes(prev.id);
              if (hasChildren && !isCollapsed) {
                edge = 'top';
              } else {
                edge = null;
              }
            } else {
              edge = null;
            }
          } else {
            edge = null;
          }
        } else if (canInsertIn) {
          // Folders/collections/workspaces: top 30%=reorder above,
          // middle 40%/70%=nest inside (null), bottom 30%=reorder below.
          const threshold = rect.height * 0.3;
          if (clientY < rect.top + threshold) {
            edge = 'top';
          } else if (clientY > rect.bottom - threshold) {
            edge = 'bottom';
          } else {
            edge = null;
          }
        } else {
          edge = clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
        }

        // Apply Top-edge redirect BEFORE checking depth constraint and no-ops
        let redirectedId = myId;
        let redirectedEntity = entity;
        let redirectedDepth = depth;
        let originalEdge = edge;

        if (edge === 'top' && !isDraggingWorkspace) {
          const siblings = getSortedSiblings(entity);
          const redirected = getRedirectedTarget(
            entities,
            collapsedIds,
            dragId,
            entity,
            depth,
            siblings,
            edge
          );
          redirectedId = redirected.overId;
          const cleanRedirectedId = redirectedId.startsWith('pinned-') ? redirectedId.replace('pinned-', '') : redirectedId;
          redirectedEntity = entities.find(e => e.id === cleanRedirectedId) || entity;
          edge = redirected.edge;
          redirectedDepth = redirected.depth;
        }

        if (edge === 'bottom' && isFolder && isExpanded) {
          const folderChildren = entities
            .filter(e => e.parentId === entity.id && !hiddenEntityIds.includes(e.id))
            .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
          if (folderChildren.length > 0) {
            const firstChild = folderChildren[0];
            redirectedId = firstChild.id;
            redirectedEntity = firstChild;
            edge = 'top';
            redirectedDepth = depth + 1;
          } else {
            edge = null;
          }
        }

        const dragDepth = source.data.depth as number | undefined;
        const dragWsId = source.data.workspaceId as string | undefined;
        const sameWs = (dragWsId || 'ws-personal') === (redirectedEntity.workspaceId || 'ws-personal');
        const dragRootId = getRootAncestorId(dragId, entities);
        const targetRootId = getRootAncestorId(redirectedEntity.id, entities);
        const sameFolderTree = dragRootId === targetRootId;

        if (dragDepth !== undefined && sameWs && sameFolderTree) {
          if (edge !== null && redirectedDepth < dragDepth - 1) {
            edge = null;
          }
        }

        const targetEntityId = redirectedId.startsWith('pinned-') ? redirectedId.replace('pinned-', '') : redirectedId;
        const isTargetDescendantResolved = dragEntityId ? getDescendantIds(entities, dragEntityId).includes(targetEntityId) : false;

        // Suppress visual lines on no-op drops
        if (edge !== null) {
          const isPinnedDrag = source.data.isPinned as boolean;
          const isTargetPinned = idOverride?.startsWith('pinned-') || false;

          if (dragEntityId === targetEntityId || isTargetDescendantResolved) {
            edge = null;
          } else if (isPinnedDrag && !isTargetPinned) {
            edge = null; // Dragging pinned item outside pinned section only unpins it; show no insert lines.
          } else if (isPinnedDrag && isTargetPinned) {
            const siblings = getPinnedSiblings();
            const dragIdx = siblings.findIndex(e => e.id === dragId.replace('pinned-', ''));
            const targetIdx = siblings.findIndex(e => e.id === redirectedId.replace('pinned-', ''));
            if (dragIdx !== -1 && targetIdx !== -1) {
              if (targetIdx === dragIdx - 1 && edge === 'bottom') {
                edge = null;
              } else if (targetIdx === dragIdx + 1 && edge === 'top') {
                edge = null;
              }
            }
          } else if (!isPinnedDrag && isTargetPinned) {
            // Dragging a normal item into the pinned section
            if (favoriteIds.includes(dragEntityId)) {
              // It is already pinned, so it's a reorder inside the pinned section
              const siblings = getPinnedSiblings();
              const dragIdx = siblings.findIndex(e => e.id === dragEntityId);
              const targetIdx = siblings.findIndex(e => e.id === targetEntityId);
              if (dragIdx !== -1 && targetIdx !== -1) {
                if (targetIdx === dragIdx - 1 && edge === 'bottom') {
                  edge = null;
                } else if (targetIdx === dragIdx + 1 && edge === 'top') {
                  edge = null;
                }
              }
            }
          } else if (dragEntity) {
            const isWorkspaceOrCollection = (type: EntityType) => type === 'workspace' || type === 'collection';
            const isDragWS = isWorkspaceOrCollection(dragEntity.type);
            const isTargetWS = isWorkspaceOrCollection(redirectedEntity.type);

            const siblings = getSortedSiblings(redirectedEntity);
            const idx = siblings.findIndex(e => e.id === redirectedEntity.id);
            const prev = idx > 0 ? siblings[idx - 1] : null;
            const isPrevExpanded = prev && entities.some(e => e.parentId === prev.id) && !collapsedIds.includes(prev.id);
            const isTopRedirect = edge === 'top' && isPrevExpanded;

            if (isDragWS !== isTargetWS && !isTopRedirect) {
              edge = null; // Cannot reorder workspaces relative to regular items/folders
            } else if (isDragWS === isTargetWS && (dragEntity.parentId || null) === (redirectedEntity.parentId || null) && (dragEntity.workspaceId || 'ws-personal') === (redirectedEntity.workspaceId || 'ws-personal')) {
              const siblingsList = getSortedSiblings(redirectedEntity);
              const dragIdx = siblingsList.findIndex(e => e.id === dragEntityId);
              const targetIdx = siblingsList.findIndex(e => e.id === redirectedEntity.id);
              if (dragIdx !== -1 && targetIdx !== -1) {
                if (targetIdx === dragIdx - 1 && edge === 'bottom') {
                  edge = null;
                } else if (targetIdx === dragIdx + 1 && edge === 'top') {
                  edge = null;
                }
              }
            }

            // Parent container check: if the target is the parent of the dragged item,
            // and we are inserting at the bottom (edge === 'bottom'), and the dragged item
            // is already the last child of this parent, it's a no-op.
            if (edge === 'bottom' && dragEntity.parentId === redirectedEntity.id) {
              const siblingsList = getSortedSiblings(dragEntity);
              const cleanDragId = dragId.replace('pinned-', '');
              if (siblingsList.length > 0 && siblingsList[siblingsList.length - 1].id === cleanDragId) {
                edge = null;
              }
            }
          }
        }

        let isBlockNesting = false;
        if (isDraggingWorkspace) {
          isBlockNesting = true;
        } else if (dragEntityId === targetEntityId || isTargetDescendantResolved) {
          isBlockNesting = true;
        } else if (edge === null && dragDepth !== undefined && sameWs && sameFolderTree) {
          const isTargetFolder = redirectedEntity.type === 'folder' || redirectedEntity.type === 'collection' || redirectedEntity.type === 'workspace';
          if (!isTargetFolder || (redirectedDepth + 1 < dragDepth - 1)) {
            isBlockNesting = true;
          }
        }

        return {
          type: 'tree-item',
          id: redirectedId,
          edge,
          visualEdge: originalEdge,
          visualDepth: redirectedDepth,
          isBlockNesting,
        };
      },
      onDragEnter: ({ self }) => {
        setIsOver(true);
        const edge = self.data.edge === null ? null : (self.data.visualEdge !== undefined ? self.data.visualEdge : self.data.edge) as Edge | null;
        setClosestEdge(edge);
        edgeRef.current = edge;
        setDropDepth(self.data.visualDepth !== undefined ? (self.data.visualDepth as number) : depth);
        setIsNestingBlocked(self.data.isBlockNesting === true);
      },
      onDrag: ({ self }) => {
        const edge = self.data.edge === null ? null : (self.data.visualEdge !== undefined ? self.data.visualEdge : self.data.edge) as Edge | null;
        if (edge !== edgeRef.current) {
          setClosestEdge(edge);
          edgeRef.current = edge;
        }
        setDropDepth(self.data.visualDepth !== undefined ? (self.data.visualDepth as number) : depth);
        setIsNestingBlocked(self.data.isBlockNesting === true);
      },
      onDragLeave: () => {
        setIsOver(false);
        edgeRef.current = null;
        setClosestEdge(null);
        setDropDepth(depth);
        setIsNestingBlocked(false);
      },
      onDrop: () => {
        setIsOver(false);
        edgeRef.current = null;
        setClosestEdge(null);
        setDropDepth(depth);
        setIsNestingBlocked(false);
      },
    });
  }, [myId, isFolder, isDragOverlay, entities, collapsedIds, idOverride, disableNesting, getSortedSiblings, getPinnedSiblings]);

  const style = {
    zIndex: isDraggingLocal ? 1000 : (isDragOverlay ? 2000 : undefined),
    position: 'relative' as const,
    opacity: isDraggingLocal && !isDragOverlay ? 0.4 : undefined,
  };

  const [tempTitle, setTempTitle] = React.useState(entity.title);
  const [iconPickerAnchor, setIconPickerAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [plusPopupPos, setPlusPopupPos] = useState<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = editingEntity?.id === entity.id && editingEntity?.source === 'sidebar';

  React.useEffect(() => {
    if (isEditing) {
      setTempTitle(entity.title);
    }
  }, [isEditing, entity.title]);

  const handleRename = () => {
    if (tempTitle.trim() && tempTitle !== entity.title) {
      renameEntity(entity.id, tempTitle.trim());
    } else {
      setEditingEntityId(null);
    }
  };

  React.useEffect(() => {
    if (isEditing && textareaRef.current) {
      const target = textareaRef.current;
      target.style.height = '18px';
      target.style.height = `${Math.min(target.scrollHeight, 40)}px`;
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') setEditingEntityId(null);
  };

  const isDescendantActive = (parentId: string): boolean => {
    if (!activeEntityId) return false;
    let current = entities.find(e => e.id === activeEntityId);
    while (current?.parentId) {
      if (current.parentId === parentId) return true;
      const nextId = current.parentId;
      current = entities.find(e => e.id === nextId);
    }
    return false;
  };

  const isChildActive = isDescendantActive(entity.id);
  const children = entities
    .filter(e => e.parentId === entity.id)
    .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  const hasChildren = children.length > 0;
  const isPinned = idOverride?.startsWith('pinned-');
  const isCollapsible = hasChildren && !isPinned && !disableNesting;
  const isCollapsed = collapsedIds.includes(entity.id);
  const isActive = activeEntityId === entity.id;

  const selectedSidebarIds = useStore(state => state.selectedSidebarIds);
  const clearSelectedSidebarIds = useStore(state => state.clearSelectedSidebarIds);
  const effectiveMultiSelected = isMultiSelected || selectedSidebarIds.includes(entity.id);



  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey && onShiftClick) {
      e.preventDefault();
      onShiftClick(entity.id, e);
      return;
    }
    // Clear multi-select on any non-shift click
    clearSelectedSidebarIds();
    setActiveEntityId(entity.id);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleCollapsed(entity.id);
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPlusPopupPos({ x: rect.left, y: rect.bottom + 4 });
  };

  const handleOptionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openContextMenu(entity.id, rect.right + 4, rect.top, 'sidebar');
  };

  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (entity.type !== 'collection' && entity.type !== 'workspace') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setIconPickerAnchor({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
  }, [entity.type]);

  const closeIconPicker = useCallback(() => {
    setIconPickerAnchor(null);
  }, []);

  const getIcon = (type: EntityType) => {
    const size = "w-3.5 h-3.5";
    const cls = `${size} shrink-0 `;

    const iconColorClass = "text-inherit";

    if (type === 'collection' || type === 'workspace' || type === 'folder') {
      const FolderIcon = (type === 'collection' || type === 'workspace') ? getEntityIcon(entity.icon) : Folder;

      const mainIcon = (
        <div
          className={cn(
            "flex items-center justify-center",
            isCollapsible && !isDraggingLocal && "group-hover:opacity-0"
          )}
        >
          <FolderIcon strokeWidth={2} className={cn(cls, iconColorClass)} />
        </div>
      );

      return (
        <div className="relative flex items-center justify-center w-3.5 h-3.5">
          {mainIcon}

          {isCollapsible && (
            <button
              onClick={handleChevronClick}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "sidebar-actions absolute btn-sidebar-utility opacity-0",
                !isDraggingLocal && "group-hover:opacity-100"
              )}
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            >
              {isCollapsed
                ? <ChevronRight strokeWidth={2} className="w-3.5 h-3.5" />
                : <ChevronDown strokeWidth={2} className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      );
    }

    const isTargeted = aiCursor?.id === entity.id;
    const typingIndicator = isTargeted && (aiCursor?.type === 'writing' || aiCursor?.type === 'generating_image');
    const presenceBadge = isTargeted && (
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full border border-background" />
    );

    switch (type) {
      case 'note': return <FileText strokeWidth={2} className={cn(cls, iconColorClass)} />;
      case 'canvas': return <Frame strokeWidth={2} className={cn(cls, iconColorClass)} />;
      case 'mixed': return <Layers strokeWidth={2} className={cn(cls, iconColorClass)} />;
    }
  };


  const isWorkspace = depth === 0 && (entity.type === 'workspace' || entity.type === 'collection');
  const isExpanded = isCollapsible && !isCollapsed;
  const blockActive = isActive || isChildActive;

  return (
    <div
      ref={elementRef}
      style={style}
      className={cn(
        isWorkspace && "rounded-[var(--radius-small)] ",
        isWorkspace && isExpanded && "group/workspace",
        "relative group/treeitem"
      )}
    >
      <div
        ref={rowRef}
        onClick={handleClick}
        data-selected={isActive || undefined}
        className={cn(
          "sidebar-item-row group relative flex w-full select-none",
          isEditing ? "items-start pt-[5px]" : "items-center h-7",
          "px-3 rounded-[var(--radius-small)]",
          "border-t border-x border-solid border-transparent bg-clip-padding",
          effectiveMultiSelected
            ? isDraggingLocal
              ? "bg-[var(--app-dark)] text-[var(--bone-70)]"
              : "bg-[var(--app-dark)] text-[var(--bone-70)] hover:text-[var(--bone-100)]"
            : isActive
              ? "!bg-dark text-[var(--bone-100)] font-normal"
              : isDraggingLocal
                ? "text-[var(--bone-70)] bg-transparent"
                : "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]",
          isWorkspace && !isActive && !isDraggingLocal && "group-hover/workspace:text-[var(--bone-100)]",
          isFolderDropTarget && "sidebar-folder-drop-target",
          "text-[14px]",
        )}
        style={{ paddingLeft: `${8 + depth * 18}px`, paddingRight: '3px' }}
      >
        <div className={cn(
          "w-[14px] shrink-0 flex items-center justify-center text-[var(--bone-100)]",
          isActive
            ? "opacity-100"
            : isDraggingLocal
              ? "opacity-70"
              : "opacity-70 group-hover:opacity-100"
        )}>
          {(!disableNesting && isCollapsible) ? getIcon(entity.type) : getIcon(entity.type)}
        </div>

        {isEditing ? (
          <textarea
            ref={textareaRef}
            autoFocus
            rows={1}
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleRename();
              }
              if (e.key === 'Escape') setEditingEntityId(null);
            }}
            onClick={(e) => e.stopPropagation()}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = '18px';
              target.style.height = `${Math.min(target.scrollHeight, 40)}px`;
            }}
            className="ml-[6px] flex-1 min-w-0 bg-transparent outline-none text-[var(--foreground)] border-none p-0 text-[13px] leading-snug resize-none overflow-hidden break-words whitespace-pre-wrap w-full"
          />
        ) : (
          <span className={cn(
            "ml-[6px] flex-1 text-left truncate leading-snug",
            isActive ? "text-[var(--bone-100)]" : "text-[var(--bone-70)] group-hover:text-[var(--bone-100)]"
          )}>
            {stripHtml(entity.title)}
          </span>
        )}

        <div className={cn(
          "sidebar-actions flex items-center gap-[1px] shrink-0",
          contextMenu?.entityId === entity.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {(entity.type === 'workspace' || entity.type === 'collection' || entity.type === 'folder') && (
            <button
              onClick={handlePlusClick}
              className={cn(
                "btn-sidebar-utility",
                plusPopupPos && isActive && "!bg-[var(--app-dark)] !text-[var(--bone-100)] !opacity-100"
              )}
            >
              <Plus strokeWidth={2} className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleOptionsClick}
            className={cn(
              "btn-sidebar-utility",
              contextMenu?.entityId === entity.id && "!bg-[var(--app-dark)] !text-[var(--bone-100)] !opacity-100"
            )}
          >
            <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
          </button>
        </div>

        {isOver && closestEdge && (
          <div
            className={cn(
              "absolute h-px bg-[var(--bone-30)] pointer-events-none z-10",
              closestEdge === 'top' ? '-top-px' : '-bottom-px'
            )}
            style={{
              left: `${8 + dropDepth * 18}px`,
              right: '3px'
            }}
          />
        )}
      </div>

      {/* Overlay-clone only: dragging a pinned item outside the pinned section
          will unpin it on drop (it never moves the real entity). Surface that. */}
      {isDragOverlay && showUnpinHint && (
        <div className="absolute -right-1 -top-2 z-20 flex items-center gap-1 rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md pointer-events-none">
          <StarOff strokeWidth={2.5} className="w-3 h-3" />
          <span>Unpin</span>
        </div>
      )}

      {iconPickerAnchor && (
        <IconPicker
          entityId={entity.id}
          anchorRect={iconPickerAnchor}
          onClose={closeIconPicker}
        />
      )}

      {children.length > 0 && !isPinned && !disableNesting && (
        <div
          className={cn(
            "grid transition-all duration-100 ease-out",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="relative flex flex-col">
              {children.map((child) => (
                <TreeItem
                  key={idOverride ? `${idOverride.split('-')[0]}-${child.id}` : child.id}
                  entity={child}
                  depth={depth + 1}
                  idOverride={idOverride ? `${idOverride.split('-')[0]}-${child.id}` : undefined}
                  onShiftClick={onShiftClick}
                />
              ))}
              {/* Hierarchy Line */}
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-[var(--bone-15)] pointer-events-none"
                style={{ left: `${8 + depth * 18 + 6}px` }}
              />
            </div>
          </div>
        </div>
      )}
      {isFolder && children.length > 0 && !!isExpanded && (
        <AfterFolderSpacer folderId={entity.id} depth={depth} workspaceId={entity.workspaceId} />
      )}
      {plusPopupPos && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={(e) => { e.stopPropagation(); setPlusPopupPos(null); }} />
          <div
            className="fixed z-[300] popup-glass-small min-w-[160px] p-1 flex flex-col gap-[2px]"
            style={{ left: plusPopupPos.x, top: plusPopupPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { type: 'note' as const, label: 'Note', icon: FileText },
              { type: 'canvas' as const, label: 'Canvas', icon: Frame },
            ].map(opt => (
              <button
                key={opt.type}
                onClick={() => {
                  const newId = generateId();
                  addEntity({
                    id: newId,
                    title: `Untitled ${opt.label}`,
                    type: opt.type,
                    parentId: entity.id,
                    lastModified: Date.now()
                  });
                  setActiveEntityId(newId);
                  setPlusPopupPos(null);
                }}
                className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
              >
                <opt.icon strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-70)] group-hover:text-[var(--bone-100)]" />
                <span className="flex-1 text-left font-medium tracking-wide">{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {preview &&
        createPortal(
          <div
            ref={previewRef}
            className="fixed top-0 left-0 z-[10000] pointer-events-none"
            style={{ transform: 'translate(-9999px, -9999px)' }}
          >
            {/* Centering wrapper offsets the preview so its center is at
                the cursor position set by the parent's JS transform */}
            <div className="-translate-x-1/2 -translate-y-1/2">
              <div className="w-[240px] bg-sidebar rounded-[var(--radius-small)] opacity-85 shadow-lg border border-[var(--bone-10)]">
                <TreeItem
                  entity={entity}
                  depth={0}
                  isDragOverlay
                  disableNesting
                  showUnpinHint={showUnpinHint}
                />
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
});


