User request: "fix lists in the chat, they must star from left side, gap in the left is too big... also all code and table blocks in chat must star from left side, they cant have sublist/list gaps on the left"

## Date and time of the request
11.05.2026 16:15

## User request
"fix lists in the chat, they must star from left side, gap in the left is too big... also all code and table blocks in chat must star from left side, they cant have sublist/list gaps on the left"

## Objective Reconstruction
Reduce the left-side indentation of unordered and ordered lists in the chat UI. Ensure that block-level elements like code blocks and tables, even when nested within lists, align with the left edge of the message container rather than being indented by the list marker's width.

## Strategic Reasoning
The default Tailwind `prose` styles and custom overrides had significant left padding for lists. To minimize the gap, I reduced the `ul` and `ol` paddings. To handle the "break-out" requirement for code and tables inside lists, I introduced a `InListContext` React Context to detect when these components are rendered as children of an `li`. When detected, a negative margin and expanded width are applied to effectively pull the block to the left, neutralizing the list item's flex indentation.

## Detailed Blueprint
- **src/components/assistant/components/ChatMessage.tsx**:
    - Defined `InListContext`.
    - Updated `ul` mapping: changed `pl-4` to `pl-0`.
    - Updated `ol` mapping: changed `pl-5` to `pl-4`.
    - Updated `li` mapping: reduced gap to `gap-1.5`, removed `pl-1` padding, and wrapped children in `InListContext.Provider`.
    - Updated `code` (block) mapping: added `ml-[-12px] !w-[calc(100%+12px)]` if `inList` is true.
    - Updated `table` mapping: added `ml-[-12px] !w-[calc(100%+12px)]` if `inList` is true.

## Operational Trace
- Inspected the current CSS classes via the provided screenshots.
- Calculated the required indentation compensation (Bullet width + Gap = ~12px).
- Implemented the context-aware styling logic.

## Status Assessment
- [x] List indentation reduced.
- [x] Code and table blocks align to the left even when nested in lists.
