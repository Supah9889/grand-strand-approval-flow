/**
 * Buildertrend Phase 1 Import — Admin Only
 * Upload → Dry-Run Preview → Confirm Live Import
 */
import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle2, Loader2, Shield, RotateCcw } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { isAdmin, getSession } from '@/lib/adminAuth';

import BTImportUploader from '@/components/btimport/BTImportUploader';
import BTDryRunSummary  from '@/components/btimport/BTDryRunSummary';
import BTDiagnosticsPanel   from '@/components/btimport/BTDiagnosticsPanel';
import BTStagedJobsTable    from '@/components/btimport/BTStagedJobsTable';
import BTStagedLogsTable    from '@/components/btimport/BTStagedLogsTable';
import BTStagedEventsTable  from '@/components/btimport/BTStagedEventsTable';
import BTBatchHistory       from '@/components/btimport/BTBatchHistory';

import {
  parseJobsiteRows,
  parseDailyLogText,
  parseCalendarText,
  matchLogsToJobs,
  matchEventsToJobs,
} from '@/lib/btParsers';
import {
  importApprovedJobs,
  importApprovedDailyLogs,
  importApprovedCalendarEvents,
} from '@/lib/btImportLive';

// ─── File reading helpers ─────────────────────────────────────────────────────

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * Parse a Buildertrend Jobsites CSV directly from the File object.
 * - Strips UTF-8 BOM from the first header
 * - Normalises headers: trim, lowercase, collapse tabs/spaces
 * - Maps each row to a plain object keyed by ORIGINAL header text
 * - Hard-stops with a diagnostic error if "job name" header is not found
 * - Returns { rows, debugInfo }
 */
function parseJobsitesCsv(file) {
  return file.text().then((raw) => {
    // Strip UTF-8 BOM if present
    const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;

    const lines = text.split(/\r?\n/);
    const rawLines = lines; // keep for diagnostics

    if (lines.length < 2) throw new Error('CSV file appears empty or has no data rows');

    // First non-empty line = headers
    const headerLine = lines[0];
    const rawHeaders = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());

    // Normalise for lookup: lowercase, collapse whitespace/tabs
    const normHeader = (h) => h.toLowerCase().replace(/[\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const normHeaders = rawHeaders.map(normHeader);

    // Hard-stop if "job name" is not among the headers
    if (!normHeaders.includes('job name')) {
      const diagnostic = [
        `CSV header check failed — "Job Name" column not found.`,
        `Parser: manual CSV (file.text())`,
        `Total columns found: ${rawHeaders.length}`,
        `Detected headers: ${rawHeaders.join(' | ')}`,
        `First 3 raw lines:`,
        ...rawLines.slice(0, 3).map((l, i) => `  [${i}] ${l.slice(0, 120)}`),
      ].join('\n');
      throw new Error(diagnostic);
    }

    // Parse data rows (skip header line, skip blank lines)
    const rows = [];
    let skippedBlank = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { skippedBlank++; continue; }

      // Simple CSV split — handles basic quoting
      const values = [];
      let cur = '', inQuote = false;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (ch === '"') { inQuote = !inQuote; }
        else if (ch === ',' && !inQuote) { values.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
      values.push(cur.trim());

      const row = {};
      rawHeaders.forEach((h, idx) => {
        row[h] = values[idx] !== undefined ? values[idx].replace(/^"|"$/g, '').trim() : '';
      });
      rows.push(row);
    }

    const debugInfo = {
      parser: 'manual CSV (file.text())',
      totalRows: rows.length,
      skippedBlank,
      detectedHeaders: rawHeaders,
      first3JobNames: rows.slice(0, 3).map(r => r['Job Name'] || '(empty)'),
    };

    console.log('[BTImport] CSV parse debug:', debugInfo);
    return { rows, debugInfo };
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

const STEPS = { UPLOAD: 'upload', DRY_RUN: 'dry_run', CONFIRM: 'confirm', DONE: 'done' };

export default function BTImport() {
  const qc = useQueryClient();
  const session = getSession();
  const actorName = session?.employee?.name || session?.name || 'Admin';

  const [step, setStep]         = useState(STEPS.UPLOAD);
  const [parsing, setParsing]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState('');
  const [currentBatchId, setCurrentBatchId] = useState(null);

  // Staged records in local state (not yet in DB during dry-run preview)
  const [stagedJobs,   setStagedJobs]   = useState([]);
  const [stagedLogs,   setStagedLogs]   = useState([]);
  const [stagedEvents, setStagedEvents] = useState([]);
  const [parseErrors,  setParseErrors]  = useState([]);

  const [importResult, setImportResult] = useState(null);

  // Batch history
  const { data: batches = [] } = useQuery({
    queryKey: ['import_batches'],
    queryFn: () => base44.entities.ImportBatch.list('-uploaded_at', 50),
  });

  // ── Step 1: Parse & Stage ──────────────────────────────────────────────────

  const handleFilesReady = useCallback(async (files) => {
    setParsing(true);
    setParseError('');
    setParseErrors([]);
    setStagedJobs([]);
    setStagedLogs([]);
    setStagedEvents([]);
    setCurrentBatchId(null);

    try {
      // Create an ImportBatch record immediately for tracking
      const fileNames = Object.entries(files).map(([type, f]) => `${type}:${f.name}`).join(', ');
      const sourceType = Object.keys(files).length === 1 ? Object.keys(files)[0] : 'mixed';

      const batch = await base44.entities.ImportBatch.create({
        source_system: 'buildertrend',
        source_type: sourceType,
        source_file_name: fileNames,
        uploaded_by: actorName,
        uploaded_at: new Date().toISOString(),
        dry_run_status: 'running',
        import_status: 'not_started',
      });
      setCurrentBatchId(batch.id);

      const allErrors = [];
      let jobs = [], logs = [], events = [];

      // Parse Jobsites CSV — direct file.text() path, no AI extraction
      if (files.jobsites) {
        const { rows, debugInfo } = await parseJobsitesCsv(files.jobsites);
        const result = parseJobsiteRows(rows, batch.id, files.jobsites.name);
        jobs = result.staged;
        allErrors.push(...result.errors.map(e => `[Jobs] ${e}`));
        // Surface debug summary as first info entry (not a real error)
        allErrors.unshift(
          `[Jobs debug] parser=${debugInfo.parser} | rows=${debugInfo.totalRows} | ` +
          `skipped_blank=${debugInfo.skippedBlank} | ` +
          `first_jobs=${debugInfo.first3JobNames.join(', ')}`
        );
      }

      // Parse Daily Logs (no matching yet — staged job IDs not known until after DB insert)
      if (files.daily_logs) {
        const text = await readFileAsText(files.daily_logs);
        const result = parseDailyLogText(text, batch.id, files.daily_logs.name);
        logs = result.staged;
        allErrors.push(...result.errors.map(e => `[Logs] ${e}`));
      }

      // Parse Calendar (same — match after DB insert)
      if (files.schedule_calendar) {
        const text = await readFileAsText(files.schedule_calendar);
        const result = parseCalendarText(text, batch.id, files.schedule_calendar.name);
        events = result.staged;
        allErrors.push(...result.errors.map(e => `[Calendar] ${e}`));
      }

      // Persist staged records to DB
      if (jobs.length)   await base44.entities.StagedJob.bulkCreate(jobs);
      if (logs.length)   await base44.entities.StagedDailyLog.bulkCreate(logs);
      if (events.length) await base44.entities.StagedCalendarEvent.bulkCreate(events);

      // Reload from DB so we have real IDs, then run cross-matching with real IDs
      const [dbJobs, dbLogsRaw, dbEventsRaw] = await Promise.all([
        base44.entities.StagedJob.filter({ import_batch_id: batch.id }),
        base44.entities.StagedDailyLog.filter({ import_batch_id: batch.id }),
        base44.entities.StagedCalendarEvent.filter({ import_batch_id: batch.id }),
      ]);

      // Run cross-matching now that we have real DB IDs for staged jobs
      const dbLogs   = logs.length   ? matchLogsToJobs(dbLogsRaw, dbJobs)   : dbLogsRaw;
      const dbEvents = events.length ? matchEventsToJobs(dbEventsRaw, dbJobs) : dbEventsRaw;

      // Persist match results back to DB
      await Promise.all([
        ...dbLogs.filter(l => l.match_status !== 'unmatched').map(l =>
          base44.entities.StagedDailyLog.update(l.id, {
            match_status: l.match_status,
            matched_staged_job_id: l.matched_staged_job_id || null,
          })
        ),
        ...dbEvents.filter(e => e.match_status !== 'unmatched').map(e =>
          base44.entities.StagedCalendarEvent.update(e.id, {
            match_status: e.match_status,
            matched_staged_job_id: e.matched_staged_job_id || null,
          })
        ),
      ]);

      // Update batch with counts
      await base44.entities.ImportBatch.update(batch.id, {
        dry_run_status: 'complete',
        total_rows: dbJobs.length + dbLogs.length + dbEvents.length,
        staged_count: dbJobs.length + dbLogs.length + dbEvents.length,
        warning_count: dbJobs.filter(j => safeParseJson(j.warnings, []).length > 0).length,
        error_count: allErrors.length,
      });

      setStagedJobs(dbJobs);
      setStagedLogs(dbLogs);
      setStagedEvents(dbEvents);
      // Note: dbLogs/dbEvents here already have updated match_status from the cross-match step
      setParseErrors(allErrors);
      setStep(STEPS.DRY_RUN);
      qc.invalidateQueries({ queryKey: ['import_batches'] });
    } catch (err) {
      setParseError(err.message || 'Parse failed');
    } finally {
      setParsing(false);
    }
  }, [actorName, qc]);

  // ── Step 2: Review — approve/skip individual records ──────────────────────

  const handleJobStatusChange = useCallback(async (id, status) => {
    await base44.entities.StagedJob.update(id, { review_status: status, reviewed_by: actorName });
    setStagedJobs(prev => prev.map(j => j.id === id ? { ...j, review_status: status } : j));
  }, [actorName]);

  const handleLogStatusChange = useCallback(async (id, status) => {
    await base44.entities.StagedDailyLog.update(id, { review_status: status, reviewed_by: actorName });
    setStagedLogs(prev => prev.map(l => l.id === id ? { ...l, review_status: status } : l));
  }, [actorName]);

  const handleEventStatusChange = useCallback(async (id, status) => {
    await base44.entities.StagedCalendarEvent.update(id, { review_status: status, reviewed_by: actorName });
    setStagedEvents(prev => prev.map(e => e.id === id ? { ...e, review_status: status } : e));
  }, [actorName]);

  // ── Step 3: Confirmed live import ─────────────────────────────────────────

  const handleConfirmImport = useCallback(async () => {
    setImporting(true);
    try {
      await base44.entities.ImportBatch.update(currentBatchId, { import_status: 'in_progress' });

      const approvedJobs   = stagedJobs.filter(j => j.review_status === 'approved');
      const approvedLogs   = stagedLogs.filter(l => l.review_status === 'approved');
      const approvedEvents = stagedEvents.filter(e => e.review_status === 'approved');

      // Import jobs first so logs/events can resolve job IDs
      const jobResult   = await importApprovedJobs(currentBatchId, approvedJobs, actorName);

      // Build a map of staged job ID → (now updated) live job ID
      const updatedStagedJobs = await base44.entities.StagedJob.filter({ import_batch_id: currentBatchId });
      const stagedJobsById = Object.fromEntries(updatedStagedJobs.map(j => [j.id, j]));

      const logResult   = await importApprovedDailyLogs(currentBatchId, approvedLogs, stagedJobsById, actorName);
      const eventResult = await importApprovedCalendarEvents(currentBatchId, approvedEvents, stagedJobsById, actorName);

      const totalImported = jobResult.imported.length + logResult.imported.length + eventResult.imported.length;
      const totalErrors   = jobResult.errors.length + logResult.errors.length + eventResult.errors.length;
      const totalSkipped  = jobResult.skipped.length + logResult.skipped.length + eventResult.skipped.length;

      await base44.entities.ImportBatch.update(currentBatchId, {
        import_status: totalErrors === 0 ? 'complete' : 'partial',
        imported_count: totalImported,
        skipped_count: totalSkipped,
        error_count: totalErrors,
      });

      setImportResult({ jobResult, logResult, eventResult });
      setStep(STEPS.DONE);
      qc.invalidateQueries({ queryKey: ['import_batches'] });
    } catch (err) {
      setParseError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [currentBatchId, stagedJobs, stagedLogs, stagedEvents, actorName, qc]);

  // ── Computed stats for summary ─────────────────────────────────────────────

  const stats = {
    totalJobs:      stagedJobs.length,
    duplicateJobs:  stagedJobs.filter(j => j.match_status === 'possible_duplicate').length,
    flaggedJobs:    stagedJobs.filter(j => j.match_status === 'needs_review').length,
    totalLogs:      stagedLogs.length,
    unmatchedLogs:  stagedLogs.filter(l => l.match_status === 'unmatched').length,
    attachmentLogs: stagedLogs.filter(l => l.needs_attachment_review).length,
    totalEvents:    stagedEvents.length,
    unmatchedEvents:stagedEvents.filter(e => e.match_status === 'unmatched').length,
    officeEvents:   stagedEvents.filter(e => e.is_office_event).length,
    totalErrors:    parseErrors.length,
  };

  const approvedCount =
    stagedJobs.filter(j => j.review_status === 'approved').length +
    stagedLogs.filter(l => l.review_status === 'approved').length +
    stagedEvents.filter(e => e.review_status === 'approved').length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isAdmin()) {
    return (
      <AppLayout title="BT Import">
        <div className="flex items-center justify-center py-24">
          <div className="text-center space-y-2">
            <Shield className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm font-semibold">Admin access required</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Buildertrend Import — Phase 1">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-foreground">Buildertrend Import — Phase 1</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Dry-run staging before any live records are written</p>
          </div>
          {step !== STEPS.UPLOAD && (
            <Button variant="outline" className="gap-2 text-sm" onClick={() => { setStep(STEPS.UPLOAD); setStagedJobs([]); setStagedLogs([]); setStagedEvents([]); setImportResult(null); setParseError(''); }}>
              <RotateCcw className="w-4 h-4" /> New Import
            </Button>
          )}
        </div>

        {/* Parse error — selectable for copy/paste */}
        {parseError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-destructive/20">
              <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
              <span className="text-sm font-semibold text-destructive flex-1">Parse error</span>
              <button
                onClick={() => navigator.clipboard.writeText(parseError)}
                className="text-[11px] text-destructive/70 hover:text-destructive underline underline-offset-2"
              >
                Copy
              </button>
            </div>
            <pre
              className="px-4 py-3 text-xs text-destructive whitespace-pre-wrap break-words max-h-64 overflow-y-auto"
              style={{ userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text' }}
            >
              {parseError}
            </pre>
          </div>
        )}

        {/* ── STEP: UPLOAD ── */}
        {step === STEPS.UPLOAD && (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <strong>Dry-run first.</strong> Uploading will parse and stage records for review — no live Job, DailyLog, or CalendarEvent records will be created until you explicitly confirm.
              </div>
            </div>
            <BTImportUploader onFilesReady={handleFilesReady} loading={parsing} />
            {parsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Parsing files and staging records…
              </div>
            )}

            {/* Previous batches */}
            {batches.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Previous Batches</h2>
                <BTBatchHistory batches={batches} />
              </div>
            )}
          </div>
        )}

        {/* ── STEP: DRY RUN REVIEW ── */}
        {step === STEPS.DRY_RUN && (
          <div className="space-y-5">
            <BTDryRunSummary stats={stats} />

            {parseErrors.length > 0 && (
              <BTDiagnosticsPanel
                lines={parseErrors}
                label="Parse warnings / skipped rows"
                fileName="bt-parse-warnings"
              />
            )}

            <Tabs defaultValue="jobs">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="jobs">
                  Jobs <Badge variant="secondary" className="ml-1 text-[10px]">{stagedJobs.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="logs">
                  Daily Logs <Badge variant="secondary" className="ml-1 text-[10px]">{stagedLogs.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="events">
                  Calendar <Badge variant="secondary" className="ml-1 text-[10px]">{stagedEvents.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="jobs" className="mt-3">
                <BTStagedJobsTable jobs={stagedJobs} onStatusChange={handleJobStatusChange} />
              </TabsContent>
              <TabsContent value="logs" className="mt-3">
                <BTStagedLogsTable logs={stagedLogs} onStatusChange={handleLogStatusChange} />
              </TabsContent>
              <TabsContent value="events" className="mt-3">
                <BTStagedEventsTable events={stagedEvents} onStatusChange={handleEventStatusChange} />
              </TabsContent>
            </Tabs>

            {/* Confirm bar */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 flex items-center gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Ready to import {approvedCount} approved record{approvedCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  Only approved records will create live entries. Skipped/pending records are ignored.
                </p>
              </div>
              <Button
                disabled={approvedCount === 0 || importing}
                onClick={handleConfirmImport}
                className="ml-auto gap-2"
              >
                {importing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Confirm Live Import ({approvedCount})</>
                }
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === STEPS.DONE && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4" /> Import complete
            </div>

            <ImportResultSection label="Jobs" result={importResult.jobResult} />
            <ImportResultSection label="Daily Logs" result={importResult.logResult} />
            <ImportResultSection label="Calendar Events" result={importResult.eventResult} />

            <Button variant="outline" onClick={() => { setStep(STEPS.UPLOAD); setStagedJobs([]); setStagedLogs([]); setStagedEvents([]); setImportResult(null); }} className="gap-2">
              <RotateCcw className="w-4 h-4" /> Run another import
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ImportResultSection({ label, result }) {
  if (!result) return null;
  const { imported = [], skipped = [], errors = [] } = result;
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        {label}
        <Badge variant="secondary" className="text-[10px]">{imported.length} imported</Badge>
        {skipped.length > 0 && <Badge variant="outline" className="text-[10px]">{skipped.length} skipped</Badge>}
        {errors.length > 0 && <Badge className="text-[10px] bg-destructive/10 text-destructive">{errors.length} errors</Badge>}
      </div>
      {errors.map((e, i) => (
        <div key={i} className="px-4 py-2 border-t border-border/60 text-xs flex gap-2 text-destructive">
          <span>!</span><span>{e.error}</span>
        </div>
      ))}
    </div>
  );
}

function safeParseJson(str, fallback) {
  try { return JSON.parse(str || '[]'); } catch { return fallback; }
}