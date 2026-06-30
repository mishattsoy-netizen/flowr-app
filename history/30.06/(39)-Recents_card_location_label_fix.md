User request: "card location/connection still incorrect. workspace/unsorted"

Root cause: entity.workspaceId maps to the workspace switcher ID (e.g. ws-personal named 'Personal'), not a collection/folder name. Entities nested in a collection have parentId pointing to the collection entity.

Fix: locationLabel now uses parentEntity?.title (collection name) || ws?.name (workspace switcher name) || 'Unsorted'. TypeScript 0 errors.
