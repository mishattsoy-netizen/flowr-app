import { describe, it, expect } from 'vitest';
import { sqliteRowToEntity, sqliteRowToTask, sqliteRowToSpace } from './loadFromSQLite';

describe('sqliteRowToEntity', () => {
  it('maps a SQLite row back into an Entity, parsing JSON columns', () => {
    const row = {
      id: 'e1', title: 'Note', type: 'note', parent_id: null, last_modified: 123,
      icon: null, tags: '["a","b"]', content: '[{"id":"b1","type":"text"}]',
      sort_order: 0, space_id: null, sync_mode: 'local-only',
      paired_entity_id: null, widget_layout: null,
    };
    const entity = sqliteRowToEntity(row);
    expect(entity).toMatchObject({
      id: 'e1', title: 'Note', type: 'note', parentId: null, lastModified: 123,
      tags: ['a', 'b'], content: [{ id: 'b1', type: 'text' }],
      syncMode: 'local-only',
    });
  });
});

describe('sqliteRowToTask', () => {
  it('maps a SQLite row back into an AppTask', () => {
    const row = {
      id: 't1', title: 'Task', completed: 1, due_date: null, end_date: null,
      include_time: null, reminder: null, entity_id: null, space_id: null,
      note: null, color: null, priority: null, status: null, position: null,
      created_at: 100, completed_at: null, last_modified: 200, subtasks: null,
      attachments: null, description: null, user_due_date: null, tag: null,
      sync_mode: 'local-only',
    };
    const task = sqliteRowToTask(row);
    expect(task).toMatchObject({ id: 't1', title: 'Task', completed: true, lastModified: 200 });
  });
});

describe('sqliteRowToSpace', () => {
  it('maps a SQLite row back into a Space', () => {
    const row = {
      id: 's1', name: 'Personal', type: 'personal', icon: null, color: null,
      settings: null, is_default: 1, created_at: 50, last_modified: 60,
      sync_mode: 'local-only',
    };
    const space = sqliteRowToSpace(row);
    expect(space).toMatchObject({ id: 's1', name: 'Personal', isDefault: true, lastModified: 60 });
  });
});
