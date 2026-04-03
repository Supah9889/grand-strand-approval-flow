/**
 * timelineHelpers.js
 * Shared config and item-builder for the unified job timeline feed.
 * Used by JobTimelineTab and DashRecentActivity.
 */

// ── Note type display config ──────────────────────────────────────────────────
export const NOTE_TYPE_CONFIG = {
  internal_update:   { label: 'Internal Update',    color: 'bg-slate-100 text-slate-700',    dot: 'bg-slate-400' },
  homeowner_contact: { label: 'Homeowner Contact',  color: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-400' },
  builder_contact:   { label: 'Builder Contact',    color: 'bg-indigo-50 text-indigo-700',   dot: 'bg-indigo-400' },
  vendor_sub_update: { label: 'Vendor / Sub',        color: 'bg-orange-50 text-orange-700',   dot: 'bg-orange-400' },
  schedule_update:   { label: 'Schedule Update',    color: 'bg-cyan-50 text-cyan-700',       dot: 'bg-cyan-500' },
  estimate_note:     { label: 'Estimate Note',      color: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-400' },
  invoice_note:      { label: 'Invoice Note',       color: 'bg-green-50 text-green-700',     dot: 'bg-green-500' },
  bill_cost_note:    { label: 'Cost Note',          color: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500' },
  field_update:      { label: 'Field Update',       color: 'bg-teal-50 text-teal-700',       dot: 'bg-teal-500' },
  access_info:       { label: 'Access Info',        color: 'bg-yellow-50 text-yellow-700',   dot: 'bg-yellow-500' },
  completion_note:   { label: 'Completion Note',    color: 'bg-primary/10 text-primary',     dot: 'bg-primary' },
  photo_file:        { label: 'Photo / File',       color: 'bg-slate-50 text-slate-600',     dot: 'bg-slate-400' },
  general:           { label: 'Note',               color: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-400' },
};

// Human-friendly labels for note type picker
export const NOTE_TYPE_OPTIONS = [
  { value: 'general',           label: 'General Note' },
  { value: 'internal_update',   label: 'Internal Update' },
  { value: 'homeowner_contact', label: 'Homeowner Contact' },
  { value: 'builder_contact',   label: 'Builder Contact' },
  { value: 'vendor_sub_update', label: 'Vendor / Sub Update' },
  { value: 'schedule_update',   label: 'Schedule Update' },
  { value: 'estimate_note',     label: 'Estimate Note' },
  { value: 'invoice_note',      label: 'Invoice Note' },
  { value: 'bill_cost_note',    label: 'Bill / Cost Note' },
  { value: 'field_update',      label: 'Field Update' },
  { value: 'access_info',       label: 'Access Info' },
  { value: 'completion_note',   label: 'Completion Note' },
  { value: 'photo_file',        label: 'Photo / File' },
];

export function getNoteTypeConfig(type) {
  return NOTE_TYPE_CONFIG[type] || NOTE_TYPE_CONFIG.general;
}

// ── System / entity event type config ────────────────────────────────────────
export const EVENT_TYPE_CONFIG = {
  note:         { label: 'Note',          dotColor: 'bg-amber-400',   badgeColor: 'bg-amber-50 text-amber-700' },
  daily_log:    { label: 'Daily Log',     dotColor: 'bg-orange-400',  badgeColor: 'bg-orange-50 text-orange-700' },
  change_order: { label: 'Change Order',  dotColor: 'bg-indigo-400',  badgeColor: 'bg-indigo-50 text-indigo-700' },
  invoice:      { label: 'Invoice',       dotColor: 'bg-green-500',   badgeColor: 'bg-green-50 text-green-700' },
  expense:      { label: 'Cost Inbox',    dotColor: 'bg-orange-500',  badgeColor: 'bg-orange-50 text-orange-700' },
  time_entry:   { label: 'Time Entry',    dotColor: 'bg-blue-400',    badgeColor: 'bg-blue-50 text-blue-700' },
  warranty:     { label: 'Warranty',      dotColor: 'bg-violet-400',  badgeColor: 'bg-violet-50 text-violet-700' },
  task:         { label: 'Task',          dotColor: 'bg-teal-500',    badgeColor: 'bg-teal-50 text-teal-700' },
  file:         { label: 'File Upload',   dotColor: 'bg-slate-400',   badgeColor: 'bg-slate-100 text-slate-700' },
  schedule:     { label: 'Scheduled',     dotColor: 'bg-cyan-500',    badgeColor: 'bg-cyan-50 text-cyan-700' },
  system:       { label: 'System',        dotColor: 'bg-muted-foreground', badgeColor: 'bg-muted text-muted-foreground' },
};

export function getEventTypeConfig(type) {
  return EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.system;
}

// ── Feed item builders ────────────────────────────────────────────────────────
// Each returns a normalized feed item: { id, type, displayType, ts, title, body, sub, actor, hasFile, fileUrl, onClick }

export const NOTE_VISIBILITY_CONFIG = {
  internal:        { label: 'Internal',        color: 'bg-slate-100 text-slate-500' },
  shareable:       { label: 'Shareable',       color: 'bg-blue-50 text-blue-600' },
  admin_sensitive: { label: 'Admin Only',      color: 'bg-red-50 text-red-600' },
};

export function getNoteVisibilityConfig(vis) {
  return NOTE_VISIBILITY_CONFIG[vis] || NOTE_VISIBILITY_CONFIG.internal;
}

export function buildNoteItem(note, navigate) {
  const ntCfg = getNoteTypeConfig(note.note_type);
  return {
    id: `note-${note.id}`,
    type: 'note',
    displayType: ntCfg.label,
    badgeColor: ntCfg.color,
    dotColor: ntCfg.dot,
    ts: note.created_date,
    title: null,
    body: note.content,
    sub: null,
    actor: note.author_name || note.author_role || null,
    hasFile: !!note.file_url,
    fileUrl: note.file_url,
    fileName: note.file_name,
    sourceId: note.id,
    canExpand: (note.content || '').length > 120,
    onClick: () => {},
    noteType: note.note_type || 'general',
    visibility: note.visibility || 'internal',
    isUnread: !note.read,
  };
}

export function buildLogItem(log, navigate) {
  const cfg = getEventTypeConfig('daily_log');
  return {
    id: `log-${log.id}`,
    type: 'daily_log',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: log.created_date,
    title: `Daily log · ${log.log_date || ''}`,
    body: log.work_completed || '',
    sub: log.delays_issues ? `Delays: ${log.delays_issues}` : null,
    actor: log.created_by_name || null,
    hasFile: false,
    fileUrl: null,
    canExpand: (log.work_completed || '').length > 120,
    onClick: () => navigate(`/daily-logs/${log.id}`),
  };
}

export function buildChangeOrderItem(co, navigate) {
  const cfg = getEventTypeConfig('change_order');
  const impact = co.total_financial_impact
    ? `${co.total_financial_impact >= 0 ? '+' : ''}$${Number(co.total_financial_impact).toLocaleString()}`
    : null;
  return {
    id: `co-${co.id}`,
    type: 'change_order',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: co.created_date,
    title: co.title || 'Change Order',
    body: co.scope_summary || co.description || null,
    sub: [co.status, impact].filter(Boolean).join(' · '),
    actor: co.created_by_name || null,
    hasFile: false,
    fileUrl: null,
    canExpand: false,
    onClick: () => navigate(`/change-orders/${co.id}`),
  };
}

export function buildInvoiceItem(inv, navigate) {
  const cfg = getEventTypeConfig('invoice');
  const amount = `$${Number(inv.amount || 0).toLocaleString()}`;
  const due = inv.balance_due > 0 ? ` · $${Number(inv.balance_due).toLocaleString()} due` : '';
  return {
    id: `inv-${inv.id}`,
    type: 'invoice',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: inv.created_date,
    title: `Invoice #${inv.invoice_number || 'draft'} · ${amount}`,
    body: inv.notes || inv.memo || null,
    sub: `${inv.status}${due}`,
    actor: inv.created_by_name || null,
    hasFile: !!inv.generated_document_url,
    fileUrl: inv.generated_document_url,
    canExpand: false,
    onClick: () => navigate('/invoices'),
  };
}

export function buildExpenseItem(exp, navigate) {
  const cfg = getEventTypeConfig('expense');
  return {
    id: `exp-${exp.id}`,
    type: 'expense',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: exp.created_date,
    title: `${exp.vendor_name || 'Expense'} · $${Number(exp.total_amount || 0).toFixed(2)}`,
    body: exp.description || exp.notes || null,
    sub: [exp.category, exp.inbox_status].filter(Boolean).join(' · '),
    actor: exp.submitted_by || null,
    hasFile: !!exp.file_url,
    fileUrl: exp.file_url,
    canExpand: false,
    onClick: () => navigate('/expenses'),
  };
}

export function buildTaskItem(task, navigate) {
  const cfg = getEventTypeConfig('task');
  return {
    id: `task-${task.id}`,
    type: 'task',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: task.created_date,
    title: task.title,
    body: task.description || task.notes || null,
    sub: [task.status, task.due_date ? `Due ${task.due_date}` : null].filter(Boolean).join(' · '),
    actor: task.created_by_name || null,
    hasFile: false,
    fileUrl: null,
    canExpand: false,
    onClick: () => navigate(`/tasks/${task.id}`),
  };
}

export function buildWarrantyItem(w, navigate) {
  const cfg = getEventTypeConfig('warranty');
  return {
    id: `wt-${w.id}`,
    type: 'warranty',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: w.created_date,
    title: w.title || 'Warranty item',
    body: w.issue_description || null,
    sub: [w.status, w.category].filter(Boolean).join(' · '),
    actor: null,
    hasFile: false,
    fileUrl: null,
    canExpand: false,
    onClick: () => navigate(`/warranty/${w.id}`),
  };
}

export function buildFileItem(file) {
  const cfg = getEventTypeConfig('file');
  const catLabel = file.category
    ? file.category.replace(/_/g, ' ')
    : null;
  const sourceLabel = file.related_module_label || (file.related_module && file.related_module !== 'job'
    ? file.related_module.replace(/_/g, ' ')
    : null);
  return {
    id: `file-${file.id}`,
    type: 'file',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: file.created_date,
    title: file.file_name,
    body: file.description || null,
    sub: [catLabel, sourceLabel ? `via ${sourceLabel}` : null].filter(Boolean).join(' · ') || null,
    actor: file.uploaded_by_name || null,
    hasFile: true,
    fileUrl: file.file_url,
    fileName: file.file_name,
    canExpand: false,
    onClick: () => window.open(file.file_url, '_blank'),
  };
}

export function buildTimeEntryItem(e, navigate) {
  const cfg = getEventTypeConfig('time_entry');
  const dur = e.duration_minutes
    ? `${Math.floor(e.duration_minutes / 60)}h ${e.duration_minutes % 60}m`
    : 'Active';
  return {
    id: `te-${e.id}`,
    type: 'time_entry',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: e.clock_in,
    title: `${e.employee_name || 'Employee'} · ${dur}`,
    body: e.employee_note || e.admin_note || null,
    sub: [e.cost_code, e.entry_date].filter(Boolean).join(' · '),
    actor: null,
    hasFile: false,
    fileUrl: null,
    canExpand: false,
    onClick: () => navigate(`/time-entries/${e.id}`),
  };
}

export function buildScheduleItem(ev, navigate) {
  const cfg = getEventTypeConfig('schedule');
  const dateStr = ev.start_date
    ? (() => { try { return new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); } catch { return ev.start_date; } })()
    : null;
  return {
    id: `sched-${ev.id}`,
    type: 'schedule',
    displayType: cfg.label,
    badgeColor: cfg.badgeColor,
    dotColor: cfg.dotColor,
    ts: ev.created_date || ev.start_date,
    title: ev.title,
    body: ev.notes || null,
    sub: [dateStr, ev.status, ev.assigned_to].filter(Boolean).join(' · '),
    actor: ev.created_by_name || null,
    hasFile: false,
    fileUrl: null,
    canExpand: false,
    onClick: () => navigate('/calendar'),
  };
}

// Sort feed items newest-first
export function sortFeed(items) {
  return [...items].sort((a, b) => {
    const at = a.ts ? new Date(a.ts).getTime() : 0;
    const bt = b.ts ? new Date(b.ts).getTime() : 0;
    return bt - at;
  });
}