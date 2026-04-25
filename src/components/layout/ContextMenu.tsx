"use client";

import { useStore } from '@/data/store';
import type { SidebarSectionId } from '@/data/store';
import { Star, Link2, FolderInput, Trash2, Edit2, Copy, Palette, ChevronRight, ArrowUp, ArrowDown, EyeOff, Eye, LayoutPanelLeft, Grid, Type, Calendar, Layers, Settings, Plus, Check } from 'lucide-react';
import clsx from 'clsx';
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
      closeMenu();
    }
  };

  return (
    <div 
      ref={itemRef}
      className="relative flex flex-col w-full"
    >
      <button
        onClick={handleToggle}
        className={clsx(
          "popup-item w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
          item.danger && "popup-item-danger",
          isOpen && "bg-[var(--bone-10)] text-[var(--bone-100)]"
        )}
      >
        {item.icon && <div className="w-4 h-4 shrink-0">{item.icon}</div>}
        <span className="flex-1 text-left font-medium tracking-wide">{item.label}</span>
        {item.children && <ChevronRight className={clsx("w-3 h-3 opacity-50 transition-transform", isOpen && "rotate-90")} />}
      </button>

      {item.children && isOpen && (
        <div 
          className="fixed z-[310] popup-glass-small min-w-[180px] p-1.5"
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
    setSectionItemLimit,
    toggleEntityVisibility,
    moveEntityInList,
    insertSidebarDivider,
    sidebarSectionSettings,
    hiddenEntityIds,
    activeEntityId,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId
  } = useStore();
  const ref = useRef<HTMLDivElement>(null);

  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });
  const [pickerEntityId, setPickerEntityId] = useState<string | null>(null);
  
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
    }
  }, [contextMenu]);

  if (!contextMenu) return null;

  // Handle case where entityId might be a sectionId instead of an entityId
  const entity = entities.find(e => e.id === contextMenu.entityId);
  const isSectionMenu = contextMenu.source === 'sidebar-section';
  const isSpacesMenu = contextMenu.source === 'spaces';

  if (!isSectionMenu && !isSpacesMenu && !entity) return null;

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
              onClick: () => setSectionSortMode(sectionId, 'lastModified') 
            },
            { 
              label: 'Alphabetical', 
              icon: <Type className="w-4 h-4" />, 
              onClick: () => setSectionSortMode(sectionId, 'alphabetical') 
            },
            { 
              label: 'Manual', 
              icon: <LayoutPanelLeft className="w-4 h-4" />, 
              onClick: () => setSectionSortMode(sectionId, 'manual') 
            },
          ]
        },
        {
          label: 'Items to show',
          icon: <Layers className="w-4 h-4" />, // Re-import Layers if needed or use another
          children: [5, 10, 15, 20, 50].map(limit => ({
            label: `${limit} items`,
            onClick: () => setSectionItemLimit(sectionId, limit)
          }))
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
          onClick: () => { openModal({ kind: 'settings' }); },
        },
      ].filter(item => !item.hidden);
    }

    if (isSpacesMenu) {
      return [
        ...workspaces.map(ws => ({
          label: ws.name,
          icon: ws.id === activeWorkspaceId ? <Check className="w-4 h-4 text-accent" /> : <div className="w-4 h-4" />,
          onClick: () => { setActiveWorkspaceId(ws.id); closeContextMenu(); }
        })),
        { isDivider: true },
        {
          label: 'New space',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => { openModal({ kind: 'newWorkspace' }); closeContextMenu(); }
        }
      ];
    }

    // Standard entity menu
    const isFavorite = favoriteIds.includes(entity!.id);
    const isCollection = entity!.type === 'collection' || entity!.type === 'workspace';

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

    const items: MenuItem[] = [
      {
        icon: <Star className={`w-4 h-4 ${isFavorite ? 'text-accent' : ''}`} />,
        label: isFavorite ? 'Unpin' : 'Pin to sidebar',
        onClick: () => { toggleFavorite(entity!.id); closeContextMenu(); },
      },
      {
        icon: <Link2 className="w-4 h-4" />,
        label: 'Copy link',
        onClick: handleCopyLink,
      },
      {
        icon: <FolderInput className="w-4 h-4" />,
        label: 'Move to...',
        onClick: () => { openModal({ kind: 'moveTo', entityId: entity!.id }); },
        hidden: isCollection
      },
      {
        icon: <Copy className="w-4 h-4" />,
        label: 'Duplicate',
        onClick: () => { duplicateEntity(entity!.id); closeContextMenu(); },
      },
      {
        icon: <Edit2 className="w-4 h-4" />,
        label: 'Rename',
        onClick: () => { setEditingEntityId(entity!.id, contextMenu.source); closeContextMenu(); },
      },
    ].filter(item => !item.hidden);

    if (isCollection) {
      items.splice(1, 0, {
        icon: <Palette className="w-4 h-4" />,
        label: 'Change icon',
        onClick: () => { setPickerEntityId(entity!.id); },
      });
    }

    items.push({ isDivider: true });
    items.push({
      icon: <Trash2 className="w-4 h-4" />,
      label: 'Delete',
      onClick: () => { openModal({ kind: 'deleteConfirm', entityId: entity!.id }); },
      danger: true,
    });

    return items;
  };

  return (
    <>
      {!showIconPicker && (
        <div
          ref={ref}
          className={clsx(
            "fixed z-[300] popup-glass-small min-w-[200px] p-1.5",
            adjustedPos.x === 0 && "opacity-0"
          )}
          style={{ 
            left: adjustedPos.x, 
            top: adjustedPos.y,
            // We set this CSS variable so children can position themselves relative to the menu width
            '--menu-width': 'var(--menu-width, 200px)'
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
