"use client";

import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/data/store';
import { cn } from '@/lib/utils';
import {
  Brain, ChevronDown, FileText, Frame, Zap, ChevronRight, Plus, MoreHorizontal,
  Edit2, Copy, Columns2, Trash2, Palette, type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { getEntityIcon, ICON_MAP, type IconName } from '@/data/icons';
import { useBrainData, authHeaders, type BrainCanvasNode } from './useBrainData';
import { CARD_W, CARD_H } from './BrainNodeCard';

type MenuKind =
  | { type: 'node'; brainId: string; node: BrainCanvasNode }
  | { type: 'brain'; brainId: string; title: string; isCollapsed: boolean };

type RenameTarget =
  | { kind: 'node'; brainId: string; nodeId: string; entityId: string | null; isMemory: boolean }
  | { kind: 'brain'; brainId: string };

function uniqueNewNoteTitle(existingTitles: string[]): string {
  const set = new Set(existingTitles.map(t => t.trim().toLowerCase()));
  if (!set.has('new note')) return 'New Note';
  let n = 2;
  while (set.has(`new note ${n}`)) n++;
  return `New Note ${n}`;
}

const BRAIN_ICON_PICKS: IconName[] = [
  'Brain', 'Folder', 'Sparkles', 'Zap', 'Target', 'BookOpen', 'Lightbulb', 'Star', 'Rocket', 'Compass',
];

export function BrainSidebarContent() {
  const setActiveEntityId = useStore(s => s.setActiveEntityId);
  const setActiveBrainId = useStore(s => s.setActiveBrainId);
  const activeBrainId = useStore(s => s.activeBrainId);
  const openBrainNode = useStore(s => s.openBrainNode);
  const entities = useStore(s => s.entities);
  const addEntity = useStore(s => s.addEntity);
  const renameEntity = useStore(s => s.renameEntity);
  const duplicateEntity = useStore(s => s.duplicateEntity);
  const { state, selectedBrainId, setSelectedBrainId, mutate } = useBrainData();

  const brains = state?.brains ?? [];

  const [nodesByBrain, setNodesByBrain] = useState<Record<string, BrainCanvasNode[]>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  const fetchBrainNodes = useCallback(async (brainId: string) => {
    if (fetchingRef.current.has(brainId)) return;
    fetchingRef.current.add(brainId);
    try {
      const res = await fetch(`/api/ai/user-brain?brain_id=${brainId}&nodes_only=true`, { headers: await authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNodesByBrain(prev => ({ ...prev, [brainId]: (data.nodes ?? []).filter((n: BrainCanvasNode) => n.type !== 'section') }));
      }
    } finally {
      fetchingRef.current.delete(brainId);
    }
  }, []);

  // collapsedBrains[id] === false → expanded; missing/true → collapsed
  // Seed the last-opened brain as already expanded so remounting the brain
  // sidebar never animates closed → open.
  const [collapsedBrains, setCollapsedBrains] = useState<Record<string, boolean>>(() =>
    (activeBrainId || selectedBrainId)
      ? { [activeBrainId || selectedBrainId!]: false }
      : {},
  );

  const expandBrain = useCallback((brainId: string) => {
    setCollapsedBrains(prev => (prev[brainId] === false ? prev : { ...prev, [brainId]: false }));
    fetchBrainNodes(brainId);
  }, [fetchBrainNodes]);

  // Layout (not effect) so expand lands before paint — no unfold flash.
  useLayoutEffect(() => {
    if (brains.length === 0) return;
    const defaultBrain = brains.find(b => b.is_default);
    const lastId = selectedBrainId || activeBrainId || defaultBrain?.id;
    if (!lastId) return;
    // Prefer last-opened, else default/main brain.
    if (!activeBrainId || !brains.some(b => b.id === activeBrainId)) {
      setActiveBrainId(lastId);
    }
    if (selectedBrainId !== lastId && !selectedBrainId) {
      setSelectedBrainId(lastId);
    }
    expandBrain(lastId);
  }, [brains, selectedBrainId, activeBrainId, expandBrain, setActiveBrainId, setSelectedBrainId]);

  useEffect(() => {
    if (selectedBrainId && collapsedBrains[selectedBrainId] === false) {
      fetchBrainNodes(selectedBrainId);
    }
  }, [selectedBrainId, state?.nodes, collapsedBrains, fetchBrainNodes]);

  // When selected brain's nodes reload from useBrainData, mirror into cache
  useEffect(() => {
    if (selectedBrainId && state?.nodes) {
      setNodesByBrain(prev => ({
        ...prev,
        [selectedBrainId]: state.nodes.filter(n => n.type !== 'section'),
      }));
    }
  }, [selectedBrainId, state?.nodes]);

  const nodeInfo = (node: BrainCanvasNode): { title: string; icon: LucideIcon } => {
    const entity = node.ref_id ? entities.find(e => e.id === node.ref_id) : null;
    let icon: LucideIcon = FileText;
    if (node.type === 'workspace') {
      icon = getEntityIcon(entity?.icon);
    } else if (node.type === 'memory') {
      icon = Zap;
    } else if (entity?.type === 'canvas') {
      icon = Frame;
    } else if (entity?.type === 'workspace') {
      icon = getEntityIcon(entity.icon);
    }
    return {
      title: node.label || entity?.title || node.content?.slice(0, 60) || 'Untitled',
      icon,
    };
  };

  // ── Menus & rename ─────────────────────────────────────────────
  const [menu, setMenu] = useState<{ kind: MenuKind; x: number; y: number } | null>(null);
  const [iconPicker, setIconPicker] = useState<{ brainId: string; x: number; y: number } | null>(null);
  const [rename, setRename] = useState<(RenameTarget & { value: string }) | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rename) {
      requestAnimationFrame(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      });
    }
  }, [rename?.kind, rename && 'nodeId' in rename ? rename.nodeId : rename?.brainId]);

  useEffect(() => {
    if (!menu && !iconPicker) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || iconPickerRef.current?.contains(t)) return;
      setMenu(null);
      setIconPicker(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenu(null);
        setIconPicker(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu, iconPicker]);

  const openMenu = (kind: MenuKind, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setIconPicker(null);
    setMenu({ kind, x: rect.right + 4, y: rect.top });
  };

  const commitRename = async () => {
    if (!rename) return;
    const value = rename.value.trim();
    if (rename.kind === 'brain') {
      const title = value || 'Brain';
      try {
        await mutate({ action: 'update_brain', brain_id: rename.brainId, title });
      } catch { /* logged in mutate */ }
    } else if (rename.isMemory) {
      const label = value || 'Memory';
      try {
        await mutate({
          action: 'update_node',
          brain_id: rename.brainId,
          node_id: rename.nodeId,
          updates: { label },
        });
        await fetchBrainNodes(rename.brainId);
      } catch { /* logged */ }
    } else if (rename.entityId) {
      const title = value || 'Untitled';
      renameEntity(rename.entityId, title);
    }
    setRename(null);
  };

  const startRenameNode = (brainId: string, node: BrainCanvasNode) => {
    const info = nodeInfo(node);
    setRename({
      kind: 'node',
      brainId,
      nodeId: node.id,
      entityId: node.ref_id,
      isMemory: node.type === 'memory',
      value: info.title,
    });
    setMenu(null);
  };

  const startRenameBrain = (brainId: string, title: string) => {
    setRename({ kind: 'brain', brainId, value: title });
    setMenu(null);
  };

  const handleCreateNote = async (brainId: string) => {
    setMenu(null);
    setSelectedBrainId(brainId);
    setActiveBrainId(brainId);
    setActiveEntityId('brain');
    expandBrain(brainId);

    const brainNodes = nodesByBrain[brainId] ?? [];
    const titles = [
      ...entities.map(e => e.title),
      ...brainNodes.map(n => nodeInfo(n).title),
    ];
    const title = uniqueNewNoteTitle(titles);

    const entityId = addEntity({ type: 'note', title, content: [] });
    if (!entityId) return;

    openBrainNode(entityId);

    const entity = useStore.getState().entities.find(en => en.id === entityId);
    if (entity) {
      const { upsertEntity } = await import('@/lib/sync');
      await upsertEntity(entity);
    }

    const n = brainNodes.length;
    const x = 40 + (n % 5) * (CARD_W + 40);
    const y = 40 + Math.floor(n / 5) * (CARD_H + 40);

    try {
      await mutate({
        action: 'add_node',
        brain_id: brainId,
        type: 'entity',
        ref_id: entityId,
        position: { x, y },
      });
      await fetchBrainNodes(brainId);
      // Find new node for inline rename
      const res = await fetch(`/api/ai/user-brain?brain_id=${brainId}&nodes_only=true`, { headers: await authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const nodes = (data.nodes ?? []).filter((n: BrainCanvasNode) => n.type !== 'section') as BrainCanvasNode[];
        setNodesByBrain(prev => ({ ...prev, [brainId]: nodes }));
        const created = nodes.find(n => n.ref_id === entityId);
        if (created) {
          setRename({
            kind: 'node',
            brainId,
            nodeId: created.id,
            entityId,
            isMemory: false,
            value: title,
          });
        }
      }
    } catch {
      /* logged in mutate */
    }
  };

  const handleDuplicateNode = async (brainId: string, node: BrainCanvasNode) => {
    setMenu(null);
    if (!node.ref_id || node.type === 'memory') return;
    const newId = duplicateEntity(node.ref_id);
    if (!newId) return;

    const entity = useStore.getState().entities.find(en => en.id === newId);
    if (entity) {
      const { upsertEntity } = await import('@/lib/sync');
      await upsertEntity(entity);
    }

    const brainNodes = nodesByBrain[brainId] ?? [];
    const n = brainNodes.length;
    const base = node.position ?? { x: 40, y: 40 };
    try {
      await mutate({
        action: 'add_node',
        brain_id: brainId,
        type: node.type === 'workspace' ? 'workspace' : 'entity',
        ref_id: newId,
        position: { x: base.x + 24, y: base.y + 24 },
      });
      await fetchBrainNodes(brainId);
    } catch { /* logged */ }
  };

  const handleDeleteNode = async (brainId: string, node: BrainCanvasNode) => {
    setMenu(null);
    const isEntity = !!node.ref_id && node.type !== 'memory';
    if (!confirm(isEntity
      ? 'Delete this item and remove it from the brain?'
      : 'Remove this node from the brain?'
    )) return;
    try {
      await mutate({ action: 'remove_node', brain_id: brainId, node_id: node.id });
      await fetchBrainNodes(brainId);
      if (isEntity && node.ref_id) {
        useStore.getState().deleteEntity(node.ref_id);
      }
    } catch { /* logged */ }
  };

  const handleDeleteBrain = async (brainId: string) => {
    setMenu(null);
    if (!confirm('Delete this brain? Its nodes and edges will be removed.')) return;
    try {
      await mutate({ action: 'delete_brain', brain_id: brainId });
      if (selectedBrainId === brainId || activeBrainId === brainId) {
        const remaining = brains.filter(b => b.id !== brainId);
        const next = remaining[0];
        if (next) {
          setSelectedBrainId(next.id);
          setActiveBrainId(next.id);
        }
      }
    } catch (e: any) {
      alert(e?.message || 'Could not delete brain');
    }
  };

  const handleSetBrainIcon = async (brainId: string, icon: string) => {
    setIconPicker(null);
    try {
      await mutate({ action: 'update_brain', brain_id: brainId, icon });
    } catch { /* logged */ }
  };

  const brainIcon = (brain: { icon?: string | null }) => {
    if (brain.icon) return getEntityIcon(brain.icon);
    return Brain;
  };

  // Shift/cmd/ctrl+click must not create a browser text/range selection or
  // native focus ring on these rows (matches TreeItem sidebar behavior).
  const suppressBrowserSelect = (e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) e.preventDefault();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden select-none">
      <div className="flex-1 overflow-y-auto px-[10px] pb-4 flex flex-col gap-[1px] select-none">
        {state === null ? (
          <div className="flex flex-col gap-[1px]">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center h-7 gap-2 px-[8px]">
                <Skeleton className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-[var(--bone-5)]" />
                <Skeleton className="h-2.5 w-24 rounded-sm bg-[var(--bone-5)]" />
              </div>
            ))}
          </div>
        ) : brains.map(brain => {
          // Default the active/last brain to expanded (no closed→open animate on open).
          const openId = selectedBrainId || activeBrainId;
          const isCollapsed = collapsedBrains[brain.id] ?? (brain.id !== openId);
          const brainNodes = nodesByBrain[brain.id] ?? [];
          const BrainIcon = brainIcon(brain);
          const isBrainActive = brain.id === selectedBrainId;
          const renamingThisBrain = rename?.kind === 'brain' && rename.brainId === brain.id;

          return (
            <div key={brain.id} className="relative group/treeitem flex flex-col gap-[1px]">
              {/* Brain header row */}
              <div
                role="button"
                tabIndex={0}
                onMouseDown={suppressBrowserSelect}
                onClick={() => {
                  if (renamingThisBrain) return;
                  setSelectedBrainId(brain.id);
                  setActiveBrainId(brain.id);
                  setActiveEntityId('brain');
                  expandBrain(brain.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedBrainId(brain.id);
                    setActiveBrainId(brain.id);
                    setActiveEntityId('brain');
                    expandBrain(brain.id);
                  }
                }}
                className={cn(
                  "sidebar-item-row group relative flex w-full select-none items-center h-7 rounded-[var(--radius-small)]",
                  "border border-transparent text-[14px] cursor-pointer outline-none focus:outline-none focus-visible:outline-none",
                  isBrainActive
                    ? "!bg-dark text-[var(--bone-100)] font-normal"
                    : "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]"
                )}
                style={{ paddingLeft: '8px', paddingRight: '3px', userSelect: 'none' }}
              >
                <div
                  className={cn(
                    "relative flex items-center justify-center w-[14px] shrink-0 text-[var(--bone-100)]",
                    isBrainActive ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                  )}
                >
                  <div className="flex items-center justify-center w-3.5 h-3.5 group-hover:opacity-0">
                    <BrainIcon strokeWidth={2} className="w-3.5 h-3.5 shrink-0 text-inherit" />
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      const willExpand = isCollapsed;
                      setCollapsedBrains(prev => ({
                        ...prev,
                        [brain.id]: !(prev[brain.id] ?? true),
                      }));
                      if (willExpand) fetchBrainNodes(brain.id);
                    }}
                    className="sidebar-actions absolute btn-sidebar-utility opacity-0 group-hover:opacity-100"
                    style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                  >
                    {isCollapsed
                      ? <ChevronRight strokeWidth={2} className="w-3.5 h-3.5" />
                      : <ChevronDown strokeWidth={2} className="w-3.5 h-3.5" />}
                  </div>
                </div>

                {renamingThisBrain ? (
                  <input
                    ref={renameInputRef}
                    value={rename.value}
                    onChange={e => setRename({ ...rename, value: e.target.value })}
                    onBlur={() => commitRename()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                      if (e.key === 'Escape') setRename(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    className="ml-[6px] flex-1 min-w-0 bg-transparent outline-none text-[var(--bone-100)] border-none p-0 text-[14px] leading-snug truncate translate-y-[0.7px]"
                  />
                ) : (
                  <span
                    className={cn(
                      "ml-[6px] flex-1 text-left truncate leading-snug translate-y-[0.7px]",
                      isBrainActive
                        ? "text-[var(--bone-100)]"
                        : "text-[var(--bone-70)] group-hover:text-[var(--bone-100)]"
                    )}
                  >
                    {brain.title}
                  </span>
                )}

                <div
                  className={cn(
                    "sidebar-actions flex items-center gap-[1px] shrink-0",
                    (menu?.kind.type === 'brain' && menu.kind.brainId === brain.id) || iconPicker?.brainId === brain.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  <button
                    type="button"
                    title="New note"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateNote(brain.id);
                    }}
                    className="btn-sidebar-utility"
                  >
                    <Plus strokeWidth={2} className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Options"
                    onClick={(e) => {
                      e.stopPropagation();
                      openMenu(
                        { type: 'brain', brainId: brain.id, title: brain.title, isCollapsed },
                        e.currentTarget
                      );
                    }}
                    className={cn(
                      "btn-sidebar-utility",
                      menu?.kind.type === 'brain' && menu.kind.brainId === brain.id && "!bg-[var(--app-dark)] !text-[var(--bone-100)] !opacity-100"
                    )}
                  >
                    <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Children */}
              {/* No expand/collapse transition — opening Brain must not animate unfold. */}
              <div className={cn("grid", !isCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden pb-[2px] -mb-[2px]">
                  <div className="relative flex flex-col gap-[1px]">
                    {brainNodes.length > 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-[1px] bg-[var(--bone-6)] pointer-events-none"
                        style={{ left: '14px' }}
                      />
                    )}
                    {brainNodes.map(node => {
                      const info = nodeInfo(node);
                      const Icon = info.icon;
                      const renamingThis =
                        rename?.kind === 'node' && rename.nodeId === node.id;

                      return (
                        <div
                          key={node.id}
                          role="button"
                          tabIndex={0}
                          onMouseDown={suppressBrowserSelect}
                          onClick={(e) => {
                            if (e.shiftKey || e.metaKey || e.ctrlKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              return;
                            }
                            if (renamingThis) return;
                            setSelectedBrainId(brain.id);
                            if (node.type === 'entity' && node.ref_id) openBrainNode(node.ref_id);
                            else if (node.type === 'workspace' && node.ref_id) openBrainNode(node.ref_id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedBrainId(brain.id);
                              if (node.ref_id) openBrainNode(node.ref_id);
                            }
                          }}
                          className={cn(
                            "sidebar-item-row group relative flex w-full select-none items-center h-7 rounded-[var(--radius-small)]",
                            "border border-transparent text-[14px] cursor-pointer outline-none focus:outline-none focus-visible:outline-none",
                            "text-[var(--bone-70)] hover:text-[var(--bone-100)] [&:hover:not(:has(.sidebar-actions:hover))]:bg-[var(--app-dark)]"
                          )}
                          style={{ paddingLeft: '26px', paddingRight: '3px', userSelect: 'none' }}
                        >
                          <div className="w-[14px] shrink-0 flex items-center justify-center text-[var(--bone-100)] opacity-70 group-hover:opacity-100">
                            <Icon strokeWidth={2} className="w-3.5 h-3.5 shrink-0" />
                          </div>

                          {renamingThis ? (
                            <input
                              ref={renameInputRef}
                              value={rename.value}
                              onChange={e => setRename({ ...rename, value: e.target.value })}
                              onBlur={() => commitRename()}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                                if (e.key === 'Escape') setRename(null);
                              }}
                              onClick={e => e.stopPropagation()}
                              className="ml-[6px] flex-1 min-w-0 bg-transparent outline-none text-[var(--bone-100)] border-none p-0 text-[14px] leading-snug truncate translate-y-[0.7px]"
                            />
                          ) : (
                            <span className="ml-[6px] flex-1 text-left truncate leading-snug translate-y-[0.7px] text-[var(--bone-70)] group-hover:text-[var(--bone-100)]">
                              {info.title}
                            </span>
                          )}

                          <div
                            className={cn(
                              "sidebar-actions flex items-center gap-[1px] shrink-0",
                              menu?.kind.type === 'node' && menu.kind.node.id === node.id
                                ? "opacity-100"
                                : "opacity-0 group-hover:opacity-100"
                            )}
                          >
                            <button
                              type="button"
                              title="Options"
                              onClick={(e) => {
                                e.stopPropagation();
                                openMenu({ type: 'node', brainId: brain.id, node }, e.currentTarget);
                              }}
                              className={cn(
                                "btn-sidebar-utility",
                                menu?.kind.type === 'node' && menu.kind.node.id === node.id && "!bg-[var(--app-dark)] !text-[var(--bone-100)] !opacity-100"
                              )}
                            >
                              <MoreHorizontal strokeWidth={2} className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {brainNodes.length === 0 && (
                      <div className="pl-[26px] text-[11px] text-[var(--bone-30)] py-1.5 font-medium">No nodes yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Context menus */}
      {menu && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[300] popup-glass-small min-w-[180px] p-1 flex flex-col gap-[2px]"
          style={{ left: menu.x, top: menu.y }}
          onClick={e => e.stopPropagation()}
        >
          {menu.kind.type === 'node' && (() => {
            const { brainId, node } = menu.kind;
            const entity = node.ref_id ? entities.find(e => e.id === node.ref_id) : null;
            const isNote = entity?.type === 'note' || (node.type === 'entity' && !!node.ref_id && entity?.type !== 'canvas' && entity?.type !== 'workspace' && entity?.type !== 'folder');
            const canDuplicate = !!node.ref_id && node.type !== 'memory';

            return (
              <>
                <button
                  type="button"
                  className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
                  onClick={() => startRenameNode(brainId, node)}
                >
                  <Edit2 strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                  <span className="flex-1 text-left font-medium tracking-wide">Rename</span>
                </button>
                {canDuplicate && (
                  <button
                    type="button"
                    className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
                    onClick={() => handleDuplicateNode(brainId, node)}
                  >
                    <Copy strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                    <span className="flex-1 text-left font-medium tracking-wide">Duplicate</span>
                  </button>
                )}
                {isNote && node.ref_id && (
                  <button
                    type="button"
                    className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
                    onClick={() => {
                      setMenu(null);
                      setSelectedBrainId(brainId);
                      openBrainNode(node.ref_id!);
                    }}
                  >
                    <Columns2 strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                    <span className="flex-1 text-left font-medium tracking-wide">Open in right column</span>
                  </button>
                )}
                <div className="h-px bg-[var(--bone-6)] mx-1.5 my-[2px]" />
                <button
                  type="button"
                  className="popup-item popup-item-danger group w-full flex items-center gap-2 px-3 text-sm transition-none"
                  onClick={() => handleDeleteNode(brainId, node)}
                >
                  <Trash2 strokeWidth={2} className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left font-medium tracking-wide">Delete</span>
                </button>
              </>
            );
          })()}

          {menu.kind.type === 'brain' && (() => {
            const { brainId, title, isCollapsed } = menu.kind;
            return (
              <>
                <button
                  type="button"
                  className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
                  onClick={() => {
                    setMenu(null);
                    const willExpand = isCollapsed;
                    setCollapsedBrains(prev => ({
                      ...prev,
                      [brainId]: !(prev[brainId] ?? true),
                    }));
                    if (willExpand) fetchBrainNodes(brainId);
                  }}
                >
                  {isCollapsed
                    ? <ChevronRight strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                    : <ChevronDown strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />}
                  <span className="flex-1 text-left font-medium tracking-wide">{isCollapsed ? 'Unfold' : 'Fold'}</span>
                </button>
                <button
                  type="button"
                  className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
                  onClick={() => startRenameBrain(brainId, title)}
                >
                  <Edit2 strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                  <span className="flex-1 text-left font-medium tracking-wide">Rename</span>
                </button>
                <button
                  type="button"
                  className="popup-item group w-full flex items-center gap-2 px-3 text-sm transition-none"
                  onClick={() => {
                    setMenu(null);
                    setIconPicker({ brainId, x: menu.x, y: menu.y });
                  }}
                >
                  <Palette strokeWidth={2} className="w-4 h-4 shrink-0 text-[var(--bone-100)] opacity-70 group-hover:opacity-100" />
                  <span className="flex-1 text-left font-medium tracking-wide">Change icon</span>
                </button>
                <div className="h-px bg-[var(--bone-6)] mx-1.5 my-[2px]" />
                <button
                  type="button"
                  className="popup-item popup-item-danger group w-full flex items-center gap-2 px-3 text-sm transition-none"
                  onClick={() => handleDeleteBrain(brainId)}
                >
                  <Trash2 strokeWidth={2} className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left font-medium tracking-wide">Delete</span>
                </button>
              </>
            );
          })()}
        </div>,
        document.body
      )}

      {iconPicker && createPortal(
        <div
          ref={iconPickerRef}
          className="fixed z-[300] popup-glass-small p-2 min-w-[200px]"
          style={{ left: iconPicker.x, top: iconPicker.y }}
          onClick={e => e.stopPropagation()}
        >
          <p className="text-[10px] font-ui-label uppercase tracking-wide text-[var(--bone-60)] px-1 mb-1.5">Icon</p>
          <div className="grid grid-cols-5 gap-1">
            {BRAIN_ICON_PICKS.map(name => {
              const Ic = ICON_MAP[name] ?? Brain;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => handleSetBrainIcon(iconPicker.brainId, name)}
                  className="w-8 h-8 flex items-center justify-center rounded-[var(--radius-small)] text-[var(--bone-100)] opacity-70 hover:opacity-100 hover:bg-[var(--app-dark)]"
                >
                  <Ic strokeWidth={2} className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
