import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, Copy } from 'lucide-react';

function safeJson(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}

const STATUS_BADGE = {
  pending:      { label: 'Pending',      className: 'bg-muted text-muted-foreground' },
  approved:     { label: 'Approved',     className: 'bg-green-100 text-green-700' },
  skipped:      { label: 'Skipped',      className: 'bg-secondary text-secondary-foreground' },
  needs_review: { label: 'Needs Review', className: 'bg-amber-100 text-amber-700' },
};

const MATCH_BADGE = {
  matched_staged: { label: 'Matched Staged',  className: 'bg-primary/10 text-primary' },
  matched_live:   { label: 'Matched Live',    className: 'bg-green-100 text-green-700' },
  unmatched:      { label: 'Unmatched',       className: 'bg-amber-100 text-amber-700' },
  office_unmapped:{ label: 'Office/Internal', className: 'bg-secondary text-secondary-foreground' },
  needs_review:   { label: 'Needs Review',    className: 'bg-amber-100 text-amber-700' },
};

export default function BTStagedEventsTable({ events, onStatusChange }) {
  const [expanded, setExpanded] = useState(null);

  if (!events.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No calendar events staged.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span>Event</span>
        <span className="px-2">Match</span>
        <span className="px-2">Status</span>
        <span className="px-2">Actions</span>
      </div>
      {events.map(ev => {
        const isOpen = expanded === ev.id;
        const warnings = safeJson(ev.warnings);
        const statusBadge = STATUS_BADGE[ev.review_status] || STATUS_BADGE.pending;
        const matchBadge = ev.is_office_event
          ? MATCH_BADGE.office_unmapped
          : (MATCH_BADGE[ev.match_status] || MATCH_BADGE.unmatched);

        return (
          <div key={ev.id} className="border-t border-border/60">
            <div
              className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-3 hover:bg-muted/30 cursor-pointer items-center"
              onClick={() => setExpanded(isOpen ? null : ev.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ev.event_title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.event_date}
                    {ev.start_time && ` - ${ev.start_time}${ev.end_time ? `-${ev.end_time}` : ''}`}
                    {ev.source_job_name && ` - ${ev.source_job_name}`}
                    {ev.duplicate_hash && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-muted-foreground">
                        <Copy className="w-2.5 h-2.5" /> deduped
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Badge className={`text-[10px] mx-2 ${matchBadge.className}`}>{matchBadge.label}</Badge>
              <Badge className={`text-[10px] mx-2 ${statusBadge.className}`}>{statusBadge.label}</Badge>
              <div className="flex items-center gap-1 mx-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onStatusChange(ev.id, 'approved')}
                  className={`p-1 rounded transition-colors ${ev.review_status === 'approved' ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'}`}
                  title="Approve"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStatusChange(ev.id, 'skipped')}
                  className={`p-1 rounded transition-colors ${ev.review_status === 'skipped' ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                  title="Skip"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="bg-muted/20 border-t border-border/40 px-6 py-3 text-xs space-y-1 text-muted-foreground">
                <p>Category: <span className="text-foreground">{ev.event_category}</span></p>
                <p>Non-production: <span className="text-foreground">{ev.is_non_production ? 'Yes' : 'No'}</span></p>
                <p>Office event: <span className="text-foreground">{ev.is_office_event ? 'Yes' : 'No'}</span></p>
                <p>Source row: <span className="text-foreground">{ev.source_row}</span></p>
                {ev.source_page && <p>Source page: <span className="text-foreground">{ev.source_page}</span></p>}
                {warnings.length > 0 && (
                  <div className="flex gap-1 flex-wrap pt-1">
                    {warnings.map((warning, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-2.5 h-2.5" /> {warning}
                      </span>
                    ))}
                  </div>
                )}
                {ev.raw_source_text && (
                  <details className="pt-1">
                    <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground select-none">Raw source text</summary>
                    <pre
                      className="mt-1 text-[10px] text-muted-foreground bg-muted/40 rounded p-2 whitespace-pre-wrap break-all max-h-32 overflow-y-auto"
                      style={{ userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text' }}
                    >
                      {ev.raw_source_text}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
