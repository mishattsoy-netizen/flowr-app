User request: "cards dont display actual workspace or unsorted"

Fix: workspace label in recents card header was only shown when ws was truthy. Changed to always render dot + label, using ws?.name || ''Unsorted'' as fallback. TypeScript 0 errors.
