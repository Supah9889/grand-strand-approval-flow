/**
 * Buildertrend Phase 1 — Live Import
 * Only called AFTER admin explicitly confirms on the dry-run review screen.
 * Every record is tagged source_system: 'buildertrend' and includes batch traceability.
 * NO live records are created anywhere else in the import pipeline.
 */
import { base44 } from '@/api/base44Client';

// ─── Jobs ─────────────────────────────────────────────────────────────────────

/**
 * Create live Job records from approved StagedJob records.
 * Tags every record with source_system: 'buildertrend' and import batch ID.
 */
export async function importApprovedJobs(batchId, approvedJobs, actorName) {
  const imported = [];
  const skipped  = [];
  const errors   = [];

  for (const staged of approvedJobs) {
    if (staged.review_status !== 'approved') {
      skipped.push({ stagedId: staged.id, reason: 'not approved' });
      continue;
    }

    // Skip if already imported
    if (staged.live_job_id) {
      skipped.push({ stagedId: staged.id, reason: 'already imported' });
      continue;
    }

    try {
      const address = [staged.address, staged.city, staged.state].filter(Boolean).join(', ');

      const job = await base44.entities.Job.create({
        title:          staged.clean_job_name || staged.raw_job_name,
        address:        address || staged.address || staged.raw_job_name,
        city:           staged.city     || null,
        state:          staged.state    || null,
        zip:            staged.zip      || null,
        customer_name:  staged.customer_name || 'Unknown',
        customer_email: staged.customer_email || null,
        customer_phone: staged.customer_phone || null,
        description:    `Imported from Buildertrend — ${staged.raw_job_name}`,
        price:          0,
        lifecycle_status: 'open',
        op_status:      'new',
        source_system:  'buildertrend',         // ← traceability tag
        buildertrend_id: staged.raw_job_name,   // preserve raw BT name as reference ID
        start_date:     staged.received_date || null,
        square_footage: staged.square_footage || null,
        // Batch traceability via internal_notes
        internal_notes: `BT Import batch: ${batchId} | staged_id: ${staged.id} | imported by: ${actorName}`,
        assigned_to:    actorName,
      });

      // Update staged record with live ID
      await base44.entities.StagedJob.update(staged.id, {
        live_job_id: job.id,
        imported_at: new Date().toISOString(),
        review_status: 'approved',
      });

      imported.push({ stagedId: staged.id, liveId: job.id, address: job.address });
    } catch (err) {
      errors.push({ stagedId: staged.id, address: staged.address, error: err?.message || 'Unknown error' });
    }
  }

  return { imported, skipped, errors };
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

/**
 * Create live DailyLog records from approved StagedDailyLog records.
 * Uses stagedJobsById map to resolve the live job_id.
 */
export async function importApprovedDailyLogs(batchId, approvedLogs, stagedJobsById, actorName) {
  const imported = [];
  const skipped  = [];
  const errors   = [];

  for (const staged of approvedLogs) {
    if (staged.review_status !== 'approved') {
      skipped.push({ stagedId: staged.id, reason: 'not approved' });
      continue;
    }

    if (staged.live_daily_log_id) {
      skipped.push({ stagedId: staged.id, reason: 'already imported' });
      continue;
    }

    // Resolve job ID: prefer direct match, then staged match
    let liveJobId = staged.matched_job_id || null;
    if (!liveJobId && staged.matched_staged_job_id) {
      const matchedStaged = stagedJobsById[staged.matched_staged_job_id];
      liveJobId = matchedStaged?.live_job_id || null;
    }

    // Also try matching by normalized name from the stagedJobsById map
    if (!liveJobId && staged.normalized_job_name) {
      const matchByName = Object.values(stagedJobsById).find(
        sj => sj.normalized_job_name === staged.normalized_job_name && sj.live_job_id
      );
      if (matchByName) liveJobId = matchByName.live_job_id;
    }

    try {
      const log = await base44.entities.DailyLog.create({
        job_id:         liveJobId || '__unlinked__',
        job_title:      staged.source_job_name || null,
        log_date:       staged.log_date,
        created_by_name: staged.added_by || actorName,
        work_completed: staged.log_notes || staged.title || '(imported from Buildertrend)',
        weather_notes:  staged.weather_summary || null,
        general_notes:  [
          staged.log_notes,
          staged.weather_summary ? `Weather: ${staged.weather_summary}` : null,
          staged.temp_high != null ? `Temp: ${staged.temp_high}°F high / ${staged.temp_low ?? '?'}°F low` : null,
          staged.needs_attachment_review ? `[Attachments not imported — ${staged.attachment_count} file(s) referenced]` : null,
        ].filter(Boolean).join('\n') || null,
        // ── Provenance ──
        source_system:    'buildertrend',
        import_batch_id:  batchId,
        source_file_name: staged.source_file_name || null,
        source_row:       staged.source_row || null,
        raw_source_text:  staged.raw_source_text ? staged.raw_source_text.slice(0, 1000) : null,
      });

      await base44.entities.StagedDailyLog.update(staged.id, {
        live_daily_log_id: log.id,
        imported_at: new Date().toISOString(),
      });

      imported.push({ stagedId: staged.id, liveId: log.id, date: staged.log_date });
    } catch (err) {
      errors.push({ stagedId: staged.id, date: staged.log_date, error: err?.message || 'Unknown error' });
    }
  }

  return { imported, skipped, errors };
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

/**
 * Create live CalendarEvent records from approved StagedCalendarEvent records.
 */
export async function importApprovedCalendarEvents(batchId, approvedEvents, stagedJobsById, actorName) {
  const imported = [];
  const skipped  = [];
  const errors   = [];

  for (const staged of approvedEvents) {
    if (staged.review_status !== 'approved') {
      skipped.push({ stagedId: staged.id, reason: 'not approved' });
      continue;
    }

    if (staged.live_calendar_event_id) {
      skipped.push({ stagedId: staged.id, reason: 'already imported' });
      continue;
    }

    // Resolve job ID
    let liveJobId = staged.matched_job_id || null;
    if (!liveJobId && staged.matched_staged_job_id) {
      const matchedStaged = stagedJobsById[staged.matched_staged_job_id];
      liveJobId = matchedStaged?.live_job_id || null;
    }
    if (!liveJobId && staged.normalized_job_name) {
      const matchByName = Object.values(stagedJobsById).find(
        sj => sj.normalized_job_name === staged.normalized_job_name && sj.live_job_id
      );
      if (matchByName) liveJobId = matchByName.live_job_id;
    }

    // Map category
    const categoryMap = {
      job_visit:      'job_visit',
      estimate:       'estimate_appointment',
      tour:           'other',
      office_internal:'meeting',
      reminder:       'other',
      meeting:        'meeting',
      other:          'other',
    };

    try {
      const event = await base44.entities.CalendarEvent.create({
        title:           staged.event_title,
        event_type:      categoryMap[staged.event_category] || 'other',
        job_id:          liveJobId || null,
        job_address:     staged.source_job_name || null,
        start_date:      staged.event_date,
        end_date:        staged.event_date,
        all_day:         !staged.start_time,
        status:          'scheduled',
        created_by_name: actorName,
        internal_notes:  staged.start_time
          ? `Time: ${staged.start_time}${staged.end_time ? ` – ${staged.end_time}` : ''}`
          : null,
        // ── Provenance ──
        source_system:    'buildertrend',
        import_batch_id:  batchId,
        source_file_name: staged.source_file_name || null,
        source_row:       staged.source_row || null,
        source_page:      staged.source_page || null,
        raw_source_text:  staged.raw_source_text ? staged.raw_source_text.slice(0, 1000) : null,
      });

      await base44.entities.StagedCalendarEvent.update(staged.id, {
        live_calendar_event_id: event.id,
        imported_at: new Date().toISOString(),
      });

      imported.push({ stagedId: staged.id, liveId: event.id, date: staged.event_date });
    } catch (err) {
      errors.push({ stagedId: staged.id, date: staged.event_date, error: err?.message || 'Unknown error' });
    }
  }

  return { imported, skipped, errors };
}