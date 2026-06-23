import { supabase } from '@/lib/supabase';

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
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
  created_at: string;
  attachments?: any[];
}

export async function fetchConversations(): Promise<ChatConversation[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*, messages:messages(id)')
      .eq('is_archived', false)
      .limit(1, { foreignTable: 'messages' })
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('[ChatLib] fetchConversations error:', error);
      return [];
    }
    return (data ?? []) as ChatConversation[];
  } catch (err) {
    console.error('[ChatLib] fetchConversations exception:', err);
    return [];
  }
}

export async function createConversation(title = 'New Chat'): Promise<ChatConversation | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('conversations')
    .insert({ title, user_id: user.id })
    .select()
    .single();
  if (error) throw error;
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
    
    if (m.content) {
      const match = m.content.match(/[\s\S]*?\n\n<!-- ATTACHMENTS_JSON:([\s\S]*?) -->/);
      if (match) {
        try {
          attachments = JSON.parse(match[1]);
          cleanContent = m.content.replace(/\n\n<!-- ATTACHMENTS_JSON:[\s\S]*? -->/, '');
        } catch (e) {
          console.error('Failed to parse attachments JSON from content:', e);
        }
      }
    }
    
    return {
      ...m,
      content: cleanContent,
      attachments,
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
  attachments?: any[]
): Promise<ChatMessage> {
  let finalContent = content;
  if (attachments && attachments.length > 0) {
    finalContent = `${content}\n\n<!-- ATTACHMENTS_JSON:${JSON.stringify(attachments)} -->`;
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
