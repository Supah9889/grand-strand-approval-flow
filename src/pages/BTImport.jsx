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
  parseCalendarPdfPages,
  matchLogsToJobs,
  matchEventsToJobs,
} from '@/lib/btParsers';
import { findBuildertrendImportedJobForLog, findExistingBuildertrendImportedJob } from '@/lib/jobHelpers';
import { extractPdfTextPages } from '@/lib/btPdfText';
import {
  importApprovedJobs,
  importApprovedDailyLogs,
  importApprovedCalendarEvents,
  backfillBuildertrendImportedJobs,
} from '@/lib/btImportLive';
import { toast } from 'sonner';

// ─── File reading helpers ─────────────────────────────────────────────────────

const RATE_LIMIT_ERROR_MESSAGE = 'Base44 rate limit reached. Please wait a moment and retry.';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error) {
  const status = error?.status || error?.response?.status || error?.code;
  const message = String(error?.message || error?.error || '').toLowerCase();
  return status === 429 || message.includes('rate limit') || message.includes('too many requests');
}

async function withRateLimitRetry(fn, { retries = 3, baseDelayMs = 750, onRetry } = {}) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt === retries) throw error;
      const delayMs = baseDelayMs * (2 ** attempt);
      if (onRetry) onRetry({ attempt: attempt + 1, retries, delayMs, error });
      await sleep(delayMs);
      attempt++;
    }
  }
}

async function runThrottled(items, worker, {
  batchSize = 25,
  delayMs = 500,
  retries = 3,
  onProgress,
  onRetry,
} = {}) {
  const total = items.length;
  for (let index = 0; index < total; index += batchSize) {
    const chunk = items.slice(index, index + batchSize);
    if (onProgress) onProgress({ completed: index, total, batchSize: chunk.length });
    await withRateLimitRetry(() => worker(chunk, index, total), { retries, baseDelayMs: delayMs, onRetry });
    if (index + batchSize < total) await sleep(delayMs);
  }
  if (onProgress) onProgress({ completed: total, total, batchSize: 0 });
}

async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * RFC4180-compliant CSV state-machine tokeniser.
 * Correctly handles:
 *   - quoted fields with embedded commas
 *   - quoted fields with embedded newlines (CRLF or LF)
 *   - escaped double-quotes ("")
 *   - UTF-8 BOM
 *
 * Returns an array of string arrays (one per logical record).
 */
function tokenizeCsv(raw) {
  // Strip UTF-8 BOM
  const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;

  const records = [];
  let fields = [];
  let field = '';
  let inQuote = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (inQuote) {
      if (ch === '"') {
        // Peek ahead: "" = escaped quote, otherwise end of quoted field
        if (i + 1 < len && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuote = false;
          i++;
        }
      } else {
        // Any character inside quotes (including \n, \r) is literal field content
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
        i++;
      } else if (ch === ',') {
        fields.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        // CRLF or bare CR = record separator
        fields.push(field);
        field = '';
        records.push(fields);
        fields = [];
        if (i + 1 < len && text[i + 1] === '\n') i++; // consume LF
        i++;
      } else if (ch === '\n') {
        fields.push(field);
        field = '';
        records.push(fields);
        fields = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Flush last field / record
  if (field !== '' || fields.length > 0) {
    fields.push(field);
    records.push(fields);
  }

  return records;
}

/**
 * Parse a Buildertrend Jobsites CSV directly from the File object.
 * Uses a proper RFC4180 state-machine — handles quoted fields with embedded
 * commas, newlines, and escaped double-quotes.
 *
 * Returns { rows, debugInfo }
 */
function parseJobsitesCsv(file) {
  return file.text().then((raw) => {
    const records = tokenizeCsv(raw);

    if (records.length < 2) throw new Error('CSV file appears empty or has no data rows');

    // First record = headers
    const rawHeaders = records[0].map(h => h.trim());
    const normHeader = (h) => h.toLowerCase().replace(/[\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    const normHeaders = rawHeaders.map(normHeader);

    // Hard-stop if "job name" column is missing
    if (!normHeaders.includes('job name')) {
      const diagnostic = [
        `CSV header check failed — "Job Name" column not found.`,
        `Parser: RFC4180 state-machine`,
        `Total columns found: ${rawHeaders.length}`,
        `Detected headers: ${rawHeaders.join(' | ')}`,
        `First 3 raw records (fields):`,
        ...records.slice(0, 3).map((r, i) => `  [${i}] ${r.slice(0, 6).join(' | ')}`),
      ].join('\n');
      throw new Error(diagnostic);
    }

    const jobNameIdx = normHeaders.indexOf('job name');

    const rows = [];
    let skippedBlank = 0;
    let fragmented = 0;
    const malformedRows = [];

    for (let i = 1; i < records.length; i++) {
      const fields = records[i];

      // Skip truly blank records (single empty field)
      if (fields.length === 1 && fields[0].trim() === '') { skippedBlank++; continue; }

      const row = {};
      rawHeaders.forEach((h, idx) => {
        row[h] = fields[idx] !== undefined ? fields[idx].trim() : '';
      });

      // ── Fragmentation detection ─────────────────────────────────────────────
      const jobName = row['Job Name'] || '';
      if (!jobName) {
        // Check if address/city/state/zip fields are populated — hallmark of a
        // fragmented multiline row that was incorrectly split
        const hasAddr = !!(row['Street Address'] || row['Address'] || row['City'] || row['State'] || row['Zip']);
        if (hasAddr) {
          fragmented++;
          malformedRows.push({
            sourceRow: i + 1,
            reason: 'possible multiline row fragmentation',
            fields: row,
          });
        } else {
          skippedBlank++;
        }
        continue;
      }

      rows.push(row);
    }

    const first5Names = rows.slice(0, 5).map(r => r['Job Name'] || '(empty)');

    const debugInfo = {
      parser: 'RFC4180 state-machine',
      totalRawRecords: records.length - 1, // exclude header
      totalParsedRows: rows.length,
      skippedBlank,
      malformedCount: fragmented,
      first5JobNames: first5Names,
      detectedHeaders: rawHeaders,
      malformedRows, // full detail for diagnostics panel
    };

    console.log('[BTImport] RFC4180 CSV parse diagnostics:', {
      parser: debugInfo.parser,
      totalRawRecords: debugInfo.totalRawRecords,
      totalParsedRows: debugInfo.totalParsedRows,
      skippedBlank,
      malformedCount: fragmented,
      first5JobNames: first5Names,
    });

    return { rows, debugInfo };
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

function addWarning(job, warning) {
  const warnings = safeParseJson(job.warnings, []);
  return JSON.stringify(warnings.includes(warning) ? warnings : [...warnings, warning]);
}

function markAlreadyImportedJobs(stagedJobs, liveJobs) {
  return stagedJobs.map((job) => {
    const match = findExistingBuildertrendImportedJob(job, liveJobs);
    if (!match) return job;
    return {
      ...job,
      match_status: 'already_imported',
      matched_job_id: match.id || null,
      review_status: 'skipped',
      warnings: addWarning(job, 'Already imported from Buildertrend'),
    };
  });
}

function matchDailyLogsToImportedJobs(stagedLogs, liveJobs) {
  return stagedLogs.map((log) => {
    const match = findBuildertrendImportedJobForLog(log.source_job_name, liveJobs);
    if (!match) return log;
    return {
      ...log,
      match_status: 'matched_live',
      matched_job_id: match.id || null,
    };
  });
}

function matchCalendarEventsToImportedJobs(stagedEvents, liveJobs) {
  return stagedEvents.map((event) => {
    if (event.is_office_event) return event;
    const match = findBuildertrendImportedJobForLog(event.source_job_name, liveJobs);
    if (!match) return event;
    return {
      ...event,
      match_status: 'matched_live',
      matched_job_id: match.id || null,
    };
  });
}

function buildDailyLogDiagnosticLines(diagnostics, logs) {
  if (!diagnostics) return [];
  const matchedCount = logs.filter(log => log.match_status === 'matched_live').length;
  const unmatched = logs.filter(log => log.match_status === 'unmatched');
  const attachmentReviewCount = logs.filter(log => log.needs_attachment_review).length;
  return [
    `[Daily Logs diagnostics]`,
    `  parser used:              ${diagnostics.parser}`,
    `  total log blocks found:   ${diagnostics.totalBlocks}`,
    `  staged logs created:      ${logs.length}`,
    `  matched logs:             ${matchedCount}`,
    `  unmatched logs:           ${unmatched.length}`,
    `  attachment review count:  ${attachmentReviewCount}`,
    `  first 5 parsed jobs:      ${logs.slice(0, 5).map(log => log.source_job_name || '(no job name)').join(' | ') || '(none)'}`,
    `  first 3 unmatched jobs:   ${unmatched.slice(0, 3).map(log => log.source_job_name || '(no job name)').join(' | ') || '(none)'}`,
  ];
}

function buildCalendarDiagnosticLines(diagnostics, events) {
  if (!diagnostics) return [];
  const matchedCount = events.filter(event => event.match_status === 'matched_live' || event.match_status === 'matched_staged').length;
  const unmatched = events.filter(event => event.match_status === 'unmatched' && !event.is_office_event);
  const officeCount = events.filter(event => event.is_office_event).length;
  return [
    `[Calendar PDF diagnostics]`,
    `  parser used:              ${diagnostics.parser}`,
    `  calendar month/year:      ${[diagnostics.month, diagnostics.year].filter(Boolean).join(' ') || '(unknown)'}`,
    `  total raw blocks found:   ${diagnostics.totalRawBlocks}`,
    `  deduplicated events:      ${diagnostics.deduplicatedEvents}`,
    `  duplicate blocks skipped: ${diagnostics.duplicateSkipped}`,
    `  matched jobs:             ${matchedCount}`,
    `  unmatched jobs:           ${unmatched.length}`,
    `  office/internal review:   ${officeCount}`,
    `  malformed blocks:         ${diagnostics.malformedBlocks}`,
    `  first 10 parsed events:   ${diagnostics.first10Events?.join(' | ') || '(none)'}`,
  ];
}

const STEPS = { UPLOAD: 'upload', DRY_RUN: 'dry_run', CONFIRM: 'confirm', DONE: 'done' };

export default function BTImport() {
  const qc = useQueryClient();
  const session = getSession();
  const actorName = session?.employee?.name || session?.name || 'Admin';

  const [step, setStep]         = useState(STEPS.UPLOAD);
  const [parsing, setParsing]   = useState(false);
  const [importing, setImporting] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
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

  const backfillMutation = useMutation({
    mutationFn: () => backfillBuildertrendImportedJobs(actorName),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['admin-jobs'] });
      toast.success(`Normalized ${result.updated.length} Buildertrend job${result.updated.length === 1 ? '' : 's'}`);
      if (result.errors.length) {
        toast.error(`${result.errors.length} Buildertrend job${result.errors.length === 1 ? '' : 's'} could not be normalized`);
      }
    },
    onError: (err) => toast.error(err?.message || 'Buildertrend cleanup failed'),
  });

  const handleFilesReady = useCallback(async (files) => {
    setParsing(true);
    setParseError('');
    setParseErrors([]);
    setProgressMessage('');
    setStagedJobs([]);
    setStagedLogs([]);
    setStagedEvents([]);
    setCurrentBatchId(null);

    try {
      // Create an ImportBatch record immediately for tracking
      const fileNames = Object.entries(files).map(([type, f]) => `${type}:${f.name}`).join(', ');
      const sourceType = Object.keys(files).length === 1 ? Object.keys(files)[0] : 'mixed';

      const batch = await withRateLimitRetry(() => base44.entities.ImportBatch.create({
        source_system: 'buildertrend',
        source_type: sourceType,
        source_file_name: fileNames,
        uploaded_by: actorName,
        uploaded_at: new Date().toISOString(),
        dry_run_status: 'running',
        import_status: 'not_started',
      }), {
        onRetry: () => setProgressMessage('Creating import batch after Base44 rate limit...'),
      });
      setCurrentBatchId(batch.id);

      const allErrors = [];
      let jobs = [], logs = [], events = [];
      let liveJobsForMatching = null;

      // Parse Jobsites CSV — RFC4180 state-machine, no AI extraction
      if (files.jobsites) {
        const { rows, debugInfo } = await parseJobsitesCsv(files.jobsites);
        const result = parseJobsiteRows(rows, batch.id, files.jobsites.name);
        liveJobsForMatching = liveJobsForMatching || await base44.entities.Job.list('-created_date');
        jobs = markAlreadyImportedJobs(result.staged, liveJobsForMatching);
        allErrors.push(...result.errors.map(e => `[Jobs] ${e}`));

        // ── Parser diagnostics summary (always shown) ─────────────────────────
        allErrors.unshift(
          `[Parser diagnostics]`,
          `  parser:             ${debugInfo.parser}`,
          `  total raw records:  ${debugInfo.totalRawRecords}`,
          `  parsed rows:        ${debugInfo.totalParsedRows}`,
          `  skipped blank:      ${debugInfo.skippedBlank}`,
          `  malformed (fragmented): ${debugInfo.malformedCount}`,
          `  first 5 job names:  ${debugInfo.first5JobNames.join(' | ')}`,
        );

        // ── Fragmented row details ─────────────────────────────────────────────
        if (debugInfo.malformedRows && debugInfo.malformedRows.length > 0) {
          allErrors.push(``, `[Fragmented rows — possible multiline row fragmentation]`);
          debugInfo.malformedRows.forEach(m => {
            allErrors.push(
              `  Row ${m.sourceRow}: ${m.reason}`,
              `    Fields: ${Object.entries(m.fields).filter(([,v]) => v).map(([k,v]) => `${k}="${v}"`).join(', ')}`,
            );
          });
        }
      }

      // Parse Daily Logs (no matching yet — staged job IDs not known until after DB insert)
      if (files.daily_logs) {
        const text = await files.daily_logs.text();
        const result = parseDailyLogText(text, batch.id, files.daily_logs.name);
        liveJobsForMatching = liveJobsForMatching || await base44.entities.Job.list('-created_date');
        logs = matchDailyLogsToImportedJobs(result.staged, liveJobsForMatching);
        allErrors.push(...buildDailyLogDiagnosticLines(result.diagnostics, logs));
        allErrors.push(...result.errors.map(e => `[Logs] ${e}`));
        if (logs.length === 0) {
          throw new Error(result.errors.join('\n\n') || 'Daily Logs parse produced zero logs.');
        }
      }

      // Parse Calendar (same — match after DB insert)
      if (files.schedule_calendar) {
        const isPdf = files.schedule_calendar.type === 'application/pdf' || /\.pdf$/i.test(files.schedule_calendar.name);
        const result = isPdf
          ? parseCalendarPdfPages(await extractPdfTextPages(files.schedule_calendar), batch.id, files.schedule_calendar.name)
          : parseCalendarText(await readFileAsText(files.schedule_calendar), batch.id, files.schedule_calendar.name);
        liveJobsForMatching = liveJobsForMatching || await base44.entities.Job.list('-created_date');
        events = matchCalendarEventsToImportedJobs(result.staged, liveJobsForMatching);
        if (isPdf) allErrors.push(...buildCalendarDiagnosticLines(result.diagnostics, events));
        allErrors.push(...result.errors.map(e => `[Calendar] ${e}`));
      }

      // Persist staged records to DB
      if (jobs.length) {
        setProgressMessage(`Staging Jobs 0/${jobs.length}`);
        await runThrottled(jobs, async (chunk) => {
          await base44.entities.StagedJob.bulkCreate(chunk);
        }, {
          onProgress: ({ completed, total, batchSize }) => setProgressMessage(`Staging Jobs ${Math.min(completed + batchSize, total)}/${total}`),
          onRetry: ({ delayMs }) => setProgressMessage(`Staging Jobs hit a Base44 rate limit. Retrying in ${Math.round(delayMs / 1000)}s...`),
        });
      }
      if (logs.length) {
        setProgressMessage(`Staging Daily Logs 0/${logs.length}`);
        await runThrottled(logs, async (chunk) => {
          await base44.entities.StagedDailyLog.bulkCreate(chunk);
        }, {
          onProgress: ({ completed, total, batchSize }) => setProgressMessage(`Staging Daily Logs ${Math.min(completed + batchSize, total)}/${total}`),
          onRetry: ({ delayMs }) => setProgressMessage(`Staging Daily Logs hit a Base44 rate limit. Retrying in ${Math.round(delayMs / 1000)}s...`),
        });
      }
      if (events.length) {
        setProgressMessage(`Staging Calendar Events 0/${events.length}`);
        await runThrottled(events, async (chunk) => {
          await base44.entities.StagedCalendarEvent.bulkCreate(chunk);
        }, {
          onProgress: ({ completed, total, batchSize }) => setProgressMessage(`Staging Calendar Events ${Math.min(completed + batchSize, total)}/${total}`),
          onRetry: ({ delayMs }) => setProgressMessage(`Staging Calendar Events hit a Base44 rate limit. Retrying in ${Math.round(delayMs / 1000)}s...`),
        });
      }

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
      const matchedLogs = dbLogs.filter(l => l.match_status !== 'unmatched');
      const matchedEvents = dbEvents.filter(e => e.match_status !== 'unmatched');
      if (matchedLogs.length) {
        await runThrottled(matchedLogs, async (chunk) => {
          for (const log of chunk) {
            await base44.entities.StagedDailyLog.update(log.id, {
              match_status: log.match_status,
              matched_staged_job_id: log.matched_staged_job_id || null,
            });
          }
        });
      }
      if (matchedEvents.length) {
        await runThrottled(matchedEvents, async (chunk) => {
          for (const event of chunk) {
            await base44.entities.StagedCalendarEvent.update(event.id, {
              match_status: event.match_status,
              matched_job_id: event.matched_job_id || null,
              matched_staged_job_id: event.matched_staged_job_id || null,
            });
          }
        });
      }

      // Update batch with counts
      await withRateLimitRetry(() => base44.entities.ImportBatch.update(batch.id, {
        dry_run_status: 'complete',
        total_rows: dbJobs.length + dbLogs.length + dbEvents.length,
        staged_count: dbJobs.length + dbLogs.length + dbEvents.length,
        warning_count: dbJobs.filter(j => safeParseJson(j.warnings, []).length > 0).length,
        error_count: allErrors.length,
      }), {
        onRetry: () => setProgressMessage('Finalizing import batch after Base44 rate limit...'),
      });

      setStagedJobs(dbJobs);
      setStagedLogs(dbLogs);
      setStagedEvents(dbEvents);
      // Note: dbLogs/dbEvents here already have updated match_status from the cross-match step
      setParseErrors(allErrors);
      setStep(STEPS.DRY_RUN);
      qc.invalidateQueries({ queryKey: ['import_batches'] });
    } catch (err) {
      setParseError(isRateLimitError(err) ? RATE_LIMIT_ERROR_MESSAGE : (err.message || 'Parse failed'));
    } finally {
      setProgressMessage('');
      setParsing(false);
    }
  }, [actorName, qc]);

  // ── Step 2: Review — approve/skip individual records ──────────────────────

  const handleJobStatusChange = useCallback(async (id, status) => {
    await withRateLimitRetry(() => base44.entities.StagedJob.update(id, { review_status: status, reviewed_by: actorName }));
    setStagedJobs(prev => prev.map(j => j.id === id ? { ...j, review_status: status } : j));
  }, [actorName]);

  const handleLogStatusChange = useCallback(async (id, status) => {
    await withRateLimitRetry(() => base44.entities.StagedDailyLog.update(id, { review_status: status, reviewed_by: actorName }));
    setStagedLogs(prev => prev.map(l => l.id === id ? { ...l, review_status: status } : l));
  }, [actorName]);

  const handleEventStatusChange = useCallback(async (id, status) => {
    await withRateLimitRetry(() => base44.entities.StagedCalendarEvent.update(id, { review_status: status, reviewed_by: actorName }));
    setStagedEvents(prev => prev.map(e => e.id === id ? { ...e, review_status: status } : e));
  }, [actorName]);

  // ── Step 3: Confirmed live import ─────────────────────────────────────────

  const handleConfirmImport = useCallback(async () => {
    setImporting(true);
    try {
      await base44.entities.ImportBatch.update(currentBatchId, { import_status: 'in_progress' });

      const approvedJobs   = stagedJobs.filter(j => j.review_status === 'approved' && j.match_status !== 'already_imported');
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
    newJobs:        stagedJobs.filter(j => j.match_status === 'new').length,
    alreadyImportedJobs: stagedJobs.filter(j => j.match_status === 'already_imported').length,
    duplicateJobs:  stagedJobs.filter(j => j.match_status === 'possible_duplicate').length,
    flaggedJobs:    stagedJobs.filter(j => j.match_status === 'needs_review').length,
    internalJobs:   stagedJobs.filter(j => safeParseJson(j.flags, []).includes('internal_record')).length,
    missingAddressJobs: stagedJobs.filter(j => safeParseJson(j.flags, []).includes('missing_address')).length,
    missingClientJobs: stagedJobs.filter(j => safeParseJson(j.flags, []).includes('missing_client')).length,
    approvedJobs:   stagedJobs.filter(j => j.review_status === 'approved').length,
    skippedJobs:    stagedJobs.filter(j => j.review_status === 'skipped').length,
    totalLogs:      stagedLogs.length,
    matchedLogs:    stagedLogs.filter(l => l.match_status === 'matched_live' || l.match_status === 'matched_staged').length,
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
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-2 text-sm"
              onClick={() => backfillMutation.mutate()}
              disabled={backfillMutation.isPending}
            >
              {backfillMutation.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Shield className="w-4 h-4" />
              }
              Normalize Imported Jobs
            </Button>
            {step !== STEPS.UPLOAD && (
              <Button variant="outline" className="gap-2 text-sm" onClick={() => { setStep(STEPS.UPLOAD); setStagedJobs([]); setStagedLogs([]); setStagedEvents([]); setImportResult(null); setParseError(''); }}>
                <RotateCcw className="w-4 h-4" /> New Import
              </Button>
            )}
          </div>
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
            {progressMessage && <div className="pl-6 text-xs text-muted-foreground">{progressMessage}</div>}
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
