# Chat Message Replying & Context-Aware Routing Implementation Plan

> **For Claude / Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the ability to reply to/mention any message in the chat (similar to Telegram/WhatsApp), showing a preview banner, smoothly scrolling & pulsing the row upon click, and passing specialized focus context to both the intent classifier and the routed model.

**Architecture:** 
1. **Frontend State & Actions**: Add `activeReplyMessage` state and `setReplyMessage` action to Zustand.
2. **UI Components**: Render reply buttons next to assistant/user messages. Display a reply preview bar above the text area, scrolling to the referenced message and triggering a `reply-flash` animation.
3. **Payload & Focus Context**: Construct a 3-message "attention segment" (previous, replied, next) on the frontend. Pass both full history and this specialized reply context to the backend.
4. **Classifier & Router Integration**: Format and inject the attention segment into the prompt of the intent classifier and the execution models so they maintain focus on the referenced message while preserving overall conversation context.

---

### Task 1: Zustand Store Updates
**Files:**
- Modify: `src/data/store.types.ts`
- Modify: `src/data/store.ts`

**Step 1: Write state and action types**
In `src/data/store.types.ts`, add `activeReplyMessage` and `setReplyMessage` to the `AppState` interface:
```typescript
activeReplyMessage: AIMessage | null;
setReplyMessage: (msg: AIMessage | null) => void;
```

**Step 2: Implement state and actions**
In `src/data/store.ts`, initialize the state and define the action:
```typescript
activeReplyMessage: null,
setReplyMessage: (msg) => set({ activeReplyMessage: msg }),
```

---

### Task 2: UI - Add Reply Buttons to Message Rows
**Files:**
- Modify: `src/components/assistant/components/ChatMessage.tsx`

**Step 1: Accept the onReply callback**
Update `ChatMessage` parameters to receive `onReply: (msg: AIMessage) => void`:
```typescript
export const ChatMessage = memo(({
  msg,
  isAILoading,
  isLast,
  scrollToBottom,
  handleAddImageToWorkspace,
  onRegenerate,
  onReply
}: {
  msg: AIMessage;
  isAILoading: boolean;
  isLast: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  handleAddImageToWorkspace: (url: string) => void;
  onRegenerate?: () => void;
  onReply: (msg: AIMessage) => void;
}) => {
```

**Step 2: Render reply button for Assistant messages**
Next to the copy/like buttons under assistant responses (around line 538-548), render a reply button using Lucide's `CornerUpLeft` icon:
```tsx
<Tooltip content="Reply">
  <button
    onClick={() => onReply(msg)}
    className="p-0.5 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-foreground transition-colors"
  >
    <CornerUpLeft strokeWidth={2} className="w-3 h-3" />
  </button>
</Tooltip>
```

**Step 3: Render reply button for User messages**
For user messages (rendered in the `msg.role === 'user'` block around line 420), render a reply button on the left of the user message pill, visible only on hover (`opacity-0 group-hover:opacity-100`):
```tsx
<div className="flex items-center gap-1.5 self-center mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
  <Tooltip content="Reply">
    <button
      onClick={() => onReply(msg)}
      className="p-1 rounded-md hover:bg-[var(--bone-6)] text-[var(--bone-30)] hover:text-foreground transition-colors"
    >
      <CornerUpLeft strokeWidth={2} className="w-3.5 h-3.5" />
    </button>
  </Tooltip>
</div>
```

---

### Task 3: UI - Reply Preview Banner, Scroll, and Flash row
**Files:**
- Modify: `src/components/assistant/AIAssistant.tsx`
- Modify: `src/app/globals.css` (or `src/index.css`)

**Step 1: Add row IDs and passing the onReply callback**
In `AIAssistant.tsx`, pass `id={`msg-row-${msg.id}`}` and `onReply={setReplyMessage}` to `ChatMessage` inside the messages list rendering (around line 542):
```tsx
<div id={`msg-row-${msg.id}`} className="w-full">
  <ChatMessage
    msg={msg}
    isAILoading={idx === filtered.length - 1 ? isAILoading : false}
    isLast={idx === filtered.length - 1}
    scrollToBottom={scrollToBottom}
    handleAddImageToWorkspace={handleAddImageToWorkspace}
    onRegenerate={() => {
      const lastUserMsg = [...filtered.slice(0, idx + 1)].reverse().find(m => m.role === 'user');
      if (lastUserMsg) handleSend(lastUserMsg.content, lastUserMsg.attachments);
    }}
    onReply={setReplyMessage}
  />
</div>
```

**Step 2: Render reply preview banner**
Above the main text area container inside `AIAssistant.tsx` (around line 590), display the reply preview banner if `activeReplyMessage` is set:
```tsx
{activeReplyMessage && (
  <div className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/5 rounded-xl mb-2 animate-in fade-in slide-in-from-bottom-2">
    <button
      onClick={() => {
        const el = document.getElementById(`msg-row-${activeReplyMessage.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('reply-flash');
          setTimeout(() => el.classList.remove('reply-flash'), 1500);
        }
      }}
      className="flex flex-col items-start text-left min-w-0 flex-1 pr-4"
    >
      <span className="text-[9px] font-bold uppercase tracking-wider text-accent">
        Replying to {activeReplyMessage.role === 'user' ? 'You' : 'Agent'}
      </span>
      <span className="text-[11px] text-bone-60 truncate w-full">
        {activeReplyMessage.content}
      </span>
    </button>
    <button
      onClick={() => setReplyMessage(null)}
      className="p-1 rounded-md hover:bg-white/5 text-bone-60 hover:text-foreground"
    >
      <X strokeWidth={2} className="w-3.5 h-3.5" />
    </button>
  </div>
)}
```

**Step 3: Define flash CSS animation**
In `src/app/globals.css`, add the `.reply-flash` classes:
```css
@keyframes reply-flash {
  0% { background-color: rgba(var(--accent-rgb), 0.2); }
  50% { background-color: rgba(var(--accent-rgb), 0.1); }
  100% { background-color: transparent; }
}
.reply-flash {
  animation: reply-flash 1.5s ease-out;
  border-radius: 12px;
}
```

---

### Task 4: Frontend State - Context Segment Payload Generation
**Files:**
- Modify: `src/data/store.ts`

**Step 1: Construct the focus segment and include in sendAIMessage**
Inside `sendAIMessage` in `src/data/store.ts` (around line 370), build the `replyContext` when `activeReplyMessage` is set, and clear the reply state upon dispatch:
```typescript
let replyMessageId = null;
let replyContext = null;

if (activeReplyMessage) {
  replyMessageId = activeReplyMessage.id;
  const filtered = aiMessages.filter(m => m.role === 'user' || m.role === 'assistant');
  const idx = filtered.findIndex(m => m.id === activeReplyMessage.id);
  if (idx !== -1) {
    // Extract replied message, message directly before, and message directly after
    replyContext = filtered.slice(Math.max(0, idx - 1), idx + 2).map(m => ({
      role: m.role,
      content: m.content
    }));
  }
  // Clear reply state immediately
  set({ activeReplyMessage: null });
}
```

Add `replyMessageId` and `replyContext` to the `/api/ai/chat` request payload:
```typescript
const res = await fetch('/api/ai/chat', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    prompt: content,
    buffer: imageBuffer,
    activeEntityId: get().activeEntityId,
    aiApiKey: get().aiApiKey,
    activeWorkspaceId: get().activeWorkspaceId,
    classificationModelId: get().aiClassificationModelId,
    mode: get().activeMode,
    intentTag: get().activeIntentTag ?? null,
    replyMessageId,
    replyContext
  }),
});
```

---

### Task 5: Backend Route - Read Payload and Pass to Routing
**Files:**
- Modify: `src/app/api/ai/chat/route.ts`

**Step 1: Read new request parameters**
Extract `replyMessageId` and `replyContext` from the JSON request (around line 55):
```typescript
const { prompt, buffer, aiApiKey, activeEntityId, activeWorkspaceId, classificationModelId, mode, intentTag, replyMessageId, replyContext } = await req.json()
```

**Step 2: Pass reply parameters and sliced history to classifyIntentWithModel**
Pass the last 3 rounds of history (`ollamaHistory.slice(-6)`) and `replyContext` to the classifier call (around line 78):
```typescript
const { category: rawCategory } = await classifyIntentWithModel(
  prompt, 
  aiApiKey, 
  classificationModelId, 
  activeMode, 
  intentTag ?? null, 
  replyContext, 
  ollamaHistory.slice(-6)
)
```

---

### Task 6: Classifier and Routing Context Injection
**Files:**
- Modify: `src/lib/bot/classifier.ts`
- Modify: `src/lib/bot/chainRouter.ts`

**Step 1: Update classifier signature and context formatting**
Update `classifyIntentWithModel` in `src/lib/bot/classifier.ts` to accept both history and reply context:
```typescript
export async function classifyIntentWithModel(
  message: string,
  apiKey: string | null,
  customModelId?: string,
  mode: string = 'default',
  intentTag: string | null = null,
  replyContext?: any[] | null,
  history?: any[] | null
) {
```

Inside `classifyIntentWithModel`, format and inject both standard recent history and the `[SPECIAL ATTENTION]` block into the classification prompt:
```typescript
let contextPrefix = "";

// 1. Add standard recent history (last 3 rounds)
if (history && history.length > 0) {
  const formattedHistory = history.map(msg => {
    const text = msg.parts?.[0]?.text || msg.content || '';
    return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${text}`;
  }).join('\n');
  contextPrefix += `[RECENT CONVERSATION HISTORY]\n${formattedHistory}\n\n`;
}

// 2. Add [SPECIAL ATTENTION] reply focus block
if (replyContext && replyContext.length > 0) {
  const formattedReply = replyContext.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
  contextPrefix += `[SPECIAL ATTENTION: USER IS REPLYING TO THE FOLLOWING MESSAGE SEGMENT]\n${formattedReply}\nAlways prioritize resolving and classifying the latest User Message based on this specific referenced segment.\n\n`;
}

const finalPrompt = `${DEFAULT_CLASSIFICATION_PROMPT}\n\n${contextPrefix}User Message: ${message}`;
```

**Step 2: Feed contextual focus instruction to the execution models**
Inside `runChain` in `src/lib/bot/chainRouter.ts` or in `route.ts`, if `replyContext` is present, prepend the focus segment to the model's instructions so it resolves references (e.g. "one more") precisely:
```typescript
if (replyContext && replyContext.length > 0) {
  const formattedReply = replyContext.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n');
  system_prompt = `[SPECIAL ATTENTION: USER IS REPLYING TO THE FOLLOWING MESSAGES]\n${formattedReply}\nFocus your answer specifically on resolving or continuing this reference.\n\n${system_prompt || ''}`;
}
```

---

### Task 7: Verification
1. Open the AI Assistant side panel.
2. Type an initial message (e.g., `generate image in cyberpunk style`).
3. Hover over the generated image/message and click the newly added Reply icon.
4. Verify that the reply preview banner is shown above the message bar with the correct text.
5. Type `one more` in the message bar and hit Send.
6. Verify that:
   - The classifier correctly selects `IMAGE_GEN` (instead of `FAST_SIMPLE` text chat).
   - The model generates another cyberpunk image focused on your reply.
7. Click the Reply preview text and verify the smooth scroll and soft Horizontal Row pulse animation.
