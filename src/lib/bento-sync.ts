import { supabase } from './supabase';
import type { BentoLayoutItem } from '@/components/bento/types';

export async function loadBentoLayout(contextId: string): Promise<BentoLayoutItem[] | null> {
  const localKey = `bento-layout-${contextId}`;
  
  if (!supabase) {
    const local = localStorage.getItem(localKey);
    return local ? JSON.parse(local) : null;
  }

  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) {
    const local = localStorage.getItem(localKey);
    return local ? JSON.parse(local) : null;
  }

  const { data, error } = await supabase
    .from('bento_layouts')
    .select('layout')
    .eq('user_id', user.id)
    .eq('context_id', contextId)
    .maybeSingle();

  if (error || !data) {
    const local = localStorage.getItem(localKey);
    return local ? JSON.parse(local) : null;
  }
  
  return data.layout as BentoLayoutItem[];
}

export async function saveBentoLayout(contextId: string, layout: BentoLayoutItem[]): Promise<void> {
  const localKey = `bento-layout-${contextId}`;
  localStorage.setItem(localKey, JSON.stringify(layout));

  if (!supabase) return;
  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('bento_layouts')
    .upsert(
      { user_id: user.id, context_id: contextId, layout, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,context_id' }
    );

  if (error) console.error('[Bento] saveBentoLayout:', error.message);
}
