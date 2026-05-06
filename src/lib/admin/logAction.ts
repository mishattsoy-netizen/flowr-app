import { supabaseAdmin as supabase } from '@/lib/supabase'

export type AdminActionType =
  | 'settings_saved'
  | 'brain_entry_added'
  | 'brain_entry_updated'
  | 'brain_entry_deleted'
  | 'plan_accepted'
  | 'plan_rejected'
  | 'plan_edited'
  | 'plan_deleted'
  | 'routine_ran'
  | 'prompt_synced'
  | 'router_changed'
  | 'preset_changed'
  | 'user_blocked'
  | 'user_unblocked'
  | 'logs_purged'
  | 'vault_updated'
  | 'bulk_plans_deleted'

export async function logAdminAction(
  actionType: AdminActionType,
  description: string,
  details?: Record<string, unknown>
): Promise<void> {
  // Fire-and-forget: never throw, never block the caller
  supabase
    .from('admin_activity_log')
    .insert({ action_type: actionType, description, details: details ?? null })
    .then(({ error }: { error: any }) => {
      if (error) console.warn('[logAdminAction] failed:', error.message)
    })
}
