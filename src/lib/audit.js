import { base44 } from '@/api/base44Client';

/**
 * Write an audit log entry.
 * @param {string} jobId
 * @param {string} action  - one of the AuditLog action enum values
 * @param {string} actor   - e.g. 'Admin', 'Customer', 'System'
 * @param {string} [detail] - optional free-text detail
 */
export async function logAudit(jobId, action, actor = 'System', detail = '') {
  await base44.entities.AuditLog.create({
    job_id: jobId,
    action,
    actor,
    detail: detail || undefined,
    timestamp: new Date().toISOString(),
  });
}

export const ACTION_LABELS = {
  job_created:        { label: 'Job Created',             color: 'text-primary' },
  job_edited:         { label: 'Job Edited',              color: 'text-foreground' },
  imported_from_csv:  { label: 'Imported from CSV',       color: 'text-primary' },
  signature_submitted:{ label: 'Signature Submitted',     color: 'text-green-600' },
  review_link_opened: { label: 'Google Review Opened',    color: 'text-foreground' },
  record_archived:    { label: 'Record Archived',         color: 'text-amber-600' },
  record_unlocked:    { label: 'Record Unlocked by Admin',color: 'text-destructive' },
  post_sign_edit:     { label: 'Edited After Signing',    color: 'text-destructive' },
  status_changed:     { label: 'Status Changed',          color: 'text-foreground' },
};