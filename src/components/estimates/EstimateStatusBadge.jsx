import React from 'react';
import { ESTIMATE_STATUS_CONFIG } from '@/lib/estimateHelpers';

export default function EstimateStatusBadge({ status, size = 'sm' }) {
  const cfg = ESTIMATE_STATUS_CONFIG[status] || { label: status, color: 'bg-muted text-muted-foreground' };
  return (
    <span className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${cfg.color} ${
      size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
    }`}>
      {cfg.label}
    </span>
  );
}