User request: "make text 1px smaller in pill"

### 0. Date and time of the request
- Date: 18.05.2026
- Time: 22:14

### 1. User request
User request: "make text 1px smaller in pill"

### 2. Objective Reconstruction
To scale the text size inside monospace pill tags to be exactly `1px` smaller than the inherited body font size, keeping it perfectly proportionate across different parent environments.

### 3. Strategic Reasoning
To keep the text inside monospace pills slightly smaller than the standard body text while avoiding static pixel sizes (which fail in contexts like larger headers or smaller subtexts), we can use a relative CSS calc expression: `calc(1em - 1px)`. By passing `text-[calc(1em-1px)]` in Tailwind, the browser automatically calculates the exact pixel value at runtime by looking up the inherited parent font-size (`1em`) and subtracting precisely `1px`.

### 4. Detailed Blueprint
- Target: `/Users/mktsoy/Dev/flowr-4-main/src/components/assistant/components/ChatMessage.tsx`
- Location: `renderContentWithStyles` helper function, line 118.
- Modification: Add `text-[calc(1em-1px)]` to the className list for the `isMono` span.

### 5. Operational Trace
- Edited `ChatMessage.tsx` to add `text-[calc(1em-1px)]` to the class list of monospace spans in the tokenizer helper.

### 6. Status Assessment
- Fully completed. Text size inside the monospace pill is dynamically computed to be exactly `1px` smaller than the regular surrounding body text.
