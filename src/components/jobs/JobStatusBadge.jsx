import React from 'react';
import { getOpStatusConfig } from '@/lib/jobHelpers';

/**
 * Displays the operational status (op_status) of a job as a compact pill badge.
 * Falls back to 'new' for jobs without an op_status set.
 */
export default function JobStatusBadge({ status, size = 'sm' }) {
  const cfg = getOpStatusConfig(status || 'new');
  const sz = size === 'lg' ? 'text-sm px-2.5 py-1' : 'text-[11px] px-2 py-0.5';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold leading-none ${sz} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}