import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

function safeJson(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}

const STATUS_BADGE = {
  pending:     { label: 'Pending',    className: 'bg-muted text-muted-foreground' },
  approved:    { label: 'Approved',   className: 'bg-green-100 text-green-700' },
  skipped:     { label: 'Skipped',    className: 'bg-secondary text-secondary-foreground' },
  needs_review:{ label: 'Needs Review', className: 'bg-amber-100 text-amber-700' },
};

const MATCH_BADGE = {
  new:               { label: 'New',              className: 'bg-primary/10 text-primary' },
  possible_duplicate:{ label: 'Possible Dup',     className: 'bg-amber-100 text-amber-700' },
  matched_existing:  { label: 'Matches Live Job', className: 'bg-blue-100 text-blue-700' },
  needs_review:      { label: 'Needs Review',     className: 'bg-amber-100 text-amber-700' },
};

export default function BTStagedJobsTable({ jobs, onStatusChange }) {
  const [expanded, setExpanded] = useState(null);

  if (!jobs.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No jobsites staged.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span>Job</span>
        <span className="px-2">Match</span>
        <span className="px-2">Status</span>
        <span className="px-2">Actions</span>
      </div>
      {jobs.map(job => {
        const isOpen = expanded === job.id;
        const warnings = safeJson(job.warnings);
        const flags = safeJson(job.flags);
        const statusBadge = STATUS_BADGE[job.review_status] || STATUS_BADGE.pending;
        const matchBadge  = MATCH_BADGE[job.match_status]   || MATCH_BADGE.new;

        return (
          <div key={job.id} className="border-t border-border/60">
            <div
              className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-4 py-3 hover:bg-muted/30 cursor-pointer items-center"
              onClick={() => setExpanded(isOpen ? null : job.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{job.clean_job_name || job.raw_job_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{[job.address, job.city, job.state].filter(Boolean).join(', ') || '—'}</p>
                </div>
              </div>
              <Badge className={`text-[10px] mx-2 ${matchBadge.className}`}>{matchBadge.label}</Badge>
              <Badge className={`text-[10px] mx-2 ${statusBadge.className}`}>{statusBadge.label}</Badge>
              <div className="flex items-center gap-1 mx-2" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => onStatusChange(job.id, 'approved')}
                  className={`p-1 rounded transition-colors ${job.review_status === 'approved' ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'}`}
                  title="Approve"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStatusChange(job.id, 'skipped')}
                  className={`p-1 rounded transition-colors ${job.review_status === 'skipped' ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`}
                  title="Skip"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="bg-muted/20 border-t border-border/40 px-6 py-3 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-muted-foreground">
                  <p>Raw name: <span className="text-foreground">{job.raw_job_name}</span></p>
                  <p>Customer: <span className="text-foreground">{job.customer_name || '—'}</span></p>
                  <p>Phone: <span className="text-foreground">{job.customer_phone || '—'}</span></p>
                  <p>Email: <span className="text-foreground">{job.customer_email || '—'}</span></p>
                  <p>Received: <span className="text-foreground">{job.received_date || '—'}</span></p>
                  <p>Sq Ft: <span className="text-foreground">{job.square_footage || '—'}</span></p>
                  <p>Schedule status: <span className="text-foreground">{job.schedule_status || '—'}</span></p>
                  <p>Source row: <span className="text-foreground">{job.source_row}</span></p>
                </div>
                {warnings.length > 0 && (
                  <div className="flex gap-1 flex-wrap pt-1">
                    {warnings.map((w, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-2.5 h-2.5" /> {w}
                      </span>
                    ))}
                  </div>
                )}
                {flags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {flags.map((f, i) => (
                      <span key={i} className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}