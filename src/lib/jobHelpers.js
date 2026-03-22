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