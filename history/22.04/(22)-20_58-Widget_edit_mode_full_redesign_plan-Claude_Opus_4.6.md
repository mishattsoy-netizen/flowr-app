User request: "Analyze Widget edit mode and write plan how to change it, make it logical, fluent and accurate. Take iOS homescreen as an example. Write detailed plan in .md file and wait for me to review it"

## Objective Reconstruction
Perform a comprehensive audit of the current widget edit mode (bento dashboard drag/drop/resize system) and produce a detailed implementation plan to rebuild it with iOS home screen-level precision — covering swapping, push-away, resize reflow, stacking, undo/redo, and all visual feedback.

## Strategic Reasoning
- iOS home screen was chosen as the reference because it's the most universally understood grid editing paradigm — every behavior is deterministic and predictable
- Full code audit was required before planning because the codebase has two parallel drag systems (`useWidgetDrag.ts` which is dead code, and the active RGL-based system in `useBentoLayout.ts`) with several critical bugs
- The plan is structured in 6 phases with clear dependencies to allow incremental implementation without breaking the existing system

## Detailed Blueprint
Analyzed these files in depth:
- `src/hooks/useBentoLayout.ts` — main layout state management (227 lines)
- `src/hooks/useWidgetDrag.ts` — dead code, unused pointer-based drag (164 lines)
- `src/components/bento/BentoDashboard.tsx` — grid component with RGL integration
- `src/components/bento/BentoWidget.tsx` — individual widget wrapper
- `src/components/bento/WidgetPicker.tsx` — side panel for adding widgets
- `src/components/bento/registry.tsx` — widget type registry
- `src/components/bento/types.ts` — BentoLayoutItem type
- `src/lib/bento-collision.ts` — collision detection utilities
- `src/lib/bento-sync.ts` — Supabase/localStorage persistence
- `src/app/globals.css` — edit mode CSS rules
- `src/data/store.types.ts` — old WidgetConfig type (deprecated)

## Operational Trace
1. Read all 11 source files related to the bento/widget system
2. Identified 7 critical bugs in the current implementation
3. Wrote comprehensive plan covering: current state audit, behavior specification matrix, drag lifecycle flowchart, 6 implementation phases, file change summary, and open questions
4. Saved plan to `WIDGET_EDIT_MODE_PLAN.md` at project root

## Status Assessment
- **Completed**: Full analysis and detailed plan written
- **Awaiting**: User review of the plan before any implementation begins
- **Key findings**: Dead code (`useWidgetDrag.ts`), swap logic exchanging sizes instead of just positions, no dwell timer, no undo/redo, broken cascade insertion, overly restrictive 2-unit snapping
