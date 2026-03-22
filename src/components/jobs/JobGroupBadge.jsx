import React from 'react';
import { JOB_GROUP_CONFIG } from '@/lib/jobHelpers';

export default function JobGroupBadge({ group }) {
  if (!group) return null;
  const cfg = JOB_GROUP_CONFIG[group] || JOB_GROUP_CONFIG.other;
  return (
    <span className={`inline-flex items-center rounded-full text-xs px-2 py-0.5 font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}