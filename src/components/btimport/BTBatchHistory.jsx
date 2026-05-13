import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const DRY_RUN_BADGE = {
  pending:  { label: 'Pending',  className: 'bg-muted text-muted-foreground' },
  running:  { label: 'Running',  className: 'bg-blue-100 text-blue-700' },
  complete: { label: 'Complete', className: 'bg-green-100 text-green-700' },
  failed:   { label: 'Failed',   className: 'bg-destructive/10 text-destructive' },
};

const IMPORT_BADGE = {
  not_started: { label: 'Not Imported',  className: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In Progress',   className: 'bg-blue-100 text-blue-700' },
  complete:    { label: 'Imported',      className: 'bg-green-100 text-green-700' },
  partial:     { label: 'Partial',       className: 'bg-amber-100 text-amber-700' },
  failed:      { label: 'Failed',        className: 'bg-destructive/10 text-destructive' },
  rolled_back: { label: 'Rolled Back',   className: 'bg-secondary text-secondary-foreground' },
};

export default function BTBatchHistory({ batches }) {
  if (!batches.length) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {batches.map((batch, i) => {
        const dryBadge    = DRY_RUN_BADGE[batch.dry_run_status] || DRY_RUN_BADGE.pending;
        const importBadge = IMPORT_BADGE[batch.import_status]   || IMPORT_BADGE.not_started;
        const dateStr = batch.uploaded_at
          ? format(new Date(batch.uploaded_at), 'MMM d, yyyy h:mm a')
          : 'Unknown date';

        return (
          <div key={batch.id} className={`px-4 py-3 ${i > 0 ? 'border-t border-border/60' : ''}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate max-w-xs">{batch.source_file_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{dateStr} · {batch.uploaded_by || '—'}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-[10px] ${dryBadge.className}`}>Dry-run: {dryBadge.label}</Badge>
                <Badge className={`text-[10px] ${importBadge.className}`}>{importBadge.label}</Badge>
                {batch.staged_count > 0 && (
                  <span className="text-xs text-muted-foreground">{batch.staged_count} staged</span>
                )}
                {batch.imported_count > 0 && (
                  <span className="text-xs text-green-700">{batch.imported_count} imported</span>
                )}
                {batch.error_count > 0 && (
                  <span className="text-xs text-destructive">{batch.error_count} errors</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}