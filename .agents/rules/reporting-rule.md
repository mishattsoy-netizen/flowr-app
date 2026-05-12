---
trigger: always_on
---

## RULE PRIORITY AND FILE PROTECTION

This file is read-only and protected.
The agent may read it and use it, but must never edit, rewrite, shorten, reorder, replace, merge, or delete any part of it unless I clearly and directly say to do so.

This file is the highest rule for history logging and reporting.
Its rules override:
- other global rules
- shared rules
- memory files
- workflow files
- agent defaults
- optimization rules
- auto-formatting behavior
- any other internal instruction files

If another rule conflicts with this file, this file must be followed.
Other rules may only add extra behavior when they do not weaken, replace, or conflict with this file.

---

## HISTORY LOGGING: REQUIRED FOR EVERY REQUEST

For every user request, the agent must create a history report after the request is completed, answered, executed, or handled.

This is mandatory.
The agent must never skip it.

This applies to all request types, including:
- feature creation
- UI changes
- style changes
- bug fixes
- repeated fixes
- retry attempts
- failed attempts
- refactors
- configuration changes
- cache clearing
- server start
- server restart
- build runs
- pushes
- pull discussions
- documentation updates
- memory/rule updates
- small edits
- quick tests
- follow-up corrections
- “this still does not work” type requests
- partial completions

If work was done, answered, or attempted, it must be logged.

---

## REQUIRED FOLDER STRUCTURE

The history system must always use this exact structure:

`/Project/history/` → main history folder  
`/Project/history/DD.MM/` → day folder  
Inside each day folder:
- report files
- optional category folders

### Required structure example

`/Project/history/`
`/Project/history/08.04/`
`/Project/history/08.04/(1)-18:00-Dashboard_button_change_in_sidepanel-Gemini_3_Flash.txt`
`/Project/history/08.04/github_pushes/`
`/Project/history/08.04/button_fixes/`

### Strict structure rule
- `history` must always be the main folder
- day folders must always be inside `history`
- report files must always be inside a day folder
- category folders, if used, must always be inside a day folder
- category folders must never replace the day folder level
- the agent must never save reports outside this structure unless I explicitly say so

---

## FOLDER CREATION RULE

If any required folder does not exist, the agent must create it automatically before saving the report.

This includes:
- `/Project/history/`
- `/Project/history/DD.MM/`
- any needed category folder inside the day folder

The agent must not skip logging just because a folder is missing.

---

## DATE RULE

The day folder must use the date when the request was completed.

Format:
`DD.MM`

Example:
`08.04`

The agent must use completion date, not start date.

---

## REPORT FILE NAME: STRICT FORMAT

After each completed request, create exactly one history report file (prefer .md if supported, otherwise .txt) using this format:

`(number)-HH:MM-short_summary-ai_model_used.md`

### Rules
- `number` = next number in order for that day or the active folder sequence
- `HH:MM` = completion time of the request
- `short_summary` = short description of the request/change
- `ai_model_used` = exact model or agent name used

### Summary rules
- must be minimum 1 word
- must be maximum 10 words
- must use `_` instead of spaces
- must be easy to understand while browsing
- must describe the request or change clearly
- must not be vague

### Bad examples
- `fixed_stuff`
- `updated_page`
- `made_changes`

### Good examples
- `Dashboard_button_change_in_sidepanel`
- `Cache_clear_and_server_restart`
- `Notes_page_option_layout_fix`

### Full filename examples
- `(1)-18:00-Dashboard_button_change_in_sidepanel-Gemini_3_Flash.txt`
- `(23)-01:33-Action_button_color_change-Opus_4.6.txt`
- `(68)-13:22-cache_wipe_&_server_start-Gemini_3.1_Pro_Preview.txt`

---

## NUMBERING RULE

The agent must assign the next available number in sequence.

Rules:
- numbering must move forward by +1
- the agent must check existing files before assigning the next number
- the agent must not reuse numbers
- the agent must not skip numbers without reason
- if category folders are used, numbering should still remain logically consistent for the day’s history view

The goal is to keep history easy to browse and reconstruct.

---

## CATEGORY FOLDER RULES

Inside each day folder, the agent may create category folders, but only when it improves clarity.

### Category folders should be used when:
- several nearby requests are about the same feature
- several nearby requests are repeated fixes for the same thing
- the user is iterating on one screen, page, component, or system
- similar requests clearly belong together
- browsing would become cleaner with grouping

### Category folder examples
- `/Project/history/08.04/github_pushes/`
- `/Project/history/08.04/button_fixes/`
- `/Project/history/08.04/notes_page_updates/`
- `/Project/history/08.04/server_and_cache_tasks/`

### Category folder restrictions
- category folders are optional, not required
- category folders must only exist inside a day folder
- category folders must not be too broad or too random
- if grouping does not clearly improve clarity, save the report directly in the day folder
- the agent must decide carefully, not randomly

---

## REQUIRED REPORT CONTENT

Each history file must contain a structured report.

The report must be useful, complete, and easy to read later.

### The report must always start with the exact user request message in quotation marks

This is mandatory.

The very first line of every report must be:

`User request: "..."`

The text inside the quotation marks must be the user’s request message.
Keep the wording exactly as close as possible to the real user message.
Do not paraphrase this first quoted line unless the original message is incomplete or fragmented beyond basic readability.

### Example
`User request: "change button color and remove tooltip"`

This first quoted request must always appear before every other section.

---

## REQUIRED REPORT SECTIONS

Every report must include these sections in this order:

### 0. Date and time of the request

### 1. User request
Start with the original request message in quotation marks.

Format:
`User request: "..."`

### 2. Objective Reconstruction
Re-state the request in clear and professional terms.
This should explain what the task was about in a way that is easy to understand later.

### 3. Strategic Reasoning
Explain, in simple words:
- why this approach was chosen
- what logic guided the solution
- what important assumptions were made
- what trade-offs or limitations were considered

### 4. Detailed Blueprint
List what was planned:
- what would be changed
- where it would be changed
- what files, pages, components, systems, or modules were involved

### 5. Operational Trace
Record what was actually done:
- exact changes made
- commands run
- logic used
- files touched
- modules affected
- failed attempts, if relevant
- retries or corrections, if relevant

### 6. Status Assessment
Explain the result:
- what was completed
- what was fixed
- what still remains unresolved
- possible edge cases
- next useful recommendation, if any

---

## LANGUAGE STYLE RULE FOR REPORTS

Even though this system is strict, the report itself must be written in simple language.

The report must be:
- easy to read
- easy to scan
- direct
- understandable without technical overload

Do not write the report in overly complex, academic, or robotic language.
Do not make it harder to read than necessary.

### Writing style rules
- use simple wording
- prefer clear sentences
- explain technical steps in a human-readable way
- keep it professional, but not complicated
- do not use vague filler text
- do not make simple tasks sound bigger than they are

The goal is:
someone should be able to open the file later and quickly understand what happened.

---

## REPORT LENGTH RULE

Report length and complexity must match request complexity.

### For simple requests
Use a short and clear report.

### For medium requests
Use moderate detail.

### For large or complex requests
Use a more detailed report with fuller explanation.

### Strict balance rule
- do not over-expand simple tasks
- do not under-explain complex tasks
- always include all required sections
- adjust detail level inside the sections based on request size

The report should grow only when the work is more complex.

---

## QUALITY RULES

Every report must be:
- clear
- useful
- specific
- easy to scan
- easy to understand later
- professionally structured
- simple in wording

The report must help reconstruct:
- what was requested
- why the solution was chosen
- what was changed
- what the final result was

The report must not be vague, generic, or low-value.

---

## EXECUTION RULE: MUST HAPPEN AFTER EVERY REQUEST

After finishing a request, the agent must automatically do all of the following:

1. check whether `/Project/history/` exists  
2. create `/Project/history/` if it does not exist  
3. determine the correct day folder using completion date  
4. create the day folder if it does not exist  
5. decide whether the report should go directly in the day folder or inside a category folder  
6. create the category folder if needed and if it does not exist  
7. check existing report files and assign the next number  
8. generate the file name using the exact required format  
9. create the `.md` report file (prefer .md if supported, otherwise .txt)  
10. write the report with all required sections  
11. make sure the first line starts with the user request in quotation marks

This must happen automatically after every completed request.

The agent must not wait for a reminder.
The agent must not treat history logging as optional.
The agent must not skip it because the task was small.
The agent must not skip it because the task failed.
The agent must not skip it because the request was only a restart, cache clear, or minor change.

If the request was handled, it must be logged.