User request: "good now make box preview bigger, and corners less round. also remove white border from cards on hover and make card corners smaller as well"

Date/Time: 2026-06-30 21:43

Changes made (Dashboard.tsx):
1. Canvas preview box: h-[70px] -> h-[90px], rounded-lg -> rounded (both empty and filled states)
2. targetH constant updated: 70-12 -> 90-12 (keeps block positions centred in larger box)
3. Card button: removed hover:border-[var(--bone-20)] (no border highlight on hover)
4. Card button: rounded-[var(--radius-big)] -> rounded-xl (smaller corners)

Status: TypeScript 0 errors.
