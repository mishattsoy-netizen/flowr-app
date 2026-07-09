User request: "still doesnt work properly"

### 0. Date and Time
2026-07-07 20:17 UTC (23:17 local, UTC+3)

### 1. User Request
User reported that the AI still doesn't set end dates properly and doesn't convert times to UTC correctly when creating tasks.

### 2. Objective Reconstruction
Fix two bugs in the AI's task creation behavior:
1. The AI was saying "6 PM UTC" instead of converting 6 PM local (UTC+3) to 15:00 UTC
2. The AI was not setting the endDate field at all when the user explicitly asked for an end date

### 3. Strategic Reasoning
Root cause analysis revealed three issues:
- The CRITICAL TIMEZONE RULE in the prompt was too vague
- The prompt didn't include the user's timezone label (e.g. "UTC+3")
- The tools.txt instructions for endDate were too soft ("optional")
- A syntax bug: the closing brace for if(context.clientTime) was accidentally removed

### 4. Detailed Blueprint
- Fix missing closing brace in promptBuilder.ts
- Rewrite the CURRENT CONTEXT block to include: UTC label, explicit conversion formula, worked example
- Add a new "START DATE vs END DATE" rule block to the system prompt
- Strengthen endDate instructions in tools.txt

### 5. Operational Trace
- Fixed missing } closing brace for if(context.clientTime) block
- Added computed utcOffsetHours and utcLabel variables
- Rewrote dateContext template with unambiguous conversion instructions
- Updated tools.txt: dueDate and endDate descriptions now explicitly require endDate when user mentions an end date

### 6. Status Assessment
- Fixed: Syntax error in promptBuilder.ts
- Fixed: AI now receives an unambiguous conversion formula with the user's actual UTC offset
- Fixed: AI now receives explicit instructions that endDate is REQUIRED when user mentions an end date
