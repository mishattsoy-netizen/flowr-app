"use client";

import { useStore } from '@/data/store';
import type { SidebarSectionId } from '@/data/store';
import { isDesktop } from '@/lib/env';
import { Star, Link2, FolderInput, Trash2, Edit2, Copy, Palette, ChevronRight, ChevronDown, ArrowUp, ArrowDown, EyeOff, Eye, LayoutPanelLeft, Grid, Type, Calendar, Layers, Settings, Plus, Check, ExternalLink, PanelLeft, Pin, FolderOpen, File, MoreVertical, Columns2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { IconPicker } from './IconPicker';

interface MenuItem {
  icon?: React.ReactNode;
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  hidden?: boolean;
  isDivider?: boolean;
  children?: MenuItem[];
  selected?: boolean;
  hideCheckmark?: boolean;
  rightElement?: React.ReactNode;
  keepOpen?: boolean;
}

function MenuItemsList({ 
  items, 
  closeMenu, 
  depth = 0 
}: { 
  items: MenuItem[]; 
  closeMenu: () => void; 
  depth?: number 
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      {items.map((item, i) => (
        <MenuItemComponent 
          key={i} 
          item={item} 
          isOpen={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          closeMenu={closeMenu} 
          depth={depth} 
        />
      ))}
    </>
  );
}

function MenuItemComponent({ 
  item, 
  isOpen,
  onToggle,
  closeMenu, 
  depth = 0 
}: { 
  item: MenuItem; 
  isOpen: boolean;
  onToggle: () => void;
  closeMenu: () => void; 
  depth?: number 
}) {
  const [subMenuPos, setSubMenuPos] = useState({ x: 0, y: 0 });
  const itemRef = useRef<HTMLDivElement>(null);
  if (item.hidden) return null;

  if (item.isDivider) {
    if (item.hidden) return null;
    return <div className="popup-divider" />;
  }

  const handleToggle = (e: React.MouseEvent) => {
    if (item.children && itemRef.current) {
      e.stopPropagation();
      const rect = itemRef.current.getBoundingClientRect();
      setSubMenuPos({ 
        x: rect.right - 4,
        y: rect.top - 6
      });
      onToggle();
    } else if (item.onClick) {
      item.onClick();
      if (!item.keepOpen) {
        closeMenu();
      }
    }
  };

  return (
    <div 
      ref={itemRef}
      className="relative flex flex-col w-full"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle(e as any);
          }
        }}
        className={cn(
          "popup-item group w-full flex items-center gap-2 px-3 py-[4px] text-sm",
          item.danger && "!text-danger hover:!bg-danger/10",
          isOpen && "bg-[var(--app-dark)] text-[var(--bone-100)]",
          item.selected && "bg-[var(--app-dark)] text-[var(--bone-100)]"
        )}
      >
        {item.icon && <div className="w-4 h-4 shrink-0">{item.icon}</div>}
        <span className="flex-1 text-left font-medium tracking-wide">{item.label}</span>
        {item.selected && !item.hideCheckmark && <Check strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-70)] group-hover:text-[var(--bone-100)] shrink-0" />}
        {item.rightElement}
        {item.children && <ChevronRight strokeWidth={2} className={cn("w-3.5 h-3.5 opacity-70", isOpen && "rotate-90")} />}
      </div>

      {item.children && isOpen && (
        <div 
          className="fixed z-[310] popup-glass-small min-w-[160px] flex flex-col gap-[2px]"
          style={{ 
            left: subMenuPos.x, 
            top: subMenuPos.y 
          }}
        >
          <MenuItemsList 
            items={item.children} 
            closeMenu={closeMenu} 
            depth={depth + 1} 
          />
        </div>
      )}
    </div>
  );
}

export function ContextMenu() {
  const {
    contextMenu,
    entities,
    favoriteIds,
    toggleFavorite,
    duplicateEntity,
    openModal,
    closeContextMenu,
    setEditingEntityId,
    setSectionSortMode,
    setActiveEntityId,
    setSectionItemLimit,
    toggleEntityVisibility,
    moveEntityInList,
    insertSidebarDivider,
    sidebarSectionSettings,
    hiddenEntityIds,
    activeEntityId,
    spaces,
    activeSpaceId,
    setActiveSpaceId,
    collapsedIds,
    toggleCollapsed,
    addTab,
    toggleSidebar,
    toggleSidebarPinned,
    isSidebarPinned,
    updateSpace
  } = useStore();
  const selectedSidebarIds = useStore(state => state.selectedSidebarIds);
  const clearSelectedSidebarIds = useStore(state => state.clearSelectedSidebarIds);
  const deleteEntity = useStore(state => state.deleteEntity);
  const ref = useRef<HTMLDivElement>(null);

  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });
  const [pickerEntityId, setPickerEntityId] = useState<string | null>(null);
  const [spaceOptionsId, setSpaceOptionsId] = useState<string | null>(null);
  const [spaceOptionsPos, setSpaceOptionsPos] = useState({ x: 0, y: 0 });
  
  const showIconPicker = pickerEntityId !== null && pickerEntityId === contextMenu?.entityId;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (!showIconPicker) {
          closeContextMenu();
        }
      }
    };
    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu, closeContextMenu, showIconPicker]);

  useEffect(() => {
    if (contextMenu && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const padding = 12;
      let x = contextMenu.x;
      let y = contextMenu.y;

      // Shift menu upwards if it's the spaces menu (footer trigger)
      if (contextMenu.source === 'spaces') {
        y -= (rect.height + padding);
      }

      if (x + rect.width > window.innerWidth - padding) {
        x = window.innerWidth - rect.width - padding;
      }
      if (y + rect.height > window.innerHeight - padding) {
        y = window.innerHeight - rect.height - padding;
      }
      if (y < padding) {
        y = padding;
      }
      
      setAdjustedPos({ x, y });
    } else if (contextMenu) {
      setAdjustedPos({ x: contextMenu.x, y: contextMenu.y });
    } else {
      setAdjustedPos({ x: 0, y: 0 });
    }
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) {
      setPickerEntityId(null);
      setSpaceOptionsId(null);
    }
  }, [contextMenu]);

  if (!contextMenu) return null;

  // Handle case where entityId might be a sectionId instead of an entityId
  const systemPages = ['dashboard', 'chat', 'tracker'];
  const entity = entities.find(e => e.id === contextMenu.entityId);
  const isSectionMenu = contextMenu.source === 'sidebar-section';
  const isSpacesMenu = contextMenu.source === 'spaces';
  const isSidebarToggle = contextMenu.source === 'sidebar-toggle';
  const isSystemMenu = systemPages.includes(contextMenu.entityId as string);

  if (!isSectionMenu && !isSpacesMenu && !isSidebarToggle && !isSystemMenu && !entity) return null;

  const getItems = (): MenuItem[] => {
    if (isSectionMenu) {
      const sectionId = contextMenu.entityId as SidebarSectionId;
      const settings = sidebarSectionSettings[sectionId];
      
      return [
        {
          label: 'Sort By',
          icon: <Grid className="w-4 h-4" />,
          children: [
            { 
              label: 'Last Edited', 
              icon: <Calendar className="w-4 h-4" />, 
              onClick: () => setSectionSortMode(sectionId, 'lastModified'),
              selected: settings.sortMode === 'lastModified'
            },
            { 
              label: 'Alphabetical', 
              icon: <Type className="w-4 h-4" />, 
              onClick: () => setSectionSortMode(sectionId, 'alphabetical'),
              selected: settings.sortMode === 'alphabetical'
            },
            { 
              label: 'Manual', 
              icon: <LayoutPanelLeft className="w-4 h-4" />, 
              onClick: () => setSectionSortMode(sectionId, 'manual'),
              selected: settings.sortMode === 'manual'
            },
          ]
        },
        { isDivider: true, hidden: !activeEntityId },
        {
          label: 'Move Up',
          icon: <ArrowUp className="w-4 h-4" />,
          onClick: () => { if (activeEntityId) moveEntityInList(activeEntityId, 'up'); },
          hidden: !activeEntityId
        },
        {
          label: 'Move Down',
          icon: <ArrowDown className="w-4 h-4" />,
          onClick: () => { if (activeEntityId) moveEntityInList(activeEntityId, 'down'); },
          hidden: !activeEntityId
        },
        {
          label: 'Hide',
          icon: <EyeOff className="w-4 h-4" />,
          onClick: () => { if (activeEntityId) toggleEntityVisibility(activeEntityId); },
          hidden: !activeEntityId
        },
        {
          label: 'Show Hidden',
          icon: <Eye className="w-4 h-4" />,
          onClick: () => { 
            if (hiddenEntityIds.length > 0) {
              hiddenEntityIds.forEach(id => toggleEntityVisibility(id));
            }
          }
        },
        { isDivider: true },
        {
          label: 'Sidebar Settings',
          icon: <Settings className="w-4 h-4" />,
          onClick: () => { openModal({ kind: 'settings' }); closeContextMenu(); },
        },
      ].filter(item => !item.hidden);
    }

    if (isSpacesMenu) {
      return [
        ...spaces.map(ws => ({
          label: ws.name,
          selected: ws.id === (activeSpaceId || 'ws-personal'),
          hideCheckmark: true,
          rightElement: (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setSpaceOptionsPos({ x: rect.right, y: rect.top });
                setSpaceOptionsId(ws.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-[2px] rounded hover:bg-white/10"
            >
              <MoreVertical strokeWidth={2} className="w-3.5 h-3.5 text-[var(--bone-50)] hover:text-[var(--bone-100)] shrink-0" />
            </button>
          ),
          onClick: () => { setActiveSpaceId(ws.id); closeContextMenu(); }
        })),
        { isDivider: true },
        {
          label: 'New space',
          icon: <Plus strokeWidth={2} className="w-4 h-4" />,
          onClick: () => { openModal({ kind: 'newWorkspace' }); closeContextMenu(); }
        }
      ];
    }

    if (isSidebarToggle) {
      return [
        {
          icon: <PanelLeft strokeWidth={2} className="w-4 h-4" />,
          label: 'Toggle Sidebar',
          onClick: () => { toggleSidebar(); closeContextMenu(); },
        },
        {
          icon: <Pin strokeWidth={2} className="w-4 h-4" />,
          label: isSidebarPinned ? 'Auto-collapse Sidebar' : 'Pin Sidebar',
          onClick: () => { toggleSidebarPinned(); closeContextMenu(); },
        },
      ];
    }

    if (isSystemMenu) {
      const id = contextMenu.entityId;
      return [
        {
          icon: <ExternalLink strokeWidth={2} className="w-4 h-4" />,
          label: 'Open in new tab',
          onClick: () => { if (id) addTab(id); closeContextMenu(); },
        }
      ];
    }

    // Standard entity menu
    const isFavorite = favoriteIds.includes(entity!.id);
    const isWorkspace = entity!.type === 'workspace';
    const isCollapsed = collapsedIds.includes(entity!.id);
    const isCollapsible = isWorkspace && entities.some(e => e.parentId === entity!.id);

    const handleCopyLink = () => {
      const parts: string[] = [entity!.title];
      let currentEntity: any = entity;
      while (currentEntity?.parentId) {
        const parent = entities.find(e => e.id === currentEntity.parentId);
        if (parent) {
          parts.unshift(parent.title);
          currentEntity = parent;
        } else break;
      }
      navigator.clipboard.writeText(`/flowr/${parts.join('/')}`);
      closeContextMenu();
    };

    const items: MenuItem[] = ([
      {
        icon: isCollapsible ? (isCollapsed ? <ChevronRight strokeWidth={2} className="w-4 h-4" /> : <ChevronDown strokeWidth={2} className="w-4 h-4" />) : <Star strokeWidth={2} className={`w-4 h-4 ${isFavorite ? 'text-accent' : ''}`} />,
        label: isCollapsible ? (isCollapsed ? 'Unfold' : 'Fold') : (isFavorite ? 'Unpin' : 'Pin to sidebar'),
        onClick: () => { 
          if (isCollapsible) toggleCollapsed(entity!.id);
          else toggleFavorite(entity!.id);
          closeContextMenu(); 
        },
      },
      {
        icon: <Edit2 strokeWidth={2} className="w-4 h-4" />,
        label: 'Rename',
        onClick: () => { setEditingEntityId(entity!.id, contextMenu.source); closeContextMenu(); },
      },
    ] as MenuItem[]).filter(item => !item.hidden);

    if (isWorkspace) {
      items.push({
        icon: <Palette strokeWidth={2} className="w-4 h-4" />,
        label: 'Change icon',
        keepOpen: true,
        onClick: () => { setPickerEntityId(entity!.id); },
      });
    }

    items.push({ isDivider: true });
    
    items.push(
      {
        icon: <Link2 strokeWidth={2} className="w-4 h-4" />,
        label: 'Copy link',
        onClick: handleCopyLink,
      },
      {
        icon: <Copy strokeWidth={2} className="w-4 h-4" />,
        label: 'Duplicate',
        onClick: () => { duplicateEntity(entity!.id); closeContextMenu(); },
      },
      {
        icon: <ExternalLink strokeWidth={2} className="w-4 h-4" />,
        label: 'Open in new tab',
        onClick: () => { addTab(entity!.id); closeContextMenu(); },
      }
    );

    if (activeEntityId && activeEntityId !== entity!.id && entity!.type !== 'workspace' && entity!.type !== 'folder') {
      items.push({
        icon: <Columns2 strokeWidth={2} className="w-4 h-4" />,
        label: 'Split page',
        onClick: () => {
          const nextTabs = [...useStore.getState().openTabIds];
          if (!nextTabs.includes(activeEntityId!)) nextTabs.push(activeEntityId!);
          if (!nextTabs.includes(entity!.id)) nextTabs.push(entity!.id);
          
          useStore.setState({
            splitViewActive: true,
            splitViewLeftId: activeEntityId,
            splitViewRightId: entity!.id,
            splitViewPinned: false,
            splitViewPosition: 50,
            openTabIds: nextTabs,
            activeEntityId: activeEntityId,
            activeTabId: activeEntityId,
            selectedSidebarIds: [],
          });
          closeContextMenu();
        }
      });
    }

    items.push({ isDivider: true });
    items.push({
      icon: <Trash2 strokeWidth={2} className="w-4 h-4" />,
      label: 'Delete',
      onClick: () => { openModal({ kind: 'deleteConfirm', entityId: entity!.id }); },
      danger: true,
    });

    // Show "Delete All" when multiple sidebar items are selected
    if (selectedSidebarIds.length > 1) {
      items.push({
        icon: <Trash2 strokeWidth={2} className="w-4 h-4" />,
        label: `Delete All (${selectedSidebarIds.length})`,
        onClick: () => {
          openModal({ kind: 'deleteConfirm', entityIds: [...selectedSidebarIds] });
          closeContextMenu();
        },
        danger: true,
      });
    }

    return items;
  };

  return (
    <>
      {!showIconPicker && (
        <div
          ref={ref}
          className={cn(
            "fixed z-[300] popup-glass-small min-w-[180px] flex flex-col gap-[2px]",
            adjustedPos.x === 0 && "opacity-0"
          )}
          style={{ 
            left: adjustedPos.x, 
            top: adjustedPos.y,
            // We set this CSS variable so children can position themselves relative to the menu width
            '--menu-width': 'var(--menu-width, 180px)'
          } as React.CSSProperties}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--menu-width', `${rect.width}px`);
          }}
        >
          <MenuItemsList
            items={getItems()}
            closeMenu={closeContextMenu}
          />

          {/* Space options popover */}
          {spaceOptionsId && (
            <div
              className="fixed z-[310] popup-glass-small min-w-[160px] flex flex-col gap-[2px]"
              style={{ left: spaceOptionsPos.x, top: spaceOptionsPos.y }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const ws = spaces.find(s => s.id === spaceOptionsId);
                if (!ws) return null;
                return (
                  <>
                    <button
                      onClick={() => { openModal({ kind: 'rename', entityId: ws.id }); setSpaceOptionsId(null); closeContextMenu(); }}
                      className="popup-item flex items-center w-full px-3 py-1.5 text-sm gap-2"
                    >
                      <Edit2 strokeWidth={2} className="w-4 h-4 shrink-0" />
                      <span>Rename</span>
                    </button>
                    <button
                      onClick={() => { updateSpace(ws.id, { isDefault: true }); setSpaceOptionsId(null); closeContextMenu(); }}
                      disabled={ws.isDefault}
                      className={cn(
                        "popup-item flex items-center w-full px-3 py-1.5 text-sm gap-2",
                        ws.isDefault && "opacity-50 cursor-default"
                      )}
                    >
                      <Star strokeWidth={2} className={cn("w-4 h-4 shrink-0", ws.isDefault && "text-accent")} />
                      <span>{ws.isDefault ? '✓ Default' : 'Set as default'}</span>
                    </button>
                    <div className="popup-divider" />
                    <button
                      onClick={() => { openModal({ kind: 'deleteSpaceConfirm', spaceId: ws.id }); setSpaceOptionsId(null); closeContextMenu(); }}
                      className="popup-item flex items-center w-full px-3 py-1.5 text-sm gap-2 text-red-400"
                    >
                      <Trash2 strokeWidth={2} className="w-4 h-4 shrink-0" />
                      <span>Delete</span>
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {showIconPicker && (
        <IconPicker
          entityId={entity?.id || ''}
          anchorRect={{ x: adjustedPos.x, y: adjustedPos.y, width: 180, height: 0 }}
          onClose={() => {
            setPickerEntityId(null);
            closeContextMenu();
          }}
        />
      )}
    </>
  );
}
