import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Shield, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ACTION_LABELS } from '@/lib/audit';

/**
 * Reusable audit history panel.
 * Props:
 *   recordId  - the specific record to show history for (filters by record_id)
 *   jobId     - optionally also show all events for a job
 *   title     - section title (default: "History")
 *   limit     - max events (default 50)
 *   compact   - show condensed view
 */
export default function AuditHistory({ recordId, jobId, title = 'History', limit = 50, compact = false }) {
  const [expanded, setExpanded] = useState(!compact);
  const [showSensitiveOnly, setShowSensitiveOnly] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-history', recordId, jobId],
    queryFn: async () => {
      const results = [];
      if (recordId) {
        const byRecord = await base44.entities.AuditLog.filter({ record_id: recordId }, '-timestamp', limit);
        results.push(...byRecord);
      }
      if (jobId && jobId !== recordId) {
        const byJob = await base44.entities.AuditLog.filter({ job_id: jobId }, '-timestamp', limit);
        byJob.forEach(l => { if (!results.find(r => r.id === l.id)) results.push(l); });
      }
      return results.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    },
    enabled: !!(recordId || jobId),
  });

  const displayed = showSensitiveOnly ? logs.filter(l => l.is_sensitive || l.is_override) : logs;

  if (compact && !expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
        <ChevronRight className="w-3.5 h-3.5" />
        {title} ({logs.length})
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => compact && setExpanded(false)} className="flex items-center gap-1.5">
          {compact && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
        </button>
        <div className="flex items-center gap-2">
          {logs.some(l => l.is_sensitive) && (
            <button
              onClick={() => setShowSensitiveOnly(v => !v)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${showSensitiveOnly ? 'bg-amber-100 text-amber-700 border-amber-200' : 'border-border text-muted-foreground hover:border-amber-300'}`}
            >
              <Shield className="w-3 h-3 inline mr-0.5" />Sensitive Only
            </button>
          )}
          <span className="text-xs text-muted-foreground">{displayed.length} events</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
      ) : displayed.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">No history recorded.</p>
      ) : (
        <div className="space-y-0 divide-y divide-border border border-border rounded-xl overflow-hidden">
          {displayed.map((log, i) => {
            const cfg = ACTION_LABELS[log.action] || { label: log.action, color: 'text-foreground' };
            return (
              <AuditRow key={log.id || i} log={log} cfg={cfg} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AuditRow({ log, cfg }) {
  const [open, setOpen] = useState(false);
  const hasDetail = log.old_value || log.new_value || log.reason;

  return (
    <div className={`px-3 py-2.5 ${log.is_override ? 'bg-red-50' : log.is_sensitive ? 'bg-amber-50/40' : 'bg-card'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          {(log.is_override || log.is_sensitive) && (
            <AlertTriangle className={`w-3 h-3 mt-0.5 shrink-0 ${log.is_override ? 'text-red-500' : 'text-amber-500'}`} />
          )}
          <div className="min-w-0">
            <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
            {log.detail && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{log.detail}</p>}
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {log.actor}{log.actor_role && ` (${log.actor_role})`}
              {log.timestamp && ` · ${format(parseISO(log.timestamp), 'MMM d, yyyy h:mm a')}`}
            </p>
          </div>
        </div>
        {hasDetail && (
          <button onClick={() => setOpen(v => !v)} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {open && hasDetail && (
        <div className="mt-2 ml-5 space-y-1.5 text-xs">
          {log.reason && (
            <div className="bg-white border border-border rounded-lg px-2 py-1.5">
              <span className="font-medium text-muted-foreground">Reason: </span>
              <span className="text-foreground">{log.reason}</span>
            </div>
          )}
          {log.old_value && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">
              <span className="font-medium text-red-600">Old: </span>
              <span className="text-red-700 break-all">{log.old_value}</span>
            </div>
          )}
          {log.new_value && (
            <div className="bg-green-50 border border-green-100 rounded-lg px-2 py-1.5">
              <span className="font-medium text-green-600">New: </span>
              <span className="text-green-700 break-all">{log.new_value}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}