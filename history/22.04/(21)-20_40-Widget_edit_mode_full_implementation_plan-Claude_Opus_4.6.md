User request: "Analyze and write detailed plan how to make widget edit mode work properly and logically. So that widgets know when to swap positions, when they should be inserted in the stacked widget, when to push to the side, top or below, how should widget sizes automatically adapt their sizes when repositioning or swapping... all moves should be logical and working properly. Take ios home edit mode as an example"

## Objective Reconstruction
Produce a comprehensive, phase-by-phase implementation plan for rebuilding the widget edit mode drag-and-drop system to behave as intuitively as iOS home screen editing — with logical swapping, pushing, stacking, and adaptive sizing.

## Strategic Reasoning
- The current system has a flat overlap-percentage swap that fires erratically, copies dimensions between widgets (breaking semantics), and has no reflow/push/stack-insert logic.
- iOS-style behavior requires a fundamentally different architecture: a spatial occupancy grid, an intent classifier (swap vs push vs stack-insert), and a preview system.
- Rather than patching the existing broken collision code, the plan proposes replacing it entirely with a purpose-built spatial engine.

## Detailed Blueprint
Analyzed all 7 core files: `useBentoLayout.ts`, `bento-collision.ts`, `BentoDashboard.tsx`, `BentoWidget.tsx`, `GenericStackedWidget.tsx`, `types.ts`, `globals.css`. Documented 8 specific bugs/gaps in the current system. Designed 10 phases covering data model, spatial engine, intent classification, swap, push/reflow, stack insertion, size negotiation, ghost preview, resize reflow, and edge cases.

## Operational Trace
- Read all widget system source files
- Analyzed the existing collision detection, swap logic, and insertion point code
- Studied the react-grid-layout integration and identified conflicts with custom logic
- Wrote comprehensive implementation plan artifact (10 phases, ~400 lines)

## Status Assessment
- **Completed:** Full analysis and detailed implementation plan
- **Artifact:** `IMPLEMENTATION_PLAN_WIDGET_EDIT_MODE.md` — awaiting user review before execution
- **No code changes made** — this is a planning-only deliverable
