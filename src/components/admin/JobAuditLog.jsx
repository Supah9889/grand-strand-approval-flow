import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Loader2, Clock } from 'lucide-react';
import { ACTION_LABELS } from '@/lib/audit';

export default function JobAuditLog({ jobId }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit', jobId],
    queryFn: () => base44.entities.AuditLog.filter({ job_id: jobId }, 'timestamp'),
    enabled: !!jobId,
  });

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  if (logs.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">No history yet.</p>;
  }

  return (
    <div className="relative pl-4 space-y-0">
      {/* vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

      {logs.map((log, i) => {
        const cfg = ACTION_LABELS[log.action] || { label: log.action, color: 'text-foreground' };
        return (
          <div key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* dot */}
            <div className="shrink-0 w-3 h-3 rounded-full bg-border border-2 border-background mt-1 z-10" />
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${cfg.color} leading-snug`}>{cfg.label}</p>
              {log.detail && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.detail}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground/70">
                <Clock className="w-3 h-3" />
                {log.timestamp ? format(new Date(log.timestamp), 'MMM d, yyyy · h:mm a') : '—'}
                {log.actor && <span>· {log.actor}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}