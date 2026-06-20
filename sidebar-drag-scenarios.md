# Sidebar Drag Scenarios

## Layout example

```
WS1 (expanded, has children)     ← depth 0
  Folder A (expanded, has items)  ← depth 1
    Item X                        ← depth 2
  Item Y                          ← depth 1
WS2 (collapsed, no children)     ← depth 0
WS3 (collapsed, no children)     ← depth 0
```

---

## 1. Drop on a container row (workspace / folder / collection)

| Zone | Behavior |
|------|----------|
| Top 25% | Reorder above (same parent) |
| Middle 50% | Nest inside (become child) |
| Bottom 25% | Reorder below (same parent) |

---

## 2. Drop on a regular item row (note / canvas / mixed)

| Zone | Behavior |
|------|----------|
| Top 50% | Reorder above |
| Bottom 50% | Reorder below |

---

## 3. AfterFolderSpacer — gap after an expanded container's children

Rendered as a 2px spacer after every expanded folder/workspace/collection that has children. When hovered during a drag, shows an edge line at the container's depth.

**Behavior:** Insert the dragged item after the container at the container's parent level.

**Example:** gap between Item X and Item Y → insert after Folder A inside WS1.

---

## 4. Top-edge redirect — item directly below an expanded parent

When an item's previous sibling (same parent level) has expanded children, its top edge redirects to: **nest inside the previous sibling as its last child**.

| Scenario | Behavior |
|----------|-------------|
| Top edge of Item Y (below expanded Folder A) | Nest inside Folder A (as its last child). Visual drop line rendered at depth 2 (Folder A's child depth). |
| Top edge of WS2 (below expanded WS1) | Nest inside WS1 (as its last child). Visual drop line rendered at depth 1 (WS1's child depth). |
| Top edge of WS3 (below collapsed WS2) | No redirect — normal top-edge reorder. Visual drop line rendered at parent level (depth 0). |

---

## 5. Gap between two collapsed items (no expanded parent above)

| Scenario | Behavior |
|----------|----------|
| Gap between WS2 and WS3 | No special line — normal edges only |

---

## 6. Pinned section

| Scenario | Behavior |
|----------|----------|
| Drop within pinned section | Reorder pinned items |
| Drop pinned item outside pinned section | Unpin it |
| Drop non-pinned item on pinned section | Pin it |
