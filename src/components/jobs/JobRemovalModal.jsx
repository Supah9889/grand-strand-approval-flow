/**
 * JobRemovalModal
 * Universal modal for archive/delete batch or single job actions.
 * Shows classification, child counts, and requires confirmation before execution.
 */
import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, Archive, Shield, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  REMOVAL_ACTION,
  classifyJobRemovalAction,
  fetchChildCountsForJobs,
  processBatchRemoval,
} from '@/lib/jobLifecycle';
import { getSession } from '@/lib/adminAuth';

const ACTION_CONFIG = {
  [REMOVAL_ACTION.HARD_DELETE]: {
    label: 'Will be deleted',
    color: 'text-destructive',
    bg: 'bg-destructive/5 border-destructive/20',
    icon: Trash2,
  },
  [REMOVAL_ACTION.ARCHIVE_ONLY]: {
    label: 'Will be archived',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
    icon: Archive,
  },
  [REMOVAL_ACTION.PROTECTED]: {
    label: 'Protected — skipped',
    color: 'text-muted-foreground',
    bg: 'bg-muted border-border',
    icon: Shield,
  },
};

/**
 * props:
 *   jobs       — array of job objects to process
 *   mode       — 'archive' | 'delete' (which action the user clicked)
 *   onClose    — called when modal should close
 *   onSuccess  — called after successful execution with report
 */
export default function JobRemovalModal({ jobs, mode, onClose, onSuccess }) {
  const [phase, setPhase] = useState('loading'); // loading | review | confirm | executing | done
  const [classified, setClassified] = useState([]);
  const [confirmation, setConfirmation] = useState('');
  const [report, setReport] = useState(null);
  const actorName = getSession()?.employee?.name || getSession()?.name || 'admin';
  const needsTypedConfirm = mode === 'delete' && jobs.length > 1;

  useEffect(() => {
    if (!jobs?.length) { onClose(); return; }
    (async () => {
      try {
        const ids = jobs.map(j => j.id);
        const childCounts = await fetchChildCountsForJobs(ids);

        const results = jobs.map(job => {
          const counts = childCounts[job.id] || {};
          let { action, reason } = classifyJobRemovalAction(job, counts);

          // If the user clicked "Archive", force ARCHIVE_ONLY unless PROTECTED
          if (mode === 'archive' && action !== REMOVAL_ACTION.PROTECTED) {
            action = REMOVAL_ACTION.ARCHIVE_ONLY;
            reason = 'Archived by admin';
          }

          const totalChildren = Object.values(counts).reduce((a, b) => a + b, 0);
          return { job, action, reason, childCounts: counts, totalChildren };
        });

        setClassified(results);
        setPhase('review');
      } catch (err) {
        console.error(err);
        setPhase('review');
      }
    })();
  }, [jobs, mode]);

  const handleExecute = async () => {
    if (needsTypedConfirm && confirmation !== 'CONFIRM') return;
    setPhase('executing');

    // Separate by action
    const toProcess = classified.filter(c => c.action !== REMOVAL_ACTION.PROTECTED);
    const jobsToProcess = toProcess.map(c => c.job);
    const childCountsMap = Object.fromEntries(classified.map(c => [c.job.id, c.childCounts]));

    // If archive mode, override all to ARCHIVE
    const result = await processBatchRemoval(jobsToProcess, childCountsMap, { actorName });
    setReport(result);
    setPhase('done');
  };

  const hardDeleteCount = classified.filter(c => c.action === REMOVAL_ACTION.HARD_DELETE).length;
  const archiveCount    = classified.filter(c => c.action === REMOVAL_ACTION.ARCHIVE_ONLY).length;
  const protectedCount  = classified.filter(c => c.action === REMOVAL_ACTION.PROTECTED).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'delete' ? <Trash2 className="w-4 h-4 text-destructive" /> : <Archive className="w-4 h-4 text-amber-600" />}
            <p className="text-sm font-semibold text-foreground">
              {mode === 'delete' ? 'Delete' : 'Archive'} {jobs.length} Job{jobs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          {/* Loading */}
          {phase === 'loading' && (
            <div className="text-center py-8 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground">Analyzing job records…</p>
            </div>
          )}

          {/* Review */}
          {(phase === 'review' || phase === 'confirm') && classified.length > 0 && (
            <>
              <div className="flex gap-3 text-xs">
                {hardDeleteCount > 0 && (
                  <span className="px-2 py-1 bg-destructive/10 text-destructive rounded-lg font-medium">
                    {hardDeleteCount} will be deleted
                  </span>
                )}
                {archiveCount > 0 && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-medium">
                    {archiveCount} will be archived
                  </span>
                )}
                {protectedCount > 0 && (
                  <span className="px-2 py-1 bg-muted text-muted-foreground rounded-lg font-medium">
                    {protectedCount} protected
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {classified.map(({ job, action, reason, childCounts, totalChildren }) => {
                  const cfg = ACTION_CONFIG[action];
                  const Icon = cfg.icon;
                  const address = job?.address || job?.data?.address || job?.id;
                  const customer = job?.customer_name || job?.data?.customer_name || '';
                  const childEntries = Object.entries(childCounts).filter(([, v]) => v > 0);

                  return (
                    <div key={job.id} className={`border rounded-xl p-3 ${cfg.bg}`}>
                      <div className="flex items-start gap-2">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-foreground truncate">{address}</p>
                            <span className={`text-[10px] font-medium shrink-0 ${cfg.color}`}>{cfg.label}</span>
                          </div>
                          {customer && <p className="text-[10px] text-muted-foreground">{customer}</p>}
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{reason}</p>
                          {childEntries.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {childEntries.map(([entity, count]) => (
                                <span key={entity} className="text-[10px] px-1.5 py-0.5 bg-background/60 border border-border/40 rounded-full text-muted-foreground">
                                  {entity}: {count}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {protectedCount === classified.length && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  All selected jobs are protected and cannot be removed.
                </div>
              )}

              {protectedCount < classified.length && (
                <div className="space-y-3 border-t border-border pt-3">
                  {mode === 'delete' && (hardDeleteCount > 0) && (
                    <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Hard deletes are permanent. Archived jobs can be recovered. R2 file objects are not deleted.</span>
                    </div>
                  )}

                  {needsTypedConfirm ? (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        Type <code className="bg-muted px-1 py-0.5 rounded text-foreground">CONFIRM</code> to proceed:
                      </p>
                      <Input
                        value={confirmation}
                        onChange={e => setConfirmation(e.target.value)}
                        placeholder="CONFIRM"
                        className="rounded-lg font-mono text-sm max-w-xs"
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}

          {/* Executing */}
          {phase === 'executing' && (
            <div className="text-center py-8 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              <p className="text-xs text-muted-foreground">Processing…</p>
            </div>
          )}

          {/* Done */}
          {phase === 'done' && report && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <CheckCircle2 className="w-4 h-4" /> Done
              </div>
              {report.archived.length > 0 && (
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide">Archived ({report.archived.length})</p>
                  {report.archived.map((j, i) => <p key={i} className="text-foreground pl-2">{j.address}</p>)}
                </div>
              )}
              {report.hardDeleted.length > 0 && (
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide">Deleted ({report.hardDeleted.length})</p>
                  {report.hardDeleted.map((j, i) => <p key={i} className="text-foreground pl-2">{j.address}</p>)}
                </div>
              )}
              {report.protected.length > 0 && (
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-muted-foreground uppercase tracking-wide">Protected — skipped ({report.protected.length})</p>
                  {report.protected.map((j, i) => <p key={i} className="text-muted-foreground pl-2">{j.address} — {j.reason}</p>)}
                </div>
              )}
              {report.errors.length > 0 && (
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-destructive uppercase tracking-wide">Errors ({report.errors.length})</p>
                  {report.errors.map((j, i) => <p key={i} className="text-destructive pl-2">{j.address} — {j.error}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-5 py-4 border-t border-border flex gap-3 justify-end">
          {phase === 'done' ? (
            <Button onClick={() => { onSuccess?.(report); onClose(); }} className="rounded-xl">
              Close
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
              {(phase === 'review' || phase === 'confirm') && protectedCount < classified.length && (
                <Button
                  variant={mode === 'delete' ? 'destructive' : 'default'}
                  disabled={
                    phase === 'executing' ||
                    (needsTypedConfirm && confirmation !== 'CONFIRM')
                  }
                  onClick={handleExecute}
                  className="rounded-xl gap-2"
                >
                  {mode === 'delete'
                    ? <><Trash2 className="w-4 h-4" /> Delete</>
                    : <><Archive className="w-4 h-4" /> Archive</>
                  }
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}