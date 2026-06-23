import React from 'react';

const STATUS_MAP = {
  imported:     { label: 'Imported',     color: 'bg-blue-100 text-blue-800' },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-800' },
  linked:       { label: 'Linked',       color: 'bg-purple-100 text-purple-800' },
  converted:    { label: 'Converted',    color: 'bg-green-100 text-green-800' },
  archived:     { label: 'Archived',     color: 'bg-muted text-muted-foreground' },
  duplicate:    { label: 'Duplicate',    color: 'bg-yellow-100 text-yellow-800' },
  error:        { label: 'Error',        color: 'bg-red-100 text-red-800' },
};

export default function LegacyStatusBadge({ status }) {
  const cfg = STATUS_MAP[status] || { label: status, color: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}