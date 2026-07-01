import { describe, it, expect } from 'vitest';
import { getWorkspaceEntityIds } from './store.helpers';
import type { Entity } from './store.types';

function makeEntity(overrides: Partial<Entity> & { id: string }): Entity {
  return {
    title: 'Test',
    type: 'note',
    parentId: null,
    lastModified: 0,
    syncMode: 'cloud-only',
    workspaceId: 'ws-personal',
    ...overrides,
  } as Entity;
}

describe('getWorkspaceEntityIds', () => {
  it('returns ids of every entity whose workspaceId matches, regardless of parentId depth', () => {
    const entities: Entity[] = [
      makeEntity({ id: 'c1', type: 'collection', workspaceId: 'ws-personal' }),
      makeEntity({ id: 'f1', type: 'folder', parentId: 'c1', workspaceId: 'ws-personal' }),
      makeEntity({ id: 'n1', type: 'note', parentId: 'f1', workspaceId: 'ws-personal' }),
      makeEntity({ id: 'n2', type: 'note', parentId: null, workspaceId: 'ws-other' }),
    ];

    const ids = getWorkspaceEntityIds(entities, 'ws-personal');

    expect(ids.sort()).toEqual(['c1', 'f1', 'n1']);
  });

  it('returns an empty array when no entities belong to the workspace', () => {
    const entities: Entity[] = [
      makeEntity({ id: 'n1', workspaceId: 'ws-other' }),
    ];

    expect(getWorkspaceEntityIds(entities, 'ws-personal')).toEqual([]);
  });
});
