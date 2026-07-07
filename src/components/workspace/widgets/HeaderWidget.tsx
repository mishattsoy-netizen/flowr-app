"use client";

import { Entity, useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';
import { stripHtml } from '@/lib/utils';
import type { WidgetPropsWithEntity } from './types';

export function HeaderWidget({ entity: propEntity, contextId }: WidgetPropsWithEntity) {
  const entities = useStore(state => state.entities);
  const entity = propEntity ?? entities.find(e => e.id === contextId) ?? null;
  if (!entity) return null;
  const Icon = getEntityIcon(entity.icon);

  return (
    <div className="bg-panel group/widget px-6 pb-6 pt-5 widget-shadow h-full">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[var(--radius-medium)] bg-[var(--bone-5)] flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-[var(--bone-100)]" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-semibold text-foreground">{stripHtml(entity.title || '')}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Space
          </p>
        </div>
      </div>
    </div>
  );
}

