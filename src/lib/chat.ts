import { supabase } from '@/lib/supabase';

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  space_id?: string;
  messages?: { id: string }[];
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  pipeline_steps?: any;
  image_description?: string;
  image_prompt?: string;
  citations?: string[];
  toolResults?: any[];
  created_at: string;
  attachments?: any[];
}

export async function fetchConversations(spaceId?: string): Promise<ChatConversation[]> {
  if (!supabase) return [];
  try {
    let query = supabase
      .from('conversations')
      .select('*, messages:messages(id)')
      .eq('is_archived', false);

    if (spaceId) {
      query = query.eq('space_id', spaceId);
    }

    const { data, error } = await query
      .limit(1, { foreignTable: 'messages' })
      .order('updated_at', { ascending: false });

    if (error) {
      // If space_id column doesn't exist yet (migration not run), retry without filter
      if (spaceId && (error.message?.includes('space_id') || error.code === 'PGRST204')) {
        console.warn('[ChatLib] space_id column not found, retrying without filter');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('conversations')
          .select('*, messages:messages(id)')
          .eq('is_archived', false)
          .limit(1, { foreignTable: 'messages' })
          .order('updated_at', { ascending: false });
        if (fallbackError) {
          console.error('[ChatLib] fetchConversations fallback error:', fallbackError);
          return [];
        }
        return (fallbackData ?? []) as ChatConversation[];
      }
      console.error('[ChatLib] fetchConversations error:', error);
      return [];
    }
    return (data ?? []) as ChatConversation[];
  } catch (err) {
    console.error('[ChatLib] fetchConversations exception:', err);
    return [];
  }
}

export async function createConversation(title = 'New Chat', spaceId?: string): Promise<ChatConversation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const payload: Record<string, any> = { title, user_id: user.id };
  if (spaceId) payload.space_id = spaceId;
  const { data, error } = await supabase
    .from('conversations')
    .insert(payload)
    .select()
    .single();
  if (error) {
    // If space_id column doesn't exist yet (migration not run), retry without it
    if (spaceId && (error.message?.includes('space_id') || error.code === 'PGRST204')) {
      console.warn('[ChatLib] space_id column not found, retrying create without it');
      const { data: retryData, error: retryError } = await supabase
        .from('conversations')
        .insert({ title, user_id: user.id })
        .select()
        .single();
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
  return data;
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  
  return (data ?? []).map((m: any) => {
    let cleanContent = m.content;
    let attachments: any[] | undefined = undefined;
    let toolResults: any[] | undefined = m.tool_results;
    let pipelineSteps: any[] | undefined = m.pipeline_steps;
    let citations: string[] | undefined = m.citations;
    let intentTag: string | undefined = undefined;
    
    if (m.content) {
      const toolMatch = m.content.match(/[\s\S]*?\n\n<!-- TOOL_RESULTS_JSON:([\s\S]*?) -->/);
      if (toolMatch) {
        try {
          toolResults = JSON.parse(toolMatch[1]);
          cleanContent = cleanContent.replace(/\n\n<!-- TOOL_RESULTS_JSON:[\s\S]*? -->/, '');
        } catch (e) {
          console.error('Failed to parse toolResults JSON from content:', e);
        }
      }

      const pipeMatch = cleanContent.match(/[\s\S]*?\n\n<!-- PIPELINE_STEPS_JSON:([\s\S]*?) -->/);
      if (pipeMatch) {
        try {
          pipelineSteps = JSON.parse(pipeMatch[1]);
          cleanContent = cleanContent.replace(/\n\n<!-- PIPELINE_STEPS_JSON:[\s\S]*? -->/, '');
        } catch (e) {
          console.error('Failed to parse pipelineSteps JSON from content:', e);
        }
      }

      const citMatch = cleanContent.match(/[\s\S]*?\n\n<!-- CITATIONS_JSON:([\s\S]*?) -->/);
      if (citMatch) {
        try {
          citations = JSON.parse(citMatch[1]);
          cleanContent = cleanContent.replace(/\n\n<!-- CITATIONS_JSON:[\s\S]*? -->/, '');
        } catch (e) {
          console.error('Failed to parse citations JSON from content:', e);
        }
      }

      const intentMatch = cleanContent.match(/[\s\S]*?\n\n<!-- INTENT_TAG:([\s\S]*?) -->/);
      if (intentMatch) {
        intentTag = intentMatch[1].trim();
        cleanContent = cleanContent.replace(/\n\n<!-- INTENT_TAG:[\s\S]*? -->/, '');
      }

      const match = cleanContent.match(/[\s\S]*?\n\n<!-- ATTACHMENTS_JSON:([\s\S]*?) -->/);
      if (match) {
        try {
          attachments = JSON.parse(match[1]);
          cleanContent = cleanContent.replace(/\n\n<!-- ATTACHMENTS_JSON:[\s\S]*? -->/, '');
        } catch (e) {
          console.error('Failed to parse attachments JSON from content:', e);
        }
      }
    }
    
    return {
      ...m,
      content: cleanContent,
      attachments,
      toolResults,
      pipelineSteps,
      citations,
      intentTag,
    };
  });
}

export async function insertMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  model?: string,
  pipelineSteps?: any,
  imageDescription?: string,
  imagePrompt?: string,
  attachments?: any[],
  citations?: string[],
  intentTag?: string,
  toolResults?: any[]
): Promise<ChatMessage> {
  let finalContent = content;
  if (attachments && attachments.length > 0) {
    const sanitizedAttachments = attachments.map(att => {
      const { type, url, name, textContent } = att;
      return { type, url, name, textContent };
    });
    finalContent = `${finalContent}\n\n<!-- ATTACHMENTS_JSON:${JSON.stringify(sanitizedAttachments)} -->`;
  }
  
  if (toolResults && toolResults.length > 0) {
    finalContent = `${finalContent}\n\n<!-- TOOL_RESULTS_JSON:${JSON.stringify(toolResults)} -->`;
  }

  if (pipelineSteps && pipelineSteps.length > 0) {
    finalContent = `${finalContent}\n\n<!-- PIPELINE_STEPS_JSON:${JSON.stringify(pipelineSteps)} -->`;
  }

  if (intentTag) {
    finalContent = `${finalContent}\n\n<!-- INTENT_TAG: -->`;
  }

  if (citations && citations.length > 0) {
    finalContent = `${finalContent}\n\n<!-- CITATIONS_JSON:${JSON.stringify(citations)} -->`;
  }

  const insertPayload: Record<string, any> = {
    conversation_id: conversationId,
    role,
    content: finalContent,
    model,
  };
  // Only include extra columns if the table has them (graceful fallback)
  if (pipelineSteps !== undefined) insertPayload.pipeline_steps = pipelineSteps;
  if (imageDescription !== undefined) insertPayload.image_description = imageDescription;
  if (imagePrompt !== undefined) insertPayload.image_prompt = imagePrompt;
  if (citations !== undefined) insertPayload.citations = citations;
  if (toolResults !== undefined) insertPayload.tool_results = toolResults;

  const { data, error } = await supabase
    .from('messages')
    .insert(insertPayload)
    .select()
    .single();
  if (error) {
    // If column doesn't exist error, retry with only guaranteed columns
    if (error.message?.includes('column') || error.code === 'PGRST204') {
      const fallbackPayload = {
        conversation_id: conversationId,
        role,
        content: finalContent,
        model,
      };
      const { data: retryData, error: retryError } = await supabase
        .from('messages')
        .insert(fallbackPayload)
        .select()
        .single();
      if (retryError) throw retryError;
      
      let cleanContent = retryData.content;
      let parsedAttachments: any[] | undefined = undefined;
      if (retryData.content) {
        const match = retryData.content.match(/[\s\S]*?\n\n<!-- ATTACHMENTS_JSON:([\s\S]*?) -->/);
        if (match) {
          try {
            parsedAttachments = JSON.parse(match[1]);
            cleanContent = retryData.content.replace(/\n\n<!-- ATTACHMENTS_JSON:[\s\S]*? -->/, '');
          } catch (e) {
            console.error('Failed to parse attachments JSON from content:', e);
          }
        }
      }
      return {
        ...retryData,
        content: cleanContent,
        attachments: parsedAttachments,
      };
    }
    throw error;
  }

  let cleanContent = data.content;
  let parsedAttachments: any[] | undefined = undefined;
  if (data.content) {
    const match = data.content.match(/[\s\S]*?\n\n<!-- ATTACHMENTS_JSON:([\s\S]*?) -->/);
    if (match) {
      try {
        parsedAttachments = JSON.parse(match[1]);
        cleanContent = data.content.replace(/\n\n<!-- ATTACHMENTS_JSON:[\s\S]*? -->/, '');
      } catch (e) {
        console.error('Failed to parse attachments JSON from content:', e);
      }
    }
  }
  return {
    ...data,
    content: cleanContent,
    attachments: parsedAttachments,
  };
}

