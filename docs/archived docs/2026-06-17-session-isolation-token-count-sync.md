# Session Isolation, Token Counting, and Cloud Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Isolate message bars, active inputs, and response generation states per chat session; compute stable and accurate context token counts; and ensure chat states are correctly synced and restored from the cloud.

**Architecture:** We will transition Zustand's active input text, loading indicators, and abort controllers to be keyed by `chatId`. We will update the background streaming loop to commit data to the target chat that initiated the request rather than the dynamic active chat, preventing cross-chat leakage. Finally, we will refactor token counting to reflect the exact context size sent to the model (summary size + active messages) rather than accumulating system prompts and double-counting turns.

**Tech Stack:** Next.js, React, Zustand, Supabase (DB/Auth), TypeScript.

---

## Proposed Changes

### Zustand Store Configuration

#### [MODIFY] [store.types.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.types.ts)
- Add state definitions for per-chat maps:
  - `chatInputs: Record<string, string>`
  - `loadingStatesMap: Record<string, boolean>`
  - `abortControllersMap: Record<string, AbortController | null>`
  - `chatMessagesMap: Record<string, AIMessage[]>`
  - `sessionContextsMap: Record<string, any>`

#### [MODIFY] [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts)
- Initialize the maps in `persist` configuration.
- Update `setAssistantInput`, `stopAIGeneration`, `finishAILoading`, `sendAIMessage` to read/write to the maps.
- Update `loadConversation`, `startNewChat`, and `startTempChat` to restore active states from the maps for the newly selected chat ID.
- Avoid calling `fetchMessages` if the chat is actively generating, and instead restore from `chatMessagesMap` to prevent losing the active streaming state.

---

### UI Component Isolation

#### [MODIFY] [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx)
- Update dynamic token counting calculation `displayedTokens` to be completely stable and correct: sum `distilled_summary` size plus active history size, counting images/PDFs as a fixed 258 tokens per attachment.

---

### Backend Logic & Router

#### [MODIFY] [chainRouter.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/chainRouter.ts)
- Update `token_usage_total` persistence to save the exact active context size (including 258 tokens per image/PDF attachment) rather than accumulating prompts and system instructions.

---

## Detailed Tasks

### Task 1: Add Per-Chat UI State Mapping in Zustand Store

**Files:**
- Modify: [store.types.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.types.ts)
- Modify: [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts)

**Step 1: Add new type definitions in `store.types.ts`**
Add the following fields inside the `AppState` interface in [store.types.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.types.ts):
```typescript
  chatInputs: Record<string, string>;
  loadingStatesMap: Record<string, boolean>;
  abortControllersMap: Record<string, AbortController | null>;
  chatMessagesMap: Record<string, AIMessage[]>;
  sessionContextsMap: Record<string, any>;
```

**Step 2: Initialize maps in `store.ts`**
In [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts) (around line 320-333), initialize:
```typescript
      chatInputs: {},
      loadingStatesMap: {},
      abortControllersMap: {},
      chatMessagesMap: {},
      sessionContextsMap: {},
```

**Step 3: Update store actions to handle per-chat states**
Update the following actions in [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts):
- `setAssistantInput(input)`:
  ```typescript
  setAssistantInput: (input) => {
    const { activeChatId, activeEntityId, isTempChat } = get();
    const sid = activeChatId || activeEntityId || (isTempChat ? 'temp' : 'global');
    set(s => ({
      assistantInput: input,
      chatInputs: { ...s.chatInputs, [sid]: input }
    }));
  },
  ```
- `loadConversation(id)`:
  ```typescript
  loadConversation: async (id: string) => {
    // If the chat is currently generating, DO NOT fetch/overwrite messages from database.
    // This preserves the active streaming status.
    const isGenerating = get().loadingStatesMap[id] || false;
    if (isGenerating) {
      set({
        activeChatId: id,
        isTempChat: false,
        tempChatMessages: [],
        aiMessages: get().chatMessagesMap[id] || [],
        aiSessionContext: get().sessionContextsMap[id] || null,
        pendingAdvisorState: null,
        assistantInput: get().chatInputs[id] || '',
        isAILoading: true,
        aiAbortController: get().abortControllersMap[id] || null,
      });
      return;
    }

    try {
      const msgs = await fetchMessages(id);
      const aiMsgs = msgs.map(m => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        model: m.model,
        timestamp: new Date(m.created_at).getTime(),
        pipelineSteps: m.pipeline_steps,
        image_description: m.image_description,
        image_prompt: m.image_prompt,
        attachments: m.attachments,
      }));
      set(s => ({
        activeChatId: id,
        isTempChat: false,
        tempChatMessages: [],
        aiMessages: aiMsgs,
        chatMessagesMap: { ...s.chatMessagesMap, [id]: aiMsgs },
        aiSessionContext: s.sessionContextsMap[id] || null,
        pendingAdvisorState: null,
        assistantInput: s.chatInputs[id] || '',
        isAILoading: false,
        aiAbortController: null,
      }));
      get().fetchAISessionContext(id);
    } catch (e) {
      console.error('Failed to load conversation', e);
    }
  },
  ```
- `startTempChat()`:
  ```typescript
  startTempChat: () => {
    const sid = 'temp';
    set(s => ({
      activeChatId: null,
      isTempChat: true,
      tempChatMessages: [],
      aiMessages: s.chatMessagesMap[sid] || [],
      aiSessionContext: s.sessionContextsMap[sid] || null,
      pendingAdvisorState: null,
      assistantInput: s.chatInputs[sid] || '',
      isAILoading: s.loadingStatesMap[sid] || false,
      aiAbortController: s.abortControllersMap[sid] || null,
    }));
  },
  ```
- `startNewChat()`:
  ```typescript
  // Inside startNewChat success path:
  set({
    activeChatId: conv.id,
    isTempChat: false,
    tempChatMessages: [],
    aiMessages: [],
    aiSessionContext: null,
    pendingAdvisorState: null,
    assistantInput: '',
    isAILoading: false,
    aiAbortController: null,
    chatConversations: [conv, ...get().chatConversations],
  });
  ```

---

### Task 2: Isolate Background Message Streaming and Loading States

**Files:**
- Modify: [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts)

**Step 1: Capture targetChatId and map loading states**
Modify `sendAIMessage` in [store.ts](file:///Users/mktsoy/Dev/flowr-app/src/data/store.ts) to:
- Capture the `targetChatId = activeChatId || activeEntityId || (isTemp ? 'temp' : 'global')` at start.
- Update maps when loading state changes:
  ```typescript
  // At the start of sendAIMessage:
  const isTemp = get().isTempChat;
  const activeChatId = get().activeChatId;
  const targetChatId = activeChatId || get().activeEntityId || (isTemp ? 'temp' : 'global');

  set(s => ({
    aiMessages: [...aiMessages, userMessage, placeholderMessage],
    ...(isTemp ? { tempChatMessages: [...aiMessages, userMessage, placeholderMessage] } : {}),
    chatMessagesMap: {
      ...s.chatMessagesMap,
      [targetChatId]: [...(s.chatMessagesMap[targetChatId] || []), userMessage, placeholderMessage]
    },
    activeReplyMessage: null,
    isAILoading: true,
    loadingStatesMap: { ...s.loadingStatesMap, [targetChatId]: true },
  }));
  ```

**Step 2: Track AbortController per chat**
In `sendAIMessage`, when assigning `aiAbortController`:
```typescript
  const controller = new AbortController();
  set(s => ({
    aiAbortController: controller,
    abortControllersMap: { ...s.abortControllersMap, [targetChatId]: controller }
  }));
```

**Step 3: Update stream updates in `sendAIMessage` to check active state**
Inside the decoder read loop (`flushUpdate`), update both `chatMessagesMap[targetChatId]` and `aiMessages`:
```typescript
  const flushUpdate = () => {
    flushTimer = null;
    const contentToSet = pendingContent;
    set((s) => {
      const updatedMessages = (s.chatMessagesMap[targetChatId] || []).map((m) =>
        m.id === placeholderMessage.id
          ? {
              ...m,
              content: contentToSet,
              model: lastModel || m.model,
              tokens_used: Math.ceil((content.length + contentToSet.length) / 4),
              image_description: lastImageDescription ?? m.image_description,
              image_prompt: lastImagePrompt ?? (m as any).image_prompt,
              pipelineSteps: lastPipelineSteps ?? m.pipelineSteps,
              classification_trace: lastClassificationTrace ?? m.classification_trace,
              routing_trace: lastRoutingTrace ?? m.routing_trace,
              logId: lastLogId ?? m.logId,
              citations: lastCitations ?? m.citations,
              transcript_md: lastTranscriptMd ?? (m as any).transcript_md,
              toolResults: lastToolResults ?? (m as any).toolResults,
              advisor_questions: lastAdvisorQuestions ?? (m as any).advisor_questions,
              advisor_state: lastAdvisorState ?? (m as any).advisor_state,
            }
          : m
      );

      const nextMap = { ...s.chatMessagesMap, [targetChatId]: updatedMessages };
      const currentActiveId = s.activeChatId || s.activeEntityId || (s.isTempChat ? 'temp' : 'global');
      const isActive = currentActiveId === targetChatId;

      return {
        chatMessagesMap: nextMap,
        ...(isActive ? { aiMessages: updatedMessages } : {}),
        ...(s.isTempChat ? {
          tempChatMessages: updatedMessages
        } : {}),
      };
    });
  };
```

**Step 4: Update final persistence and finish loading**
Update `finishAILoading`:
```typescript
  finishAILoading: async () => {
    const { activeChatId, activeEntityId, isTempChat } = get();
    const sid = activeChatId || activeEntityId || (isTempChat ? 'temp' : 'global');
    set(s => ({
      isAILoading: false,
      aiAbortController: null,
      loadingStatesMap: { ...s.loadingStatesMap, [sid]: false },
      abortControllersMap: { ...s.abortControllersMap, [sid]: null }
    }));
    // ... compaction checks
  }
  ```
- Update final database message insertion:
  ```typescript
  // Persist assistant reply
  if (activeChatId && !isTemp && accumulatedContent) {
    insertMessage(activeChatId, 'assistant', accumulatedContent, lastModel, lastPipelineSteps, lastImageDescription, lastImagePrompt)
      .catch(e => console.warn('[Store] Failed to persist assistant message:', e));
  }
  ```
- Update `stopAIGeneration`:
  ```typescript
  stopAIGeneration: () => {
    const { activeChatId, activeEntityId, isTempChat, abortControllersMap } = get();
    const sid = activeChatId || activeEntityId || (isTempChat ? 'temp' : 'global');
    const controller = abortControllersMap[sid];
    if (controller) {
      controller.abort();
      set(s => ({
        isAILoading: false,
        aiAbortController: null,
        loadingStatesMap: { ...s.loadingStatesMap, [sid]: false },
        abortControllersMap: { ...s.abortControllersMap, [sid]: null }
      }));
    }
  },
  ```

---

### Task 3: Refactor Token Counting on Client and Server

**Files:**
- Modify: [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx)
- Modify: [chainRouter.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/chainRouter.ts)

**Step 1: Simplify client-side `displayedTokens` calculation**
In [AIAssistant.tsx](file:///Users/mktsoy/Dev/flowr-app/src/components/assistant/AIAssistant.tsx) (around line 171-196), replace `localTokenEstimate` and `displayedTokens` with a clean, dynamic calculation:
```typescript
  const displayedTokens = (() => {
    const summary = aiSessionContext?.distilled_summary;
    const summaryTokens = summary ? Math.ceil(summary.length / 4) : 0;
    
    let chars = 0;
    let imageTokens = 0;
    const filteredMsgs = aiMessages.filter(m => m.role === 'user' || m.role === 'assistant');
    const messagesToCount = summary ? filteredMsgs.slice(-5) : filteredMsgs;

    for (const m of messagesToCount) {
      let text = (m.content || '').includes('data:image/')
        ? (m.content || '').replace(/!\[.*?\]\s*\(\s*data:image\/.*?;base64,[\s\S]*?\)/g, m.image_description ? `[Image: ${m.image_description}]` : '[Image: (visual content generated)]')
        : (m.content || '');
      if (m.role === 'user' && m.image_description) {
        text = `${text}\n\n[VISION CONTEXT - DIGITAL TWIN]\n${m.image_description}`;
      } else if (m.role === 'user' && !m.image_description && m.attachments?.some(a => a.type === 'image' || a.type === 'pdf')) {
        text = `${text}\n[Image attached]`;
      }
      
      const imageCount = m.attachments?.filter(a => a.type === 'image' || a.type === 'pdf').length || 0;
      imageTokens += imageCount * 258;
      chars += text.length;
    }
    return summaryTokens + Math.ceil(chars / 4) + imageTokens;
  })();
```

**Step 2: Update server-side token stats update in `chainRouter.ts`**
In [chainRouter.ts](file:///Users/mktsoy/Dev/flowr-app/src/lib/bot/chainRouter.ts) (around line 1439-1446), replace the accumulation logic with active context calculations:
```typescript
              // 4. Update session token statistics (active context size only, system prompt excluded)
              const historyWithResponse = [
                ...historyForChain,
                { role: 'model', parts: [{ text: finalContent || '' }] }
              ];
              
              let activeHistoryText = '';
              let activeImageCount = 0;
              const limitHistory = currentSummary ? historyWithResponse.slice(-5) : historyWithResponse;
              for (const h of limitHistory) {
                const partText = h.parts?.[0]?.text || h.content || '';
                activeHistoryText += partText;
                
                // Count attachments in this history item
                if (h.attachments) {
                  activeImageCount += h.attachments.filter((a: any) => a.type === 'image' || a.type === 'pdf').length;
                }
              }
              
              const summaryTokens = currentSummary ? estimateTokens(currentSummary) : 0;
              const totalActiveUsage = summaryTokens + estimateTokens(activeHistoryText) + (activeImageCount * 258);
              
              await updateSessionState(sessionId, {
                token_usage_total: totalActiveUsage,
              });
```

---

## Verification Plan

### Automated Tests
Currently, TypeScript compiles Next.js successfully. We will monitor `npm run dev` compilation status after edits.

### Manual Verification
1. **Message Bar Isolation:**
   - Open a chat and send a message. Verify that the loading status shows a "Stop" button.
   - Switch to a new chat. Verify that the new chat shows a normal text input message bar with a "Send" button (not "Stop").
   - Switch back to the first chat. Verify that the loading status and active generation have continued in the background and show the bot's response.
2. **Token Count Accuracy:**
   - Send several messages back and forth. Verify that the token meter increases linearly.
   - Run compaction and check that the token count drops down to the size of the summary plus the last 5 messages, and remains stable when sending follow-up messages.
3. **Session State Sync:**
   - Reload/refresh the page or change chats and return. Verify that the token meter instantly restores to the correct value and doesn't flicker or load values from other chats.
