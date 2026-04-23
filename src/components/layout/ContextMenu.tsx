"use client";

import { useStore } from '@/data/store';
import type { SidebarSectionId } from '@/data/store';
import { Star, Link2, FolderInput, Trash2, Edit2, Copy, Palette, ChevronRight, ArrowUp, ArrowDown, EyeOff, Eye, LayoutPanelLeft, Grid, Type, Calendar, Layers, Settings } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { IconPicker } from './IconPicker';

interface MenuItem {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  hidden?: boolean;
  children?: MenuItem[];
}

function MenuItemComponent({ 
  item, 
  closeMenu, 
  depth = 0 
}: { 
  item: MenuItem; 
  closeMenu: () => void; 
  depth?: number 
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="relative flex flex-col w-full"
      onMouseEnter={() => item.children && setIsOpen(true)}
      onMouseLeave={() => item.children && setIsOpen(false)}
    >
      <button
        onClick={() => {
          if (item.onClick) {
            item.onClick();
            if (!item.children) closeMenu();
          }
        }}
        className={clsx(
          "popup-item w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors",
          item.danger && "popup-item-danger"
        )}
      >
        {item.icon && <div className="w-4 h-4 shrink-0">{item.icon}</div>}
        <span className="flex-1 text-left font-medium">{item.label}</span>
        {item.children && <ChevronRight className="w-3 h-3 opacity-50" />}
      </button>

      {item.children && isOpen && (
        <div 
          className="fixed z-[310] popup-glass-small min-w-[180px] p-1.5"
          style={{ 
            left: `calc(var(--menu-width) + ${depth * 180}px)`, 
            top: `var(--item-top)` 
          }}
        >
          {item.children.map((child, i) => (
            <MenuItemComponent 
              key={i} 
              item={child} 
              closeMenu={closeMenu} 
              depth={depth + 1} 
            />
          ))}
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
    activeEntityId
  } = useStore();
  const ref = useRef<HTMLDivElement>(null);

  const [adjustedPos, setAdjustedPos] = useState({ x: 0, y: 0 });
  const [pickerEntityId, setPickerEntityId] = useState<string | null>(null);

  const showIconPicker = pickerEntityId === contextMenu?.entityId;

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

      if (x + rect.width > window.innerWidth - padding) {
        x = window.innerWidth - rect.width - padding;
      }
      if (y + rect.height > window.innerHeight - padding) {
        y = window.innerHeight - rect.height - padding;
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

  if (!isSectionMenu && !entity) return null;

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
        {
          label: 'Insert Divider',
          icon: <div className="w-4 h-px bg-current" />,
          onClick: () => { insertSidebarDivider(null); },
        },
        {
          label: 'Sidebar Settings',
          icon: <Settings className="w-4 h-4" />,
          onClick: () => { openModal({ kind: 'settings' }); },
        },
      ].filter(item => !item.hidden);
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
          {getItems().map((item, i) => (
            <MenuItemComponent 
              key={i} 
              item={item} 
              closeMenu={closeContextMenu} 
            />
          ))}
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
