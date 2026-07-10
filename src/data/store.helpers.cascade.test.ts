import { describe, it, expect } from 'vitest';
import { getSyncModeCascade } from './store.helpers';
import type { Entity, AppTask } from './store.types';

const e = (id: string, parentId: string | null, type: Entity['type'] = 'note'): Entity =>
  ({ id, parentId, type, title: id, lastModified: 0, syncMode: 'cloud-only', content: [] } as any);
const t = (id: string, entityId: string | null, spaceId: string | null = null): AppTask =>
  ({ id, entityId, spaceId, title: id, completed: false, lastModified: 0, syncMode: 'cloud-only' } as any);

describe('getSyncModeCascade', () => {
  const entities = [
    e('ws1', null, 'workspace'),
    e('f1', 'ws1', 'folder'),
    e('n1', 'f1'),          // nested note
    e('n2', 'ws1'),         // direct child
    e('other', null, 'workspace'),
    e('otherNote', 'other'),
  ];
  const tasks = [
    t('t1', 'n1'),           // task on nested note -> included
    t('t2', 'ws1'),          // task on the workspace itself -> included
    t('t3', 'otherNote'),    // other workspace -> excluded
    t('t4', null),           // unassigned/global -> excluded
    t('t5', null, 'ws1'),    // assigned via spaceId -> included
  ];

  it('collects workspace, all descendant entities, and all associated tasks', () => {
    const result = getSyncModeCascade(entities, tasks, 'ws1');
    expect(result.entityIds.sort()).toEqual(['f1', 'n1', 'n2', 'ws1']);
    expect(result.taskIds.sort()).toEqual(['t1', 't2', 't5']);
  });

  it('handles a workspace with no overlapping children or tasks', () => {
    const result = getSyncModeCascade(entities, tasks, 'other');
    expect(result.entityIds.sort()).toEqual(['other', 'otherNote']);
    expect(result.taskIds).toEqual(['t3']);
  });
});
