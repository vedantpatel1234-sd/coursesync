import { supabase } from './supabase'

type AuditAction =
  | 'assignment_created'
  | 'assignment_removed'
  | 'course_created'
  | 'course_deleted'
  | 'section_created'
  | 'section_deleted'
  | 'instructor_created'
  | 'instructor_deleted'
  | 'draft_created'
  | 'draft_published'
  | 'draft_deleted'
  | 'qualifications_updated'
  | 'preferences_saved'

export async function logAction(
  userId: string,
  action: AuditAction,
  entity: string,
  entityId?: string,
  details?: Record<string, any>
) {
  const { error } = await supabase.from('audit_logs').insert({
    user_id: userId,
    action,
    entity,
    entity_id: entityId ?? null,
    details: details ?? null,
  })
  if (error) console.error('Audit log failed:', error.message)
}