import React from 'react';

export const STATUS_CONFIG = {
  open:         { label: 'Open',         color: 'bg-blue-100 text-blue-700' },
  in_progress:  { label: 'In Progress',  color: 'bg-amber-100 text-amber-700' },
  waiting:      { label: 'Waiting',      color: 'bg-slate-100 text-slate-600' },
  needs_review: { label: 'Needs Review', color: 'bg-violet-100 text-violet-700' },
  completed:    { label: 'Completed',    color: 'bg-green-100 text-green-700' },
  closed:       { label: 'Closed',       color: 'bg-gray-100 text-gray-500' },
  on_hold:      { label: 'On Hold',      color: 'bg-slate-100 text-slate-500' },
  blocked:      { label: 'Blocked',      color: 'bg-red-100 text-red-700' },
  canceled:     { label: 'Canceled',     color: 'bg-gray-100 text-gray-400' },
};

export const PRIORITY_CONFIG = {
  low:    { label: 'Low',    dot: 'bg-slate-300',  text: 'text-slate-500' },
  normal: { label: 'Normal', dot: 'bg-blue-400',   text: 'text-blue-600' },
  high:   { label: 'High',   dot: 'bg-orange-500', text: 'text-orange-600' },
  urgent: { label: 'Urgent', dot: 'bg-red-500',    text: 'text-red-600' },
};

export default function TaskStatusBadge({ status, size = 'sm' }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${cfg.color} ${
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
    }`}>{cfg.label}</span>
  );
}