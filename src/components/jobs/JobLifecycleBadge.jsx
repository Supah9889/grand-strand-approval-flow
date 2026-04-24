import React from 'react';
import { JOB_LIFECYCLE_CONFIG } from '@/lib/jobHelpers';

export default function JobLifecycleBadge({ status, size = 'sm' }) {
  const cfg = JOB_LIFECYCLE_CONFIG[status] || JOB_LIFECYCLE_CONFIG.open;
  const sz = size === 'lg' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5';
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sz} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}