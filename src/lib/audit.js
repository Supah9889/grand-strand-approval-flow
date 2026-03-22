import { base44 } from '@/api/base44Client';
import { getInternalRole } from './adminAuth';

/**
 * Central audit logging function.
 * Supports all modules with structured old/new values, reason, and sensitivity flags.
 */
export async function logAudit(recordIdOrJobId, action, actor = 'System', detail = '', opts = {}) {
  const {
    module = 'job',
    record_id,
    job_id,
    job_address,
    actor_role,
    old_value,
    new_value,
    reason,
    is_override = false,
    is_sensitive = false,
  } = opts;

  // Backwards-compatible: first arg used to be jobId
  const resolvedJobId = job_id || (module === 'job' ? recordIdOrJobId : undefined);
  const resolvedRecordId = record_id || recordIdOrJobId;

  const sensitiveActions = [
    'record_unlocked','post_sign_edit','override_action','financial_edit',
    'payment_recorded','payment_edited','invoice_status_changed',
    'time_entry_edited','co_approved','co_rejected','portal_access_granted',
    'portal_access_revoked','permission_change','budget_edited',
  ];

  await base44.entities.AuditLog.create({
    module,
    record_id: resolvedRecordId,
    job_id: resolvedJobId,
    job_address: job_address || undefined,
    action,
    actor,
    actor_role: actor_role || getInternalRole() || 'system',
    detail: detail || undefined,
    old_value: old_value ? (typeof old_value === 'object' ? JSON.stringify(old_value) : old_value) : undefined,
    new_value: new_value ? (typeof new_value === 'object' ? JSON.stringify(new_value) : new_value) : undefined,
    reason: reason || undefined,
    is_override,
    is_sensitive: is_sensitive || sensitiveActions.includes(action),
    timestamp: new Date().toISOString(),
  });
}

// Convenience shortcuts for common modules
export const audit = {
  job: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'job', record_id: id, job_id: id, ...opts }),
  signature: (jobId, actor, detail, opts = {}) => logAudit(jobId, 'signature_submitted', actor, detail, { module: 'signature', record_id: jobId, job_id: jobId, is_sensitive: true, ...opts }),
  unlock: (jobId, actor, reason) => logAudit(jobId, 'record_unlocked', actor, `Admin unlocked record`, { module: 'job', record_id: jobId, job_id: jobId, is_override: true, is_sensitive: true, reason }),
  timeEntry: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'time_entry', record_id: id, is_sensitive: action === 'time_entry_edited', ...opts }),
  invoice: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'invoice', record_id: id, is_sensitive: true, ...opts }),
  payment: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'payment', record_id: id, is_sensitive: true, ...opts }),
  changeOrder: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'change_order', record_id: id, is_sensitive: ['co_approved','co_rejected'].includes(action), ...opts }),
  lead: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'lead', record_id: id, ...opts }),
  estimate: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'estimate', record_id: id, ...opts }),
  warranty: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'warranty', record_id: id, ...opts }),
  task: (id, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module: 'task', record_id: id, ...opts }),
  financial: (id, module, action, actor, detail, opts = {}) => logAudit(id, action, actor, detail, { module, record_id: id, is_sensitive: true, ...opts }),
};

// Human-readable labels for all action types
export const ACTION_LABELS = {
  record_created:           { label: 'Record Created',            color: 'text-primary' },
  record_edited:            { label: 'Record Edited',             color: 'text-foreground' },
  record_deleted:           { label: 'Record Deleted',            color: 'text-destructive' },
  record_archived:          { label: 'Record Archived',           color: 'text-amber-600' },
  status_changed:           { label: 'Status Changed',            color: 'text-foreground' },
  field_updated:            { label: 'Field Updated',             color: 'text-foreground' },
  job_created:              { label: 'Job Created',               color: 'text-primary' },
  job_edited:               { label: 'Job Edited',                color: 'text-foreground' },
  imported_from_csv:        { label: 'Imported from CSV',         color: 'text-primary' },
  signature_submitted:      { label: 'Signature Submitted',       color: 'text-green-600' },
  record_locked:            { label: 'Record Locked',             color: 'text-green-600' },
  record_unlocked:          { label: 'Record Unlocked (Override)',color: 'text-destructive' },
  post_sign_edit:           { label: 'Edited After Signing',      color: 'text-destructive' },
  review_link_opened:       { label: 'Google Review Opened',      color: 'text-foreground' },
  financial_edit:           { label: 'Financial Edit',            color: 'text-amber-600' },
  invoice_created:          { label: 'Invoice Created',           color: 'text-primary' },
  invoice_sent:             { label: 'Invoice Sent',              color: 'text-primary' },
  invoice_status_changed:   { label: 'Invoice Status Changed',    color: 'text-amber-600' },
  payment_recorded:         { label: 'Payment Recorded',          color: 'text-green-600' },
  payment_edited:           { label: 'Payment Edited',            color: 'text-amber-600' },
  payment_applied:          { label: 'Payment Applied',           color: 'text-green-600' },
  bill_created:             { label: 'Bill Created',              color: 'text-foreground' },
  bill_edited:              { label: 'Bill Edited',               color: 'text-amber-600' },
  bill_status_changed:      { label: 'Bill Status Changed',       color: 'text-foreground' },
  po_created:               { label: 'PO Created',                color: 'text-foreground' },
  po_edited:                { label: 'PO Edited',                 color: 'text-amber-600' },
  po_status_changed:        { label: 'PO Status Changed',         color: 'text-foreground' },
  budget_edited:            { label: 'Budget Edited',             color: 'text-amber-600' },
  time_entry_created:       { label: 'Time Entry Created',        color: 'text-primary' },
  time_entry_edited:        { label: 'Time Entry Edited',         color: 'text-amber-600' },
  time_entry_manual:        { label: 'Manual Time Entry',         color: 'text-amber-600' },
  co_created:               { label: 'Change Order Created',      color: 'text-primary' },
  co_edited:                { label: 'Change Order Edited',       color: 'text-foreground' },
  co_approved:              { label: 'Change Order Approved',     color: 'text-green-600' },
  co_rejected:              { label: 'Change Order Rejected',     color: 'text-destructive' },
  co_status_changed:        { label: 'CO Status Changed',         color: 'text-foreground' },
  estimate_created:         { label: 'Estimate Created',          color: 'text-primary' },
  estimate_edited:          { label: 'Estimate Edited',           color: 'text-foreground' },
  estimate_approved:        { label: 'Estimate Approved',         color: 'text-green-600' },
  estimate_rejected:        { label: 'Estimate Rejected',         color: 'text-destructive' },
  lead_status_changed:      { label: 'Lead Status Changed',       color: 'text-foreground' },
  lead_converted:           { label: 'Lead Converted to Job',     color: 'text-green-600' },
  warranty_created:         { label: 'Warranty Request Created',  color: 'text-foreground' },
  warranty_status_changed:  { label: 'Warranty Status Changed',   color: 'text-foreground' },
  task_created:             { label: 'Task Created',              color: 'text-primary' },
  task_status_changed:      { label: 'Task Status Changed',       color: 'text-foreground' },
  portal_access_granted:    { label: 'Portal Access Granted',     color: 'text-amber-600' },
  portal_access_revoked:    { label: 'Portal Access Revoked',     color: 'text-destructive' },
  override_action:          { label: 'Admin Override',            color: 'text-destructive' },
  permission_change:        { label: 'Permission Changed',        color: 'text-destructive' },
  system_event:             { label: 'System Event',              color: 'text-muted-foreground' },
};