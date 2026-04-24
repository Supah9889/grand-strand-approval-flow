import React from 'react';
import { EXPORT_STATUS_CONFIG } from '@/lib/exportHelpers';

export default function ExportStatusBadge({ status }) {
  const cfg = EXPORT_STATUS_CONFIG[status] || EXPORT_STATUS_CONFIG['not_exported'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}