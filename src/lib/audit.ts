import { supabase } from '@/lib/supabase'

type TrackAuditParams = {
  organizationId?: string | null
  tableName: string
  recordId: string
  action: string
  actionCode?: string
  module?: string
  entity?: string
  notes: string
  oldData?: unknown
  newData?: unknown
}

export async function trackAuditAction(params: TrackAuditParams): Promise<void> {
  if (!params.organizationId) return

  try {
    const action = params.actionCode || params.action
    const enrichedNotes = [params.module ? `[${params.module}]` : null, params.notes]
      .filter(Boolean)
      .join(' ')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.rpc as any)('create_audit_log', {
      p_table_name: params.tableName,
      p_record_id: params.recordId,
      p_action: action,
      p_notes: enrichedNotes,
      p_old_data: params.oldData ?? null,
      p_new_data: params.newData ?? null,
      p_organization_id: params.organizationId,
    })
  } catch (error) {
    console.error('Error tracking audit action:', error)
  }
}
