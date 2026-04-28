"use client";

import { Entity, useStore } from '@/data/store';
import { getEntityIcon } from '@/data/icons';

export function HeaderWidget({ entity }: { entity: Entity }) {
  const Icon = getEntityIcon(entity.icon);

  return (
    <div className="bg-sidebar border border-[var(--bone-3)] group/widget px-6 pb-6 pt-5 rounded-[var(--radius-big)] widget-shadow h-full">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[var(--radius-medium)] bg-[var(--bone-5)] flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-display text-foreground">{entity.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Workspace
          </p>
        </div>
      </div>
    </div>
  );
}

