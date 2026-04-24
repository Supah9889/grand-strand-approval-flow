import React from 'react';
import { CheckCircle2, AlertTriangle, Clock, Download } from 'lucide-react';
import { format } from 'date-fns';
import { EXPORT_TYPES } from '@/lib/exportHelpers';

export default function ExportHistory({ batches }) {
  if (!batches.length) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-muted-foreground">No exports yet. Run your first export above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {batches.map(b => {
        const typeCfg = EXPORT_TYPES.find(t => t.key === b.export_type);
        const isOk = b.status === 'completed';
        return (
          <div key={b.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isOk ? 'bg-green-100' : 'bg-red-100'}`}>
              {isOk
                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                : <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground truncate">
                  {typeCfg?.label || b.export_type} · {b.export_format?.toUpperCase() || 'CSV'}
                </p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {b.exported_at ? format(new Date(b.exported_at), 'MMM d, h:mm a') : ''}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Batch <span className="font-mono font-medium">{b.batch_number}</span>
                {' · '}{b.exported_count ?? b.record_count ?? 0} records
                {b.failed_count > 0 && <span className="text-red-500"> · {b.failed_count} failed</span>}
                {b.exported_by && <span className="ml-1">· by {b.exported_by}</span>}
              </p>
              {b.notes && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{b.notes}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}