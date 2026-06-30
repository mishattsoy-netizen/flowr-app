User request: "all unsorted notes show Personal workspace"

Fix: locationLabel was falling back to ws?.name which is always set (e.g. Personal) for unsorted entities. Removed ws.name fallback. Now: parentEntity?.title || ''Unsorted''. TypeScript 0 errors.
