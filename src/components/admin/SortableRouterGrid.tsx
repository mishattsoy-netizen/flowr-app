'use client'

import React, { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import RouterManager from './RouterManager'
import { saveRouterOrder } from '@/app/admin/router/actions'
import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

interface SortableItemProps {
  id: string
  children: React.ReactNode
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 0 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className={cn(
      "group relative h-full",
      isDragging ? "opacity-30" : "opacity-100"
    )}>
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-2.5 right-2.5 z-50 p-1 rounded-sm bg-white/5 text-bone-70/20 group-hover:text-bone-70/80 hover:bg-white/10 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all duration-200"
      >
        <GripVertical className="w-2.5 h-2.5" />
      </div>
      {children}
    </div>
  )
}

export default function SortableRouterGrid({
  initialRouters,
  models,
  children
}: {
  initialRouters: any[]
  models: any[]
  children?: React.ReactNode
}) {
  const [items, setItems] = useState(initialRouters)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const activeItem = activeId ? items.find(i => i.id === activeId) : null
  
  if (!isMounted) return null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(items, oldIndex, newIndex)
        setItems(newItems)

        try {
          await saveRouterOrder(newItems.map(i => i.id))
        } catch (error) {
          console.error('Failed to save router order:', error)
        }
      }
    }
    setActiveId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext
        items={items.map(i => i.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
          {items.map((router) => (
            <SortableItem key={router.id} id={router.id}>
              <RouterManager
                chain={router}
                title={router.category.replace(/_/g, ' ')}
                category={router.category}
                availableModels={models}
              />
            </SortableItem>
          ))}
          {children}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeItem ? (
          <div className="w-full h-full cursor-grabbing shadow-2xl rounded-big overflow-hidden ring-1 ring-white/10 ring-inset">
            <RouterManager
              chain={activeItem}
              title={activeItem.category.replace(/_/g, ' ')}
              category={activeItem.category}
              availableModels={models}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
