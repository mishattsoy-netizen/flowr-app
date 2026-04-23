User request: "yes" (execute Phase 1 of WIDGET_EDIT_MODE_PLAN.md)

## Objective Reconstruction
Execute Phase 1 of the widget edit mode redesign: clean foundation. Remove dead code, uninstall react-grid-layout, establish the new row-based data model, add migration for legacy layouts, and update all dependent files to compile cleanly.

## Strategic Reasoning
Phase 1 is purely structural — no visible behavior changes yet. The goal is to clear the runway for Phase 2 (layout engine) and Phase 3 (state machine). All changes were made so the app continues to render widgets (via a transitional flex layout) while the new system is built underneath.

## Detailed Blueprint & Operational Trace

1. **Deleted** `src/hooks/useWidgetDrag.ts` — dead code, wrong types
2. **Deleted** `src/lib/bento-collision.ts` — replaced in Phase 2 by bento-engine
3. **Rewrote** `src/components/bento/types.ts` — new row-based BentoLayoutItem: { i, type, row, order, w, h, data }
4. **Rewrote** `src/components/bento/registry.tsx` — added minW/maxW/minH/maxH per widget, remapped all defaultW to half-column units (2=1col, 3=1.5col, 4=2col, 6=full)
5. **Rewrote** `src/lib/bento-sync.ts` — added migrateLegacyLayout() that auto-converts old {x,y,w,h} 6-col format → new {row,order,w,h} 3-col format on first load
6. **Marked deprecated** in `src/data/store.types.ts` — WidgetType, WidgetSize, WidgetConfig
7. **Rewrote** `src/components/bento/BentoDashboard.tsx` — removed react-grid-layout, replaced with transitional CSS flex row renderer
8. **Rewrote** `src/hooks/useBentoLayout.ts` — row-based state, new default layouts, stubs for Phase 2 drag handlers
9. **Cleaned** `src/app/globals.css` — removed ~90 lines of RGL-specific styles, added lean bento-widget-cell transitions
10. **Uninstalled** react-grid-layout — `npm uninstall react-grid-layout`

## Status Assessment
- **Completed**: All Phase 1 tasks done
- **TypeScript**: 0 bento-related errors. 3 pre-existing errors in admin/AI files (unrelated)
- **App state**: Widgets render in rows via flex layout. Edit mode toggle works. No crashes.
- **Next**: Phase 2 — bento-engine.ts (layout engine with rebalanceRow, calculateSwapLayout, calculatePushLayout, compactLayout, findFirstFit)
