import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Paperclip } from 'lucide-react';

const STATUS_BADGE = {
  pending:     { label: 'Pending',  className: 'bg-muted text-muted-foreground' },
  approved:    { label: 'Approved', className: 'bg-green-100 text-green-700' },
  skipped:     { label: 'Skipped', className: 'bg-secondary text-secondary-foreground' },
  needs_review:{ label: 'Needs Review', className: 'bg-amber-100 text-amber-700' },
};

const MATCH_BADGE = {
  matched_staged: { label: 'Matched Staged', className: 'bg-primary/10 text-primary' },
  matched_live:   { label: 'Matched Live',   className: 'bg-green-100 text-green-700' },
  unmatched:      { label: 'Unmatched',      className: 'bg-amber-100 text-amber-700' },
  needs_review:   { label: 'Needs Review',   className: 'bg-amber-100 text-amber-700' },
};

export default function BTStagedLogsTable({ logs, onStatusChange }) {
  const [expanded, setExpanded] = useState(null);

  if (!logs.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No daily logs staged.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span>Log</span>
        <span className="px-2">Match</span>
        <span className="px-2">Status</span>
        <span className="px-2">Actions</span>
      </div>
      {logs.map(log => {
        const isOpen = expanded === log.id;
        const statusBadge = STATUS_BADGE[log.review_status] || STATUS_BADGE.pending;
        const matchBadge  = MATCH_BADGE[log.match_status]   || MATCH_BADGE.unmatched;

        return (
          <div key={log.id} className="border-t border-border/60">
            <div
              className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-3 hover:bg-muted/30 cursor-pointer items-center"
              onClick={() => setExpanded(isOpen ? null : log.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{log.log_date}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {log.source_job_name || '(no job name)'}
                    {log.needs_attachment_review && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600">
                        <Paperclip className="w-2.5 h-2.5" /> {log.attachment_count}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Badge className={`text-[10px] mx-2 ${matchBadge.className}`}>{matchBadge.label}</Badge>
              <Badge className={`text-[10px] mx-2 ${statusBadge.className}`}>{statusBadge.label}</Badge>
              <div className="flex items-center gap-1 mx-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onStatusChange(log.id, 'approved')}
                  className={`p-1 rounded transition-colors ${log.review_status === 'approved' ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'}`}
                  title="Approve"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStatusChange(log.id, 'skipped')}
                  className={`p-1 rounded transition-colors ${log.review_status === 'skipped' ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                  title="Skip"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="bg-muted/20 border-t border-border/40 px-6 py-3 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-muted-foreground">
                  <p>Added by: <span className="text-foreground">{log.added_by || '—'}</span></p>
                  <p>Weather: <span className="text-foreground">{log.weather_summary || '—'}</span></p>
                  <p>Temp: <span className="text-foreground">{log.temp_high != null ? `${log.temp_high}°F / ${log.temp_low ?? '?'}°F` : '—'}</span></p>
                  <p>Attachments: <span className="text-foreground">{log.attachment_count || 0}</span></p>
                </div>
                {log.log_notes && (
                  <p className="text-muted-foreground whitespace-pre-wrap line-clamp-4">{log.log_notes}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}