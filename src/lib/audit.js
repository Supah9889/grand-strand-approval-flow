import { base44 } from '@/api/base44Client';
import { getInternalRole } from './adminAuth';

/**
 * ─────────────────────────────────────────────────────────────────
 *  PLATFORM-WIDE AUDIT LOGGER
 *  Treat this as a legal/financial traceability backbone.
 *  Every meaningful action in the app should flow through here.
 * ─────────────────────────────────────────────────────────────────
 *
 * logAudit(recordId, action, actor, detail, opts)
 *
 * opts keys:
 *   module        — one of the MODULE list below
 *   record_id     — ID of the primary affected record
 *   job_id        — related job ID
 *   job_address   — job address string
 *   actor_role    — 'admin' | 'staff' | 'field' | 'system' | 'customer'
 *   old_value     — string or object (will be JSON-serialised)
 *   new_value     — string or object
 *   reason        — justification / note
 *   is_override   — boolean — admin override of a protected record
 *   is_sensitive  — boolean — financial / permission / signature action
 *   notification_sent — boolean — for assignment / invite actions
 *   source        — 'ui' | 'import' | 'automation' | 'system'
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
    is_sensitive,
    notification_sent,
    source = 'ui',
  } = opts;

  const resolvedJobId = job_id || (module === 'job' ? recordIdOrJobId : undefined);
  const resolvedRecordId = record_id || recordIdOrJobId;

  // Auto-flag sensitive actions
  const SENSITIVE_ACTIONS = new Set([
    'record_unlocked', 'post_sign_edit', 'override_action', 'financial_edit',
    'payment_recorded', 'payment_edited', 'invoice_status_changed',
    'time_entry_edited', 'time_entry_approved', 'time_entry_rejected',
    'co_approved', 'co_rejected', 'portal_access_granted', 'portal_access_revoked',
    'permission_change', 'budget_edited', 'expense_deleted', 'invoice_archived',
    'employee_deleted', 'employee_archived', 'employee_role_changed',
    'estimate_approved', 'estimate_rejected', 'duplicate_override',
    'portal_link_regenerated', 'portal_permissions_changed',
    'portal_section_visibility_changed', 'admin_override',
  ]);

  const entry = {
    module,
    record_id: resolvedRecordId,
    job_id: resolvedJobId || undefined,
    job_address: job_address || undefined,
    action,
    actor: actor || 'System',
    actor_role: actor_role || getInternalRole() || 'system',
    detail: detail || undefined,
    old_value: old_value != null
      ? (typeof old_value === 'object' ? JSON.stringify(old_value) : String(old_value))
      : undefined,
    new_value: new_value != null
      ? (typeof new_value === 'object' ? JSON.stringify(new_value) : String(new_value))
      : undefined,
    reason: reason || undefined,
    is_override,
    is_sensitive: is_sensitive != null ? is_sensitive : SENSITIVE_ACTIONS.has(action),
    timestamp: new Date().toISOString(),
    source,
  };

  if (notification_sent != null) {
    entry.new_value = [entry.new_value, `Notification sent: ${notification_sent ? 'Yes' : 'No'}`]
      .filter(Boolean).join(' · ');
  }

  // Fire-and-forget — never block primary user action on audit failure
  base44.entities.AuditLog.create(entry).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────
//  CONVENIENCE NAMESPACED HELPERS
//  Use these everywhere in the app for consistent, readable entries.
// ─────────────────────────────────────────────────────────────────

export const audit = {

  // ── JOBS ──────────────────────────────────────────────────────
  job: {
    created: (jobId, actor, jobLabel, opts = {}) =>
      logAudit(jobId, 'job_created', actor, `${actor} created job: ${jobLabel}.`, { module: 'job', record_id: jobId, job_id: jobId, ...opts }),

    edited: (jobId, actor, jobLabel, opts = {}) =>
      logAudit(jobId, 'job_edited', actor, `${actor} edited job: ${jobLabel}.`, { module: 'job', record_id: jobId, job_id: jobId, ...opts }),

    statusChanged: (jobId, actor, jobLabel, oldStatus, newStatus, opts = {}) =>
      logAudit(jobId, 'status_changed', actor,
        `${actor} changed status of "${jobLabel}" from "${oldStatus}" to "${newStatus}".`,
        { module: 'job', record_id: jobId, job_id: jobId, old_value: oldStatus, new_value: newStatus, ...opts }),

    archived: (jobId, actor, jobLabel, opts = {}) =>
      logAudit(jobId, 'record_archived', actor, `${actor} archived job: ${jobLabel}.`, { module: 'job', record_id: jobId, job_id: jobId, ...opts }),

    deleted: (jobId, actor, jobLabel, opts = {}) =>
      logAudit(jobId, 'record_deleted', actor, `${actor} deleted job: ${jobLabel}.`, { module: 'job', record_id: jobId, job_id: jobId, ...opts }),

    imported: (actor, count, opts = {}) =>
      logAudit('batch', 'imported_from_csv', actor, `${actor} imported ${count} jobs from CSV.`, { module: 'job', ...opts }),

    unlocked: (jobId, actor, reason, opts = {}) =>
      logAudit(jobId, 'record_unlocked', actor, `${actor} unlocked a signed record.`,
        { module: 'job', record_id: jobId, job_id: jobId, reason, is_override: true, is_sensitive: true, ...opts }),

    portalSettingsChanged: (jobId, actor, jobLabel, opts = {}) =>
      logAudit(jobId, 'portal_permissions_changed', actor,
        `${actor} changed portal settings for job: ${jobLabel}.`,
        { module: 'portal', record_id: jobId, job_id: jobId, ...opts }),
  },

  // ── ASSIGNMENTS ───────────────────────────────────────────────
  assignment: {
    created: (jobId, actor, employeeName, recordLabel, notified, opts = {}) =>
      logAudit(jobId, 'record_created', actor,
        `${actor} assigned ${employeeName} to ${recordLabel}. Notification sent: ${notified ? 'Yes' : 'No'}.`,
        { module: 'job', record_id: jobId, job_id: jobId, notification_sent: notified, ...opts }),

    removed: (jobId, actor, employeeName, recordLabel, opts = {}) =>
      logAudit(jobId, 'record_deleted', actor,
        `${actor} removed ${employeeName} from ${recordLabel}.`,
        { module: 'job', record_id: jobId, job_id: jobId, ...opts }),

    roleChanged: (jobId, actor, employeeName, oldRole, newRole, opts = {}) =>
      logAudit(jobId, 'record_edited', actor,
        `${actor} changed ${employeeName}'s role on job from "${oldRole}" to "${newRole}".`,
        { module: 'job', record_id: jobId, job_id: jobId, old_value: oldRole, new_value: newRole, ...opts }),

    eventCreated: (eventId, actor, employeeName, eventTitle, notified, opts = {}) =>
      logAudit(eventId, 'record_created', actor,
        `${actor} assigned ${employeeName} to event "${eventTitle}". Notification sent: ${notified ? 'Yes' : 'No'}.`,
        { module: 'system', record_id: eventId, notification_sent: notified, ...opts }),

    eventRemoved: (eventId, actor, employeeName, eventTitle, opts = {}) =>
      logAudit(eventId, 'record_deleted', actor,
        `${actor} removed ${employeeName} from event "${eventTitle}".`,
        { module: 'system', record_id: eventId, ...opts }),
  },

  // ── TIME ENTRIES ─────────────────────────────────────────────
  timeEntry: {
    created: (id, actor, empName, jobLabel, hours, opts = {}) =>
      logAudit(id, 'time_entry_created', actor,
        `${actor} created time entry for ${empName} on ${jobLabel}: ${hours} hrs.`,
        { module: 'time_entry', record_id: id, ...opts }),

    clockIn: (id, actor, empName, jobLabel, opts = {}) =>
      logAudit(id, 'time_entry_created', actor,
        `${empName} clocked in on ${jobLabel}.`,
        { module: 'time_entry', record_id: id, ...opts }),

    clockOut: (id, actor, empName, jobLabel, hours, opts = {}) =>
      logAudit(id, 'time_entry_created', actor,
        `${empName} clocked out on ${jobLabel}: ${hours} hrs.`,
        { module: 'time_entry', record_id: id, ...opts }),

    edited: (id, actor, empName, jobLabel, reason, opts = {}) =>
      logAudit(id, 'time_entry_edited', actor,
        `${actor} edited time entry for ${empName} on ${jobLabel}.`,
        { module: 'time_entry', record_id: id, reason, is_sensitive: true, ...opts }),

    approved: (id, actor, empName, jobLabel, hours, opts = {}) =>
      logAudit(id, 'time_entry_approved', actor,
        `${actor} approved ${hours} hrs for ${empName} on ${jobLabel}.`,
        { module: 'time_entry', record_id: id, is_sensitive: true, ...opts }),

    rejected: (id, actor, empName, jobLabel, opts = {}) =>
      logAudit(id, 'time_entry_rejected', actor,
        `${actor} rejected time entry for ${empName} on ${jobLabel}.`,
        { module: 'time_entry', record_id: id, is_sensitive: true, ...opts }),

    manualEntry: (id, actor, empName, jobLabel, hours, opts = {}) =>
      logAudit(id, 'time_entry_manual', actor,
        `${actor} created manual time entry for ${empName} on ${jobLabel}: ${hours} hrs.`,
        { module: 'time_entry', record_id: id, is_sensitive: true, ...opts }),
  },

  // ── INVOICES ─────────────────────────────────────────────────
  invoice: {
    created: (id, actor, customerName, amount, jobLabel, opts = {}) =>
      logAudit(id, 'invoice_created', actor,
        `${actor} created invoice for ${customerName}: $${amount}${jobLabel ? ` — ${jobLabel}` : ''}.`,
        { module: 'invoice', record_id: id, is_sensitive: true, ...opts }),

    edited: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_edited', actor,
        `${actor} edited invoice: ${label}.`,
        { module: 'invoice', record_id: id, is_sensitive: true, ...opts }),

    statusChanged: (id, actor, label, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'invoice_status_changed', actor,
        `${actor} changed invoice "${label}" status from "${oldStatus}" to "${newStatus}".`,
        { module: 'invoice', record_id: id, old_value: oldStatus, new_value: newStatus, is_sensitive: true, ...opts }),

    archived: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_archived', actor,
        `${actor} archived invoice: ${label}.`,
        { module: 'invoice', record_id: id, is_sensitive: true, ...opts }),

    deleted: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_deleted', actor,
        `${actor} deleted invoice: ${label}.`,
        { module: 'invoice', record_id: id, is_sensitive: true, ...opts }),

    sent: (id, actor, customerName, opts = {}) =>
      logAudit(id, 'invoice_sent', actor,
        `${actor} sent invoice to ${customerName}.`,
        { module: 'invoice', record_id: id, is_sensitive: true, ...opts }),
  },

  // ── PAYMENTS ─────────────────────────────────────────────────
  payment: {
    recorded: (id, actor, customerName, amount, opts = {}) =>
      logAudit(id, 'payment_recorded', actor,
        `${actor} recorded payment of $${amount} from ${customerName}.`,
        { module: 'payment', record_id: id, is_sensitive: true, ...opts }),

    edited: (id, actor, label, opts = {}) =>
      logAudit(id, 'payment_edited', actor,
        `${actor} edited payment: ${label}.`,
        { module: 'payment', record_id: id, is_sensitive: true, ...opts }),

    deleted: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_deleted', actor,
        `${actor} deleted payment: ${label}.`,
        { module: 'payment', record_id: id, is_sensitive: true, ...opts }),
  },

  // ── EXPENSES ─────────────────────────────────────────────────
  expense: {
    created: (id, actor, vendorName, amount, opts = {}) =>
      logAudit(id, 'record_created', actor,
        `${actor} created expense: ${vendorName} $${amount}.`,
        { module: 'expense', record_id: id, ...opts }),

    edited: (id, actor, vendorName, opts = {}) =>
      logAudit(id, 'record_edited', actor,
        `${actor} edited expense: ${vendorName}.`,
        { module: 'expense', record_id: id, ...opts }),

    archived: (id, actor, vendorName, opts = {}) =>
      logAudit(id, 'record_archived', actor,
        `${actor} archived expense: ${vendorName}.`,
        { module: 'expense', record_id: id, is_sensitive: true, ...opts }),

    deleted: (id, actor, vendorName, opts = {}) =>
      logAudit(id, 'expense_deleted', actor,
        `${actor} permanently deleted expense: ${vendorName}.`,
        { module: 'expense', record_id: id, is_sensitive: true, ...opts }),

    receiptParsed: (id, actor, vendorName, confidence, opts = {}) =>
      logAudit(id, 'record_created', actor,
        `Receipt parsed for ${vendorName} (confidence: ${confidence}).`,
        { module: 'expense', record_id: id, source: 'automation', ...opts }),

    duplicateWarning: (id, actor, vendorName, opts = {}) =>
      logAudit(id, 'record_edited', actor,
        `Duplicate warning triggered for expense: ${vendorName}.`,
        { module: 'expense', record_id: id, ...opts }),

    duplicateOverride: (id, actor, vendorName, opts = {}) =>
      logAudit(id, 'duplicate_override', actor,
        `${actor} overrode duplicate warning for expense: ${vendorName}.`,
        { module: 'expense', record_id: id, is_sensitive: true, ...opts }),

    duplicateDiscarded: (actor, vendorName, opts = {}) =>
      logAudit('discard', 'record_deleted', actor,
        `${actor} discarded duplicate expense: ${vendorName}.`,
        { module: 'expense', ...opts }),

    approvalChanged: (id, actor, vendorName, newStatus, opts = {}) =>
      logAudit(id, 'status_changed', actor,
        `${actor} changed approval status of expense "${vendorName}" to "${newStatus}".`,
        { module: 'expense', record_id: id, new_value: newStatus, is_sensitive: true, ...opts }),
  },

  // ── ESTIMATES ────────────────────────────────────────────────
  estimate: {
    created: (id, actor, label, opts = {}) =>
      logAudit(id, 'estimate_created', actor,
        `${actor} created estimate: ${label}.`,
        { module: 'estimate', record_id: id, ...opts }),

    edited: (id, actor, label, opts = {}) =>
      logAudit(id, 'estimate_edited', actor,
        `${actor} edited estimate: ${label}.`,
        { module: 'estimate', record_id: id, ...opts }),

    statusChanged: (id, actor, label, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'status_changed', actor,
        `${actor} changed estimate "${label}" status from "${oldStatus}" to "${newStatus}".`,
        { module: 'estimate', record_id: id, old_value: oldStatus, new_value: newStatus, ...opts }),

    approved: (id, actor, label, opts = {}) =>
      logAudit(id, 'estimate_approved', actor,
        `${actor} marked estimate "${label}" as approved.`,
        { module: 'estimate', record_id: id, is_sensitive: true, ...opts }),

    rejected: (id, actor, label, opts = {}) =>
      logAudit(id, 'estimate_rejected', actor,
        `${actor} marked estimate "${label}" as rejected.`,
        { module: 'estimate', record_id: id, is_sensitive: true, ...opts }),

    archived: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_archived', actor, `${actor} archived estimate: ${label}.`, { module: 'estimate', record_id: id, ...opts }),

    deleted: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_deleted', actor, `${actor} deleted estimate: ${label}.`, { module: 'estimate', record_id: id, ...opts }),
  },

  // ── BILLS ────────────────────────────────────────────────────
  bill: {
    created: (id, actor, label, opts = {}) =>
      logAudit(id, 'bill_created', actor, `${actor} created bill: ${label}.`, { module: 'bill', record_id: id, is_sensitive: true, ...opts }),
    edited: (id, actor, label, opts = {}) =>
      logAudit(id, 'bill_edited', actor, `${actor} edited bill: ${label}.`, { module: 'bill', record_id: id, is_sensitive: true, ...opts }),
    statusChanged: (id, actor, label, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'bill_status_changed', actor,
        `${actor} changed bill "${label}" status from "${oldStatus}" to "${newStatus}".`,
        { module: 'bill', record_id: id, old_value: oldStatus, new_value: newStatus, is_sensitive: true, ...opts }),
    archived: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_archived', actor, `${actor} archived bill: ${label}.`, { module: 'bill', record_id: id, is_sensitive: true, ...opts }),
    deleted: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_deleted', actor, `${actor} deleted bill: ${label}.`, { module: 'bill', record_id: id, is_sensitive: true, ...opts }),
  },

  // ── PURCHASE ORDERS ──────────────────────────────────────────
  purchaseOrder: {
    created: (id, actor, label, opts = {}) =>
      logAudit(id, 'po_created', actor, `${actor} created PO: ${label}.`, { module: 'purchase_order', record_id: id, ...opts }),
    edited: (id, actor, label, opts = {}) =>
      logAudit(id, 'po_edited', actor, `${actor} edited PO: ${label}.`, { module: 'purchase_order', record_id: id, ...opts }),
    statusChanged: (id, actor, label, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'po_status_changed', actor,
        `${actor} changed PO "${label}" from "${oldStatus}" to "${newStatus}".`,
        { module: 'purchase_order', record_id: id, old_value: oldStatus, new_value: newStatus, ...opts }),
    archived: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_archived', actor, `${actor} archived PO: ${label}.`, { module: 'purchase_order', record_id: id, ...opts }),
    deleted: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_deleted', actor, `${actor} deleted PO: ${label}.`, { module: 'purchase_order', record_id: id, ...opts }),
  },

  // ── CHANGE ORDERS ────────────────────────────────────────────
  changeOrder: {
    created: (id, actor, label, opts = {}) =>
      logAudit(id, 'co_created', actor, `${actor} created change order: ${label}.`, { module: 'change_order', record_id: id, ...opts }),
    edited: (id, actor, label, opts = {}) =>
      logAudit(id, 'co_edited', actor, `${actor} edited change order: ${label}.`, { module: 'change_order', record_id: id, ...opts }),
    approved: (id, actor, label, opts = {}) =>
      logAudit(id, 'co_approved', actor, `${actor} approved change order: ${label}.`, { module: 'change_order', record_id: id, is_sensitive: true, ...opts }),
    rejected: (id, actor, label, opts = {}) =>
      logAudit(id, 'co_rejected', actor, `${actor} rejected change order: ${label}.`, { module: 'change_order', record_id: id, is_sensitive: true, ...opts }),
    statusChanged: (id, actor, label, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'co_status_changed', actor,
        `${actor} changed CO "${label}" from "${oldStatus}" to "${newStatus}".`,
        { module: 'change_order', record_id: id, old_value: oldStatus, new_value: newStatus, ...opts }),
    archived: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_archived', actor, `${actor} archived change order: ${label}.`, { module: 'change_order', record_id: id, ...opts }),
    deleted: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_deleted', actor, `${actor} deleted change order: ${label}.`, { module: 'change_order', record_id: id, ...opts }),
  },

  // ── TASKS ────────────────────────────────────────────────────
  task: {
    created: (id, actor, title, jobLabel, opts = {}) =>
      logAudit(id, 'task_created', actor,
        `${actor} created task: "${title}"${jobLabel ? ` on ${jobLabel}` : ''}.`,
        { module: 'task', record_id: id, ...opts }),

    edited: (id, actor, title, opts = {}) =>
      logAudit(id, 'record_edited', actor,
        `${actor} edited task: "${title}".`,
        { module: 'task', record_id: id, ...opts }),

    statusChanged: (id, actor, title, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'task_status_changed', actor,
        `${actor} changed task "${title}" status from "${oldStatus}" to "${newStatus}".`,
        { module: 'task', record_id: id, old_value: oldStatus, new_value: newStatus, ...opts }),

    archived: (id, actor, title, opts = {}) =>
      logAudit(id, 'record_archived', actor, `${actor} archived task: "${title}".`, { module: 'task', record_id: id, ...opts }),

    deleted: (id, actor, title, opts = {}) =>
      logAudit(id, 'record_deleted', actor, `${actor} deleted task: "${title}".`, { module: 'task', record_id: id, ...opts }),
  },

  // ── DAILY LOGS ───────────────────────────────────────────────
  dailyLog: {
    created: (id, actor, jobLabel, logDate, opts = {}) =>
      logAudit(id, 'record_created', actor,
        `${actor} created daily log for ${jobLabel} on ${logDate}.`,
        { module: 'daily_log', record_id: id, ...opts }),

    edited: (id, actor, jobLabel, logDate, opts = {}) =>
      logAudit(id, 'record_edited', actor,
        `${actor} edited daily log for ${jobLabel} on ${logDate}.`,
        { module: 'daily_log', record_id: id, ...opts }),

    followUpResolved: (id, actor, jobLabel, opts = {}) =>
      logAudit(id, 'status_changed', actor,
        `${actor} resolved follow-up on daily log for ${jobLabel}.`,
        { module: 'daily_log', record_id: id, old_value: 'open', new_value: 'resolved', ...opts }),

    archived: (id, actor, jobLabel, opts = {}) =>
      logAudit(id, 'record_archived', actor, `${actor} archived daily log for ${jobLabel}.`, { module: 'daily_log', record_id: id, ...opts }),

    deleted: (id, actor, jobLabel, opts = {}) =>
      logAudit(id, 'record_deleted', actor, `${actor} deleted daily log for ${jobLabel}.`, { module: 'daily_log', record_id: id, ...opts }),
  },

  // ── EMPLOYEES ────────────────────────────────────────────────
  employee: {
    created: (id, actor, empName, role, opts = {}) =>
      logAudit(id, 'record_created', actor,
        `${actor} created employee record: ${empName} (${role}).`,
        { module: 'employee', record_id: id, ...opts }),

    edited: (id, actor, empName, opts = {}) =>
      logAudit(id, 'record_edited', actor,
        `${actor} edited employee: ${empName}.`,
        { module: 'employee', record_id: id, ...opts }),

    archived: (id, actor, empName, opts = {}) =>
      logAudit(id, 'employee_archived', actor,
        `${actor} deactivated/archived employee: ${empName}.`,
        { module: 'employee', record_id: id, is_sensitive: true, ...opts }),

    deleted: (id, actor, empName, opts = {}) =>
      logAudit(id, 'employee_deleted', actor,
        `${actor} permanently deleted employee: ${empName}.`,
        { module: 'employee', record_id: id, is_sensitive: true, ...opts }),

    inviteSent: (id, actor, empName, toEmail, opts = {}) =>
      logAudit(id, 'record_created', actor,
        `${actor} sent invite to ${empName} at ${toEmail}.`,
        { module: 'employee', record_id: id, notification_sent: true, ...opts }),

    inviteResent: (id, actor, empName, toEmail, opts = {}) =>
      logAudit(id, 'record_edited', actor,
        `${actor} resent invite to ${empName} at ${toEmail}.`,
        { module: 'employee', record_id: id, notification_sent: true, ...opts }),

    inviteConfirmed: (id, actor, empName, opts = {}) =>
      logAudit(id, 'status_changed', actor,
        `${empName} confirmed their invite.`,
        { module: 'employee', record_id: id, new_value: 'confirmed', ...opts }),

    roleChanged: (id, actor, empName, oldRole, newRole, opts = {}) =>
      logAudit(id, 'employee_role_changed', actor,
        `${actor} changed ${empName}'s role from "${oldRole}" to "${newRole}".`,
        { module: 'employee', record_id: id, old_value: oldRole, new_value: newRole, is_sensitive: true, ...opts }),

    permissionsChanged: (id, actor, empName, opts = {}) =>
      logAudit(id, 'permission_change', actor,
        `${actor} changed permissions for employee: ${empName}.`,
        { module: 'employee', record_id: id, is_sensitive: true, ...opts }),

    activeToggled: (id, actor, empName, isNowActive, opts = {}) =>
      logAudit(id, 'status_changed', actor,
        `${actor} ${isNowActive ? 'activated' : 'deactivated'} employee: ${empName}.`,
        { module: 'employee', record_id: id, new_value: isNowActive ? 'active' : 'inactive', ...opts }),
  },

  // ── CLIENT PORTAL ────────────────────────────────────────────
  portal: {
    created: (id, actor, clientName, jobLabel, opts = {}) =>
      logAudit(id, 'portal_access_granted', actor,
        `${actor} created portal access for ${clientName}${jobLabel ? ` on ${jobLabel}` : ''}.`,
        { module: 'portal', record_id: id, is_sensitive: true, ...opts }),

    revoked: (id, actor, clientName, opts = {}) =>
      logAudit(id, 'portal_access_revoked', actor,
        `${actor} revoked portal access for ${clientName}.`,
        { module: 'portal', record_id: id, is_sensitive: true, ...opts }),

    statusChanged: (id, actor, clientName, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'status_changed', actor,
        `${actor} changed portal access for ${clientName} from "${oldStatus}" to "${newStatus}".`,
        { module: 'portal', record_id: id, old_value: oldStatus, new_value: newStatus, is_sensitive: true, ...opts }),

    linkRegenerated: (id, actor, clientName, opts = {}) =>
      logAudit(id, 'portal_link_regenerated', actor,
        `${actor} regenerated portal link for ${clientName}.`,
        { module: 'portal', record_id: id, is_sensitive: true, ...opts }),

    permissionsChanged: (id, actor, clientName, jobLabel, opts = {}) =>
      logAudit(id, 'portal_section_visibility_changed', actor,
        `${actor} changed portal section visibility for ${clientName}${jobLabel ? ` on ${jobLabel}` : ''}.`,
        { module: 'portal', record_id: id, is_sensitive: true, ...opts }),

    inviteSent: (id, actor, clientName, toEmail, opts = {}) =>
      logAudit(id, 'portal_access_granted', actor,
        `${actor} sent portal invite to ${clientName} at ${toEmail}.`,
        { module: 'portal', record_id: id, notification_sent: true, is_sensitive: true, ...opts }),
  },

  // ── LEADS ────────────────────────────────────────────────────
  lead: {
    created: (id, actor, name, opts = {}) =>
      logAudit(id, 'record_created', actor, `${actor} created lead: ${name}.`, { module: 'lead', record_id: id, ...opts }),
    statusChanged: (id, actor, name, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'lead_status_changed', actor,
        `${actor} changed lead "${name}" from "${oldStatus}" to "${newStatus}".`,
        { module: 'lead', record_id: id, old_value: oldStatus, new_value: newStatus, ...opts }),
    converted: (id, actor, name, jobLabel, opts = {}) =>
      logAudit(id, 'lead_converted', actor,
        `${actor} converted lead "${name}" to job: ${jobLabel}.`,
        { module: 'lead', record_id: id, ...opts }),
    edited: (id, actor, name, opts = {}) =>
      logAudit(id, 'record_edited', actor, `${actor} edited lead: ${name}.`, { module: 'lead', record_id: id, ...opts }),
    archived: (id, actor, name, opts = {}) =>
      logAudit(id, 'record_archived', actor, `${actor} archived lead: ${name}.`, { module: 'lead', record_id: id, ...opts }),
  },

  // ── WARRANTY ─────────────────────────────────────────────────
  warranty: {
    created: (id, actor, label, opts = {}) =>
      logAudit(id, 'warranty_created', actor, `${actor} created warranty request: ${label}.`, { module: 'warranty', record_id: id, ...opts }),
    statusChanged: (id, actor, label, oldStatus, newStatus, opts = {}) =>
      logAudit(id, 'warranty_status_changed', actor,
        `${actor} changed warranty "${label}" from "${oldStatus}" to "${newStatus}".`,
        { module: 'warranty', record_id: id, old_value: oldStatus, new_value: newStatus, ...opts }),
    edited: (id, actor, label, opts = {}) =>
      logAudit(id, 'record_edited', actor, `${actor} edited warranty: ${label}.`, { module: 'warranty', record_id: id, ...opts }),
  },

  // ── VENDOR COMPLIANCE ────────────────────────────────────
  vendor: {
    created: (id, actor, vendorName, opts = {}) =>
      logAudit(id, 'record_created', actor,
        `${actor} created vendor/subcontractor: ${vendorName}.`,
        { module: 'vendor', record_id: id, ...opts }),

    complianceExpirationUpdated: (id, actor, vendorName, docType, oldDate, newDate, opts = {}) =>
      logAudit(id, 'compliance_field_updated', actor,
        `${actor} updated ${docType} expiration for ${vendorName}: ${oldDate || 'not set'} → ${newDate}.`,
        { module: 'vendor', record_id: id, old_value: oldDate || 'not set', new_value: newDate, is_sensitive: true, ...opts }),

    complianceDocumentUploaded: (id, actor, vendorName, docType, fileName, opts = {}) =>
      logAudit(id, 'compliance_document_uploaded', actor,
        `${actor} uploaded ${docType} document for ${vendorName}: ${fileName}.`,
        { module: 'vendor', record_id: id, is_sensitive: true, ...opts }),

    complianceDocumentRemoved: (id, actor, vendorName, docType, opts = {}) =>
      logAudit(id, 'compliance_document_removed', actor,
        `${actor} removed ${docType} document for ${vendorName}.`,
        { module: 'vendor', record_id: id, is_sensitive: true, ...opts }),
  },

  // ── SIGNATURES ───────────────────────────────────────────────
  signature: (jobId, actor, detail, opts = {}) =>
    logAudit(jobId, 'signature_submitted', actor, detail, { module: 'signature', record_id: jobId, job_id: jobId, is_sensitive: true, ...opts }),

  // ── SYSTEM / EXPORTS / IMPORTS ───────────────────────────────
  system: {
    exportRun: (actor, exportType, count, opts = {}) =>
      logAudit('export', 'system_event', actor,
        `${actor} ran ${exportType} export — ${count} records.`,
        { module: 'system', source: 'ui', ...opts }),

    importRun: (actor, module, count, opts = {}) =>
      logAudit('import', 'imported_from_csv', actor,
        `${actor} imported ${count} records into ${module}.`,
        { module: 'system', source: 'import', ...opts }),

    exportFailed: (actor, exportType, reason, opts = {}) =>
      logAudit('export', 'system_event', actor,
        `Export failed for ${exportType}: ${reason}.`,
        { module: 'system', ...opts }),

    budgetEdited: (id, actor, jobLabel, opts = {}) =>
      logAudit(id, 'budget_edited', actor,
        `${actor} edited budget for ${jobLabel}.`,
        { module: 'budget', record_id: id, is_sensitive: true, ...opts }),

    settingsChanged: (actor, settingName, opts = {}) =>
      logAudit('settings', 'system_event', actor,
        `${actor} changed system setting: ${settingName}.`,
        { module: 'system', is_sensitive: true, ...opts }),
  },

  // ── LEGACY COMPAT — keep old callsites working ────────────────
  // Old: audit.assignment.created(jobId, actor, empName, label, notified, opts)
  // (already redefined above under assignment namespace — works)

  // Old: logAudit(jobId, action, actor, detail, opts) direct calls still work fine.
};

// ─────────────────────────────────────────────────────────────────
//  ACTION LABELS — human-readable display map for the Audit Log UI
// ─────────────────────────────────────────────────────────────────
export const audit_linking = {
  jobLinked: (recordId, actor, recordType, jobId, jobAddress) => logAudit(
    recordId, 'record_linked', actor, `${recordType} linked to job ${jobAddress || jobId}`,
    { related_type: recordType, job_id: jobId, job_address: jobAddress }
  ),
  jobUnlinked: (recordId, actor, recordType, jobId, jobAddress) => logAudit(
    recordId, 'record_unlinked', actor, `${recordType} unlinked from job ${jobAddress || jobId}`,
    { related_type: recordType, job_id: jobId, job_address: jobAddress }
  ),
  jobChanged: (recordId, actor, recordType, oldJobId, newJobId, oldAddr, newAddr) => logAudit(
    recordId, 'linked_job_changed', actor, `${recordType} job changed from ${oldAddr || oldJobId} to ${newAddr || newJobId}`,
    { related_type: recordType, old_job_id: oldJobId, new_job_id: newJobId }
  ),
};

export const ACTION_LABELS = {
  record_created:                   { label: 'Record Created',                    color: 'text-primary' },
  record_edited:                    { label: 'Record Edited',                     color: 'text-foreground' },
  record_deleted:                   { label: 'Record Deleted',                    color: 'text-destructive' },
  record_archived:                  { label: 'Record Archived',                   color: 'text-amber-600' },
  status_changed:                   { label: 'Status Changed',                    color: 'text-foreground' },
  field_updated:                    { label: 'Field Updated',                     color: 'text-foreground' },

  job_created:                      { label: 'Job Created',                       color: 'text-primary' },
  job_edited:                       { label: 'Job Edited',                        color: 'text-foreground' },
  imported_from_csv:                { label: 'Imported from CSV',                 color: 'text-primary' },
  signature_submitted:              { label: 'Signature Submitted',               color: 'text-green-600' },
  record_locked:                    { label: 'Record Locked',                     color: 'text-green-600' },
  record_unlocked:                  { label: 'Record Unlocked (Override)',         color: 'text-destructive' },
  post_sign_edit:                   { label: 'Edited After Signing',              color: 'text-destructive' },
  review_link_opened:               { label: 'Google Review Opened',              color: 'text-foreground' },
  financial_edit:                   { label: 'Financial Edit',                    color: 'text-amber-600' },

  invoice_created:                  { label: 'Invoice Created',                   color: 'text-primary' },
  invoice_sent:                     { label: 'Invoice Sent',                      color: 'text-primary' },
  invoice_status_changed:           { label: 'Invoice Status Changed',            color: 'text-amber-600' },

  payment_recorded:                 { label: 'Payment Recorded',                  color: 'text-green-600' },
  payment_edited:                   { label: 'Payment Edited',                    color: 'text-amber-600' },
  payment_applied:                  { label: 'Payment Applied',                   color: 'text-green-600' },

  bill_created:                     { label: 'Bill Created',                      color: 'text-foreground' },
  bill_edited:                      { label: 'Bill Edited',                       color: 'text-amber-600' },
  bill_status_changed:              { label: 'Bill Status Changed',               color: 'text-foreground' },

  po_created:                       { label: 'PO Created',                        color: 'text-foreground' },
  po_edited:                        { label: 'PO Edited',                         color: 'text-amber-600' },
  po_status_changed:                { label: 'PO Status Changed',                 color: 'text-foreground' },

  budget_edited:                    { label: 'Budget Edited',                     color: 'text-amber-600' },

  time_entry_created:               { label: 'Time Entry Created',                color: 'text-primary' },
  time_entry_edited:                { label: 'Time Entry Edited',                 color: 'text-amber-600' },
  time_entry_manual:                { label: 'Manual Time Entry',                 color: 'text-amber-600' },
  time_entry_approved:              { label: 'Time Entry Approved',               color: 'text-green-600' },
  time_entry_rejected:              { label: 'Time Entry Rejected',               color: 'text-destructive' },

  co_created:                       { label: 'Change Order Created',              color: 'text-primary' },
  co_edited:                        { label: 'Change Order Edited',               color: 'text-foreground' },
  co_approved:                      { label: 'Change Order Approved',             color: 'text-green-600' },
  co_rejected:                      { label: 'Change Order Rejected',             color: 'text-destructive' },
  co_status_changed:                { label: 'CO Status Changed',                 color: 'text-foreground' },

  estimate_created:                 { label: 'Estimate Created',                  color: 'text-primary' },
  estimate_edited:                  { label: 'Estimate Edited',                   color: 'text-foreground' },
  estimate_approved:                { label: 'Estimate Approved',                 color: 'text-green-600' },
  estimate_rejected:                { label: 'Estimate Rejected',                 color: 'text-destructive' },

  lead_status_changed:              { label: 'Lead Status Changed',               color: 'text-foreground' },
  lead_converted:                   { label: 'Lead Converted to Job',             color: 'text-green-600' },

  warranty_created:                 { label: 'Warranty Request Created',          color: 'text-foreground' },
  warranty_status_changed:          { label: 'Warranty Status Changed',           color: 'text-foreground' },

  task_created:                     { label: 'Task Created',                      color: 'text-primary' },
  task_status_changed:              { label: 'Task Status Changed',               color: 'text-foreground' },

  portal_access_granted:            { label: 'Portal Access Granted',             color: 'text-amber-600' },
  portal_access_revoked:            { label: 'Portal Access Revoked',             color: 'text-destructive' },
  portal_link_regenerated:          { label: 'Portal Link Regenerated',           color: 'text-amber-600' },
  portal_permissions_changed:       { label: 'Portal Settings Changed',           color: 'text-amber-600' },
  portal_section_visibility_changed:{ label: 'Portal Section Visibility Changed', color: 'text-amber-600' },

  employee_archived:                { label: 'Employee Archived',                 color: 'text-amber-600' },
  employee_deleted:                 { label: 'Employee Deleted',                  color: 'text-destructive' },
  employee_role_changed:            { label: 'Employee Role Changed',             color: 'text-destructive' },

  compliance_field_updated:         { label: 'Compliance Field Updated',          color: 'text-amber-600' },
  compliance_document_uploaded:     { label: 'Compliance Document Uploaded',      color: 'text-primary' },
  compliance_document_removed:      { label: 'Compliance Document Removed',       color: 'text-destructive' },

  expense_deleted:                  { label: 'Expense Deleted',                   color: 'text-destructive' },
  duplicate_override:               { label: 'Duplicate Warning Overridden',      color: 'text-amber-600' },

  override_action:                  { label: 'Admin Override',                    color: 'text-destructive' },
  admin_override:                   { label: 'Admin Override',                    color: 'text-destructive' },
  permission_change:                { label: 'Permission Changed',                color: 'text-destructive' },
  system_event:                     { label: 'System Event',                      color: 'text-muted-foreground' },
};

// Keep legacy direct logAudit export working
export { logAudit as default };