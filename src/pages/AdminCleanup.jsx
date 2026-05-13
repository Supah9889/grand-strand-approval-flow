import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trash2, Eye, AlertTriangle, CheckCircle2, Shield, XCircle } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { isAdmin } from '@/lib/adminAuth';

// ── All child entity types that reference a job_id ───────────────────────────
const CHILD_ENTITIES = [
  'SignatureRecord',
  'JobFile',
  'JobNote',
  'Task',
  'DailyLog',
  'CalendarEvent',
  'JobAssignment',
  'TimeEntry',
  'Invoice',
  'Bill',
  'Expense',
  'ChangeOrder',
  'WarrantyItem',
  'JobContact',
  'AuditLog',
];

// ── Heuristics for test/dev jobs ─────────────────────────────────────────────
function isTestJob(job) {
  const d = job.data;
  // Never mark Buildertrend imports as test
  if (d.source_system === 'buildertrend') return false;

  const checks = [
    d.customer_name, d.address, d.title, d.description,
    d.customer_email, d.email,
  ].map(v => (v || '').toLowerCase());

  const testPatterns = [
    /^test/i, /test\s/, /\btest\b/,
    /^12345/,
    /^123 test/i,
    /dsadasd/i, /sadsads/i, /asdasd/i, /wadawd/i, /wadaw/i,
    /jgfjjg/i, /fdfsdfs/i, /ghiuhiu/i, /dfsdfs/i, /fdsfsd/i,
    /jhgijg/i, /lknlh/i, /fdsgre/i, /dasfasf/i,
    /asfadsfsd/i, /asadsdasd/i,
  ];

  // Explicit override: 346 Salem st is clearly test (customer_name dsadasd)
  const isFakeCustomer = /dsadasd/i.test(d.customer_name || '');
  const isFakeAddress = [
    /jgfjjghgf/i, /fdfsdfsdf/i, /wadaw dwada/i,
    /asadsdasd/i, /fdsgrehfdg/i, /1224 american shad/i,
    /4201 carolina exchange/i,
  ].some(re => re.test(d.address || ''));
  const isFakeEmail = /sadsads@gmail/i.test(d.customer_email || d.email || '');
  const isFakeTitle = /^(ghiuhiu|dfsdfs|wadawd|346 salem st)/i.test(d.title || '');
  const isTestAddress = /^12345 test/i.test(d.address || '') || /^123 test/i.test(d.address || '');

  if (isFakeCustomer || isFakeEmail || isFakeTitle || isTestAddress) return true;
  if (isFakeAddress && !d.buildertrend_id) return true;

  return checks.some(val => testPatterns.some(re => re.test(val)));
}

// ── Fetch all child records for a set of job IDs ─────────────────────────────
async function fetchChildCounts(jobIds) {
  const counts = {};
  jobIds.forEach(id => { counts[id] = {}; });

  await Promise.all(
    CHILD_ENTITIES.map(async (entity) => {
      try {
        const records = await base44.entities[entity].list();
        records.forEach(rec => {
          const jid = rec.job_id;
          if (jid && counts[jid] !== undefined) {
            counts[jid][entity] = (counts[jid][entity] || 0) + 1;
          }
        });
      } catch {
        // entity may not have list() — skip
      }
    })
  );

  return counts;
}

// ── Delete all child records for a job, then delete the job itself ─────────
async function deleteJobAndChildren(jobId) {
  const deleted = {};

  for (const entity of CHILD_ENTITIES) {
    try {
      const records = await base44.entities[entity].list();
      const matching = records.filter(r => r.job_id === jobId);
      for (const rec of matching) {
        await base44.entities[entity].delete(rec.id);
      }
      if (matching.length) deleted[entity] = matching.length;
    } catch {
      // skip if entity doesn't support operation
    }
  }

  await base44.entities.Job.delete(jobId);
  return deleted;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function AdminCleanup() {
  const [phase, setPhase] = useState('idle'); // idle | scanning | dry_run | confirming | deleting | done
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
      const testJobs = jobs.filter(j => isTestJob(j));

      if (!testJobs.length) {
        setPhase('dry_run');
        setCandidates([]);
        return;
      }

      const jobIds = testJobs.map(j => j.id);
      const counts = await fetchChildCounts(jobIds);

      const enriched = testJobs.map(j => ({
        ...j,
        childCounts: counts[j.id] || {},
        totalChildren: Object.values(counts[j.id] || {}).reduce((a, b) => a + b, 0),
      }));

      enriched.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      setCandidates(enriched);
      setSelected(new Set(enriched.map(j => j.id)));
      setPhase('dry_run');
    } catch (err) {
      setError(err.message || 'Scan failed.');
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

  const confirmAndDelete = async () => {
    if (confirmation !== 'DELETE TEST JOBS') return;
    setPhase('deleting');
    setError('');

    const deletedJobs = [];
    const skippedJobs = [];
    const allChildDeleted = {};

    for (const job of candidates) {
      if (!selected.has(job.id)) {
        skippedJobs.push({ id: job.id, address: job.data.address, reason: 'Deselected by admin' });
        continue;
      }
      if (job.data.source_system === 'buildertrend') {
        skippedJobs.push({ id: job.id, address: job.data.address, reason: 'Buildertrend import — protected' });
        continue;
      }

      try {
        const childDeleted = await deleteJobAndChildren(job.id);
        deletedJobs.push({ id: job.id, address: job.data.address, customer: job.data.customer_name });
        Object.entries(childDeleted).forEach(([entity, count]) => {
          allChildDeleted[entity] = (allChildDeleted[entity] || 0) + count;
        });
      } catch (err) {
        skippedJobs.push({ id: job.id, address: job.data.address, reason: `Delete failed: ${err.message}` });
      }
    }

    setReport({ deletedJobs, skippedJobs, childDeleted: allChildDeleted });
    setPhase('done');
  };

  return (
    <AppLayout title="Admin: Test Data Cleanup">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Pre-import test data cleanup</p>
            <p className="text-xs text-amber-700 mt-0.5">
              This tool identifies and removes test/dev jobs before Buildertrend import.
              Buildertrend jobs (<code>source_system = buildertrend</code>) are always protected.
              A dry-run is mandatory — review before confirming deletion.
            </p>
          </div>
        </div>

        {/* Phase: idle / scan button */}
        {(phase === 'idle' || phase === 'scanning') && (
          <div className="text-center py-12 space-y-4">
            <p className="text-sm text-muted-foreground">
              Click below to scan all jobs for test/development data.
            </p>
            <Button onClick={runDryRun} disabled={phase === 'scanning'} className="rounded-xl gap-2">
              {phase === 'scanning'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
                : <><Eye className="w-4 h-4" /> Run Dry-Run Scan</>
              }
            </Button>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Phase: dry-run results */}
        {phase === 'dry_run' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                {candidates.length === 0
                  ? 'No test jobs found.'
                  : `Found ${candidates.length} test job${candidates.length !== 1 ? 's' : ''} — review and select which to delete:`}
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
              const d = job.data;
              const isSelected = selected.has(job.id);
              const childEntries = Object.entries(job.childCounts).filter(([, v]) => v > 0);
              return (
                <div
                  key={job.id}
                  onClick={() => toggleSelect(job.id)}
                  className={`border rounded-xl p-4 cursor-pointer transition-colors ${
                    isSelected ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(job.id)}
                      onClick={e => e.stopPropagation()}
                      className="mt-1 w-4 h-4 accent-destructive"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{d.address || '(no address)'}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{d.status || 'pending'}</Badge>
                        {d.source_system && d.source_system !== 'app' && (
                          <Badge className="text-[10px] bg-blue-100 text-blue-700 shrink-0">{d.source_system}</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <p>Customer: <span className="text-foreground">{d.customer_name || '—'}</span></p>
                        <p>Email: <span className="text-foreground">{d.customer_email || d.email || '—'}</span></p>
                        <p>Title: <span className="text-foreground">{d.title || '—'}</span></p>
                        <p>Price: <span className="text-foreground">${Number(d.price || 0).toFixed(2)}</span></p>
                        <p className="col-span-2">ID: <span className="text-foreground font-mono text-[10px]">{job.id}</span></p>
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
                  Confirm deletion of {selected.size} selected job{selected.size !== 1 ? 's' : ''} and all their child records
                </p>
                <p className="text-xs text-muted-foreground">
                  Type <code className="bg-muted px-1 py-0.5 rounded text-foreground">DELETE TEST JOBS</code> exactly to enable the delete button.
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
                  onClick={() => setPhase('confirming')}
                  className="rounded-xl gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete {selected.size} Test Job{selected.size !== 1 ? 's' : ''}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Phase: final confirm modal */}
        {phase === 'confirming' && (
          <div className="border-2 border-destructive rounded-xl p-6 space-y-4 bg-destructive/5">
            <p className="text-base font-bold text-destructive">Final confirmation</p>
            <p className="text-sm text-foreground">
              You are about to permanently delete <strong>{selected.size}</strong> job{selected.size !== 1 ? 's' : ''} and all their associated child records.
              This cannot be undone.
            </p>
            <p className="text-xs text-muted-foreground">
              R2 file objects will be orphaned but not deleted (safe — can be cleaned up separately).
            </p>
            <div className="flex gap-3">
              <Button variant="destructive" onClick={confirmAndDelete} className="rounded-xl gap-2">
                <Trash2 className="w-4 h-4" /> Yes, delete permanently
              </Button>
              <Button variant="outline" onClick={() => setPhase('dry_run')} className="rounded-xl gap-2">
                <XCircle className="w-4 h-4" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Phase: deleting spinner */}
        {phase === 'deleting' && (
          <div className="text-center py-16 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">Deleting child records and jobs… please wait.</p>
          </div>
        )}

        {/* Phase: done / final report */}
        {phase === 'done' && report && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4" /> Cleanup complete
            </div>

            {/* Deleted jobs */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Deleted Jobs ({report.deletedJobs.length})
              </div>
              {report.deletedJobs.length === 0
                ? <p className="px-4 py-3 text-xs text-muted-foreground">None</p>
                : report.deletedJobs.map(j => (
                  <div key={j.id} className="px-4 py-2 border-t border-border/60 text-xs flex gap-3">
                    <span className="text-destructive">✕</span>
                    <span className="text-foreground">{j.address}</span>
                    <span className="text-muted-foreground">{j.customer}</span>
                    <span className="font-mono text-muted-foreground text-[10px]">{j.id}</span>
                  </div>
                ))
              }
            </div>

            {/* Child record counts */}
            {Object.keys(report.childDeleted).length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Deleted Child Records
                </div>
                {Object.entries(report.childDeleted).map(([entity, count]) => (
                  <div key={entity} className="px-4 py-2 border-t border-border/60 text-xs flex justify-between">
                    <span className="text-foreground">{entity}</span>
                    <span className="text-muted-foreground">{count} deleted</span>
                  </div>
                ))}
              </div>
            )}

            {/* Skipped jobs */}
            {report.skippedJobs.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Skipped Jobs ({report.skippedJobs.length})
                </div>
                {report.skippedJobs.map((j, i) => (
                  <div key={i} className="px-4 py-2 border-t border-border/60 text-xs flex gap-3">
                    <span className="text-amber-600">⚠</span>
                    <span className="text-foreground">{j.address}</span>
                    <span className="text-muted-foreground">{j.reason}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-muted/40 rounded-xl px-4 py-3 text-xs text-muted-foreground">
              R2 file objects for deleted jobs are now orphaned. They can be bulk-deleted from the Cloudflare R2 dashboard later using the job IDs listed above as key prefixes (<code>jobs/&lt;job_id&gt;/</code>).
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