export const JOB_LIFECYCLE_CONFIG = {
  presale:     { label: 'Presale',     color: 'bg-slate-100 text-slate-600',   border: 'border-slate-200' },
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700',     border: 'border-blue-200' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700',   border: 'border-amber-200' },
  waiting:     { label: 'Waiting',     color: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700',   border: 'border-green-200' },
  warranty:    { label: 'Warranty',    color: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
  closed:      { label: 'Closed',      color: 'bg-gray-100 text-gray-500',     border: 'border-gray-200' },
  archived:    { label: 'Archived',    color: 'bg-muted text-muted-foreground',border: 'border-border' },
  canceled:    { label: 'Canceled',    color: 'bg-red-100 text-red-600',       border: 'border-red-200' },
  on_hold:     { label: 'On Hold',     color: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200' },
};

// ── Operational status system ─────────────────────────────────────────────────
// Groups: neutral | attention | waiting | active | paused | financial/done
export const OP_STATUS_CONFIG = {
  new:               { label: 'New',                  group: 'neutral',    color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  needs_review:      { label: 'Needs Review',         group: 'neutral',    color: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-400' },
  needs_scheduling:  { label: 'Needs Scheduling',     group: 'attention',  color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500' },
  waiting_homeowner: { label: 'Waiting on Homeowner', group: 'waiting',    color: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-500' },
  waiting_builder:   { label: 'Waiting on Builder',   group: 'waiting',    color: 'bg-orange-50 text-orange-600',   dot: 'bg-orange-400' },
  waiting_vendor:    { label: 'Waiting on Vendor/Sub', group: 'waiting',   color: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-500' },
  waiting_materials: { label: 'Waiting on Materials', group: 'waiting',    color: 'bg-yellow-50 text-yellow-600',   dot: 'bg-yellow-400' },
  scheduled:         { label: 'Scheduled',            group: 'active',     color: 'bg-cyan-50 text-cyan-700',       dot: 'bg-cyan-500' },
  in_progress:       { label: 'In Progress',          group: 'active',     color: 'bg-primary/10 text-primary',     dot: 'bg-primary' },
  on_hold:           { label: 'On Hold',              group: 'paused',     color: 'bg-red-50 text-red-600',         dot: 'bg-red-400' },
  complete:          { label: 'Complete',             group: 'done',       color: 'bg-green-100 text-green-700',    dot: 'bg-green-500' },
  invoiced:          { label: 'Invoiced',             group: 'financial',  color: 'bg-teal-50 text-teal-700',       dot: 'bg-teal-500' },
  paid:              { label: 'Paid',                 group: 'financial',  color: 'bg-green-50 text-green-600',     dot: 'bg-green-400' },
  closed:            { label: 'Closed',               group: 'done',       color: 'bg-muted text-muted-foreground', dot: 'bg-slate-300' },
};

export const OP_STATUS_GROUPS = [
  { key: 'neutral',   label: 'New / Review',  statuses: ['new', 'needs_review'] },
  { key: 'attention', label: 'Action Needed', statuses: ['needs_scheduling'] },
  { key: 'waiting',   label: 'Waiting',       statuses: ['waiting_homeowner','waiting_builder','waiting_vendor','waiting_materials'] },
  { key: 'active',    label: 'Active',        statuses: ['scheduled','in_progress'] },
  { key: 'paused',    label: 'Paused',        statuses: ['on_hold'] },
  { key: 'done',      label: 'Finished',      statuses: ['complete','closed'] },
  { key: 'financial', label: 'Financial',     statuses: ['invoiced','paid'] },
];

// Grouped filter buckets for list views
export const OP_STATUS_FILTER_BUCKETS = [
  { key: 'all',       label: 'All' },
  { key: 'open',      label: 'Open',      statuses: ['new','needs_review','needs_scheduling','waiting_homeowner','waiting_builder','waiting_vendor','waiting_materials','scheduled','in_progress','on_hold'] },
  { key: 'waiting',   label: 'Waiting',   statuses: ['waiting_homeowner','waiting_builder','waiting_vendor','waiting_materials'] },
  { key: 'active',    label: 'Active',    statuses: ['scheduled','in_progress'] },
  { key: 'financial', label: 'Financial', statuses: ['invoiced','paid'] },
  { key: 'finished',  label: 'Finished',  statuses: ['complete','closed'] },
];

export function getOpStatus(job) {
  return job?.op_status || 'new';
}

export function getOpStatusConfig(statusKey) {
  return OP_STATUS_CONFIG[statusKey] || OP_STATUS_CONFIG.new;
}

export const JOB_GROUP_CONFIG = {
  painting:       { label: 'Painting',         color: 'bg-blue-50 text-blue-700' },
  drywall:        { label: 'Drywall',          color: 'bg-stone-50 text-stone-700' },
  carpentry:      { label: 'Carpentry',        color: 'bg-amber-50 text-amber-700' },
  water_mitigation:{ label: 'Water / Mitigation', color: 'bg-cyan-50 text-cyan-700' },
  warranty:       { label: 'Warranty',         color: 'bg-violet-50 text-violet-700' },
  estimate_only:  { label: 'Estimate Only',    color: 'bg-slate-50 text-slate-600' },
  insurance:      { label: 'Insurance',        color: 'bg-emerald-50 text-emerald-700' },
  builder_vendor: { label: 'Builder / Vendor', color: 'bg-teal-50 text-teal-700' },
  residential:    { label: 'Residential',      color: 'bg-green-50 text-green-700' },
  commercial:     { label: 'Commercial',       color: 'bg-indigo-50 text-indigo-700' },
  internal:       { label: 'Internal',         color: 'bg-gray-50 text-gray-600' },
  other:          { label: 'Other',            color: 'bg-muted text-muted-foreground' },
};

export const ACTIVE_LIFECYCLE_STATUSES = ['open','in_progress','waiting','warranty','on_hold'];
export const CLOSED_LIFECYCLE_STATUSES = ['completed','closed','archived','canceled'];