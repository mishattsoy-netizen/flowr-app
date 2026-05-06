User request: "pinned and unsorted dissapeared"

## Objective Reconstruction
The objective was to fix a regression in the Sidebar where the "Pinned" and "Unsorted" sections were hidden from view after the previous state management optimization.

## Strategic Reasoning
In the previous optimization, we introduced "Stable Display Lists" (`displayFavorites`, etc.) to decouple rendering from high-frequency store updates. However, the conditional rendering logic (`if (array.length === 0) return null`) was still referencing the local state variables (`favoriteEntities`, etc.), which are initialized to empty arrays and only populated during an active drag-and-drop operation. This caused the sections to be hidden during normal use.

## Detailed Blueprint
- **Sidebar.tsx**:
    - Update the visibility checks for the 'favorites' and 'unsorted' sections to use `displayFavorites.length` and `displayUnsorted.length`.

## Operational Trace
1.  Modified `src/components/layout/Sidebar.tsx`:
    - Changed `favoriteEntities.length` check to `displayFavorites.length`.
    - Changed `unsortedEntities.length` check to `displayUnsorted.length`.

## Status Assessment
- **Visibility:** Fixed. The sections should now be visible whenever they contain items.
- **Performance:** The optimization from the previous turn (eliminating the update loop) remains intact.
