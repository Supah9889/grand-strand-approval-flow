import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Eye, AlertTriangle, CheckCircle2, Shield, XCircle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { isAdmin, getSession } from '@/lib/adminAuth';
import {
  classifyJobRemovalAction,
  fetchChildCountsForJobs,
  processBatchRemoval,
  REMOVAL_ACTION,
} from '@/lib/jobLifecycle';

// ── Heuristics for test/dev jobs ─────────────────────────────────────────────
function isTestJob(job) {
  if (!job) return false;
  const sourceSystem = (job?.source_system || job?.data?.source_system || '').toLowerCase();
  if (sourceSystem === 'buildertrend') return false;
  const btId = job?.buildertrend_id || job?.data?.buildertrend_id;
  if (btId) return false;

  const get = (f) => (job?.[f] || job?.data?.[f] || '').toLowerCase();
  const customer  = get('customer_name');
  const address   = get('address');
  const title     = get('title');
  const email     = get('customer_email') || get('email');

  const testPatterns = [
    /dsadasd/i, /sadsads/i, /asdasd/i, /wadawd/i, /wadaw/i,
    /jgfjjg/i, /fdfsdfs/i, /ghiuhiu/i, /dfsdfs/i, /fdsfsd/i,
    /jhgijg/i, /lknlh/i, /fdsgre/i, /dasfasf/i, /asfadsfsd/i, /asadsdasd/i,
  ];

  if (testPatterns.some(re => re.test(customer))) return true;
  if (/sadsads@gmail/i.test(email)) return true;
  if (/^(ghiuhiu|dfsdfs|wadawd|346 salem st)/i.test(title)) return true;
  if (/^12345 test/i.test(address) || /^123 test/i.test(address)) return true;
  if ([/jgfjjghgf/i, /fdfsdfsdf/i, /wadaw dwada/i, /asadsdasd/i, /fdsgrehfdg/i, /4201 carolina exchange/i].some(re => re.test(address)) && !btId) return true;

  return false;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminCleanup() {
  const [phase, setPhase] = useState('idle');
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [confirmation, setConfirmation] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  if (!isAdmin()) {
    return (
      <AppLayout title="Admin Cleanup">
        <div className="flex items-center justify-center py-24">
          <div className="text-center space-y-2">
            <Shield className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm font-semibold text-foreground">Admin access required</p>
            <p className="text-xs text-muted-foreground">This tool is restricted to admin users only.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const runDryRun = async () => {
    setPhase('scanning');
    setError('');
    setCandidates([]);
    setSelected(new Set());
    setReport(null);

    try {
      const jobs = await base44.entities.Job.list();
      const testJobs = (jobs || []).filter(j => isTestJob(j));

      if (!testJobs.length) {
        setCandidates([]);
        setPhase('dry_run');
        return;
      }

      const jobIds = testJobs.map(j => j?.id).filter(Boolean);
      const counts = await fetchChildCountsForJobs(jobIds);

      const enriched = testJobs.map(j => {
        const childCounts = counts[j?.id] || {};
        const { action, reason } = classifyJobRemovalAction(j, childCounts);
        return {
          ...j,
          childCounts,
          totalChildren: Object.values(childCounts).reduce((a, b) => a + b, 0),
          removalAction: action,
          removalReason: reason,
        };
      });

      enriched.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setCandidates(enriched);
      setSelected(new Set(enriched.filter(j => j.removalAction !== REMOVAL_ACTION.PROTECTED).map(j => j.id)));
      setPhase('dry_run');
    } catch (err) {
      setError(err?.message || 'Scan failed.');
      setPhase('idle');
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const confirmAndExecute = async () => {
    if (confirmation !== 'DELETE TEST JOBS') return;
    setPhase('deleting');
    setError('');

    const toProcess = candidates.filter(j => selected.has(j?.id));
    const childCountsMap = Object.fromEntries(candidates.map(c => [c.id, c.childCounts || {}]));
    const actorName = getSession()?.employee?.name || getSession()?.name || 'admin';

    const result = await processBatchRemoval(toProcess, childCountsMap, { actorName, reason: 'Pre-import test data cleanup' });
    setReport(result);
    setPhase('done');
  };

  const ACTION_LABEL = {
    [REMOVAL_ACTION.HARD_DELETE]: { label: 'Will be deleted', color: 'text-destructive' },
    [REMOVAL_ACTION.ARCHIVE_ONLY]: { label: 'Will be archived', color: 'text-amber-700' },
    [REMOVAL_ACTION.PROTECTED]: { label: 'Protected', color: 'text-muted-foreground' },
  };

  return (
    <AppLayout title="Admin: Test Data Cleanup">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Pre-import test data cleanup</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Identifies and removes test/dev jobs before Buildertrend import.
              Buildertrend jobs are always protected. Jobs with signatures/financials will be archived instead of deleted.
            </p>
          </div>
        </div>

        {(phase === 'idle' || phase === 'scanning') && (
          <div className="text-center py-12 space-y-4">
            <p className="text-sm text-muted-foreground">Click below to scan all jobs for test/development data.</p>
            <Button onClick={runDryRun} disabled={phase === 'scanning'} className="rounded-xl gap-2">
              {phase === 'scanning'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
                : <><Eye className="w-4 h-4" /> Run Dry-Run Scan</>
              }
            </Button>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {phase === 'dry_run' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {candidates.length === 0
                  ? 'No test jobs found.'
                  : `Found ${candidates.length} test job${candidates.length !== 1 ? 's' : ''} — review before removing:`}
              </p>
              <Button variant="outline" size="sm" onClick={runDryRun} className="rounded-lg text-xs gap-1">
                <Eye className="w-3 h-3" /> Re-scan
              </Button>
            </div>

            {candidates.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4" /> All clear — no test jobs detected.
              </div>
            )}

            {candidates.map(job => {
              if (!job) return null;
              const addr = job?.address || job?.data?.address || '(no address)';
              const customer = job?.customer_name || job?.data?.customer_name || '—';
              const email = job?.customer_email || job?.data?.customer_email || job?.email || job?.data?.email || '—';
              const title = job?.title || job?.data?.title || '—';
              const price = job?.price ?? job?.data?.price ?? 0;
              const status = job?.status || job?.data?.status || 'pending';
              const sourceSystem = job?.source_system || job?.data?.source_system || 'app';
              const actionInfo = ACTION_LABEL[job.removalAction] || ACTION_LABEL[REMOVAL_ACTION.HARD_DELETE];
              const isSelected = selected.has(job.id);
              const isProtected = job.removalAction === REMOVAL_ACTION.PROTECTED;
              const childEntries = Object.entries(job.childCounts || {}).filter(([, v]) => v > 0);

              return (
                <div
                  key={job.id}
                  onClick={() => !isProtected && toggleSelect(job.id)}
                  className={`border rounded-xl p-4 transition-colors ${
                    isProtected ? 'border-border bg-muted/30 opacity-60 cursor-not-allowed' :
                    isSelected ? 'border-destructive/40 bg-destructive/5 cursor-pointer' :
                    'border-border bg-card opacity-60 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!isProtected && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(job.id)}
                        onClick={e => e.stopPropagation()}
                        className="mt-1 w-4 h-4 accent-destructive"
                      />
                    )}
                    {isProtected && <Shield className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{addr}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{status}</Badge>
                        {sourceSystem && sourceSystem !== 'app' && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-700 shrink-0">{sourceSystem}</Badge>
                        )}
                        <span className={`text-[10px] font-medium ${actionInfo.color}`}>{actionInfo.label}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <p>Customer: <span className="text-foreground">{customer}</span></p>
                        <p>Email: <span className="text-foreground">{email}</span></p>
                        <p>Title: <span className="text-foreground">{title}</span></p>
                        <p>Price: <span className="text-foreground">${Number(price || 0).toFixed(2)}</span></p>
                        <p className="col-span-2 text-muted-foreground/60 italic">{job.removalReason}</p>
                        <p className="col-span-2">ID: <span className="font-mono text-[10px]">{job.id}</span></p>
                      </div>
                      {childEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {childEntries.map(([entity, count]) => (
                            <span key={entity} className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full text-muted-foreground">
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

            {candidates.length > 0 && (
              <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Remove {selected.size} selected job{selected.size !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  Type <code className="bg-muted px-1 py-0.5 rounded text-foreground">DELETE TEST JOBS</code> exactly to enable.
                </p>
                <Input
                  value={confirmation}
                  onChange={e => setConfirmation(e.target.value)}
                  placeholder="DELETE TEST JOBS"
                  className="rounded-lg font-mono text-sm max-w-xs"
                />
                <Button
                  variant="destructive"
                  disabled={confirmation !== 'DELETE TEST JOBS' || selected.size === 0}
                  onClick={confirmAndExecute}
                  className="rounded-xl gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove {selected.size} Test Job{selected.size !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>
        )}

        {phase === 'deleting' && (
          <div className="text-center py-16 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">Removing jobs and child records… please wait.</p>
          </div>
        )}

        {phase === 'done' && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4" /> Cleanup complete
            </div>

            {report.archived?.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Archived ({report.archived.length})</div>
                {report.archived.map(j => (
                  <div key={j.jobId} className="px-4 py-2 border-t border-border/60 text-xs flex gap-3">
                    <span className="text-amber-600">↓</span>
                    <span className="text-foreground">{j.address}</span>
                    <span className="font-mono text-muted-foreground text-[10px]">{j.jobId}</span>
                  </div>
                ))}
              </div>
            )}

            {report.hardDeleted?.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deleted ({report.hardDeleted.length})</div>
                {report.hardDeleted.map(j => (
                  <div key={j.jobId} className="px-4 py-2 border-t border-border/60 text-xs flex gap-3">
                    <span className="text-destructive">✕</span>
                    <span className="text-foreground">{j.address}</span>
                    <span className="font-mono text-muted-foreground text-[10px]">{j.jobId}</span>
                  </div>
                ))}
              </div>
            )}

            {report.protected?.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Protected — skipped ({report.protected.length})</div>
                {report.protected.map(j => (
                  <div key={j.jobId} className="px-4 py-2 border-t border-border/60 text-xs flex gap-3">
                    <span className="text-muted-foreground">⚠</span>
                    <span className="text-foreground">{j.address}</span>
                    <span className="text-muted-foreground">{j.reason}</span>
                  </div>
                ))}
              </div>
            )}

            {report.errors?.length > 0 && (
              <div className="border border-destructive/30 rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-destructive uppercase tracking-wide">Errors ({report.errors.length})</div>
                {report.errors.map(j => (
                  <div key={j.jobId} className="px-4 py-2 border-t border-border/60 text-xs flex gap-3">
                    <span className="text-destructive">!</span>
                    <span className="text-foreground">{j.address}</span>
                    <span className="text-destructive">{j.error}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-muted/40 rounded-xl px-4 py-3 text-xs text-muted-foreground">
              R2 file objects for deleted jobs are orphaned. Clean them up from Cloudflare R2 dashboard using key prefix <code>jobs/&lt;job_id&gt;/</code>.
            </div>

            <Button variant="outline" onClick={() => { setPhase('idle'); setReport(null); setConfirmation(''); }} className="rounded-xl">
              Run another scan
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}