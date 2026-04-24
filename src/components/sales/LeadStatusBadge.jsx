import React from 'react';

const STATUS_CONFIG = {
  new_lead:             { label: 'New Lead',            color: 'bg-blue-100 text-blue-700' },
  contacted:            { label: 'Contacted',           color: 'bg-sky-100 text-sky-700' },
  qualified:            { label: 'Qualified',           color: 'bg-violet-100 text-violet-700' },
  estimate_scheduled:   { label: 'Est. Scheduled',      color: 'bg-amber-100 text-amber-700' },
  estimate_in_progress: { label: 'Est. In Progress',    color: 'bg-orange-100 text-orange-700' },
  estimate_sent:        { label: 'Est. Sent',           color: 'bg-yellow-100 text-yellow-700' },
  waiting_on_approval:  { label: 'Waiting Approval',    color: 'bg-purple-100 text-purple-700' },
  follow_up_needed:     { label: 'Follow-Up Needed',    color: 'bg-rose-100 text-rose-700' },
  won:                  { label: 'Won',                 color: 'bg-green-100 text-green-700' },
  lost:                 { label: 'Lost',                color: 'bg-red-100 text-red-700' },
  converted_to_job:     { label: 'Converted to Job',    color: 'bg-primary/10 text-primary' },
  no_response:          { label: 'No Response',         color: 'bg-muted text-muted-foreground' },
  on_hold:              { label: 'On Hold',             color: 'bg-slate-100 text-slate-600' },
  not_qualified:        { label: 'Not Qualified',       color: 'bg-gray-100 text-gray-600' },
  duplicate:            { label: 'Duplicate',           color: 'bg-gray-100 text-gray-500' },
  archived:             { label: 'Archived',            color: 'bg-gray-100 text-gray-500' },
};

export const STATUSES = Object.entries(STATUS_CONFIG).map(([value, cfg]) => ({ value, ...cfg }));

export default function LeadStatusBadge({ status, size = 'sm' }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${cfg.color} ${
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
    }`}>
      {cfg.label}
    </span>
  );
}

export { STATUS_CONFIG };