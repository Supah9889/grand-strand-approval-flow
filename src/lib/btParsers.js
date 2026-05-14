/**
 * Buildertrend Phase 1 — Pure Parsing Library
 * All functions are side-effect free. They produce staged record objects
 * that can be written to DB, but never write live Job/DailyLog/CalendarEvent.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(str) {
  return (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function safeJson(arr) {
  try { return JSON.stringify(arr); } catch { return '[]'; }
}

/**
 * BT job names often start with a date prefix like "2026 4/24 4008 Braid Ct"
 * or "04/24/2026 Smith Residence". Strip leading date tokens.
 */
function stripDatePrefix(name) {
  if (!name) return { clean: '', date: null };
  // Pattern: YYYY M/D or MM/DD/YYYY or M/D/YYYY at the start
  const patterns = [
    /^(\d{4})\s+(\d{1,2})\/(\d{1,2})\s+/,   // 2026 4/24
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+/,    // 04/24/2026
    /^(\d{1,2})-(\d{1,2})-(\d{4})\s+/,       // 04-24-2026
  ];

  for (let idx = 0; idx < patterns.length; idx++) {
    const re = patterns[idx];
    const m = name.match(re);
    if (m) {
      const clean = name.replace(re, '').trim();
      let date = null;
      try {
        if (idx === 0) {
          // YYYY M/D  →  m[1]=year m[2]=month m[3]=day
          date = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
        } else {
          // M/D/YYYY or M-D-YYYY  →  m[1]=month m[2]=day m[3]=year
          date = `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
        }
      } catch { date = null; }
      return { clean, date };
    }
  }
  return { clean: name.trim(), date: null };
}

// ─── Jobsite Rows (Excel) ──────────────────────────────────────────────────────

/**
 * Given an array of raw row objects (as returned by ExtractDataFromUploadedFile),
 * detect and skip any export-title rows, then normalise all header keys so we
 * can look them up case-/whitespace-/tab-insensitively.
 *
 * BT export layout:
 *   Row 0  →  "Jobsites (exported on …)"  — title row, no useful data
 *   Row 1  →  actual column headers (may also arrive as row-0 if the LLM skipped the title)
 *   Row 2+ →  job data
 *
 * The function accepts whatever the integration returns (pre-keyed objects) and
 * re-keys them using the BT column name variants we actually care about.
 */

/** Normalise a header string: lowercase, trim, collapse whitespace & tabs */
function normalizeHeader(h) {
  return (h || '').toLowerCase().replace(/[\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Given a row object, return the value for the first key whose normalised form
 * matches any of the supplied candidates (case/whitespace insensitive).
 */
function getField(row, ...candidates) {
  const normCandidates = candidates.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    if (normCandidates.includes(normalizeHeader(key))) {
      const val = row[key];
      return val == null ? '' : String(val).trim();
    }
  }
  return '';
}

/**
 * Detect whether a row is a BT export-title row (e.g. "Jobsites (exported on …)").
 * Title rows have only one non-empty value and it looks like a section header.
 */
function isTitleRow(row) {
  const values = Object.values(row).map(v => (v == null ? '' : String(v).trim())).filter(Boolean);
  if (values.length !== 1) return false;
  return /exported on|jobsites|daily logs|schedule/i.test(values[0]);
}

/**
 * Parse an array of raw Excel row objects into StagedJob records.
 * @param {object[]} rows  — raw objects from ExtractDataFromUploadedFile or xlsx parsing
 * @param {string}   batchId
 * @param {string}   fileName
 * @returns {{ staged: object[], errors: string[] }}
 */
export function parseJobsiteRows(rows, batchId, fileName) {
  const staged = [];
  const errors = [];
  const seenNames = new Map(); // normalized name → first data-row index

  if (!rows || rows.length === 0) {
    errors.push('No rows received from file parser');
    return { staged, errors };
  }

  // ── Skip title rows at the top ──────────────────────────────────────────────
  let dataRows = rows;
  let skippedTitleRows = 0;
  while (dataRows.length > 0 && isTitleRow(dataRows[0])) {
    dataRows = dataRows.slice(1);
    skippedTitleRows++;
  }

  console.log(`[btParsers] parseJobsiteRows — title rows skipped: ${skippedTitleRows}`);
  console.log(`[btParsers] Total data rows to parse: ${dataRows.length}`);
  if (dataRows.length > 0) {
    const sampleHeaders = Object.keys(dataRows[0]).map(normalizeHeader);
    console.log(`[btParsers] Detected headers (normalised):`, sampleHeaders);
  }

  dataRows.forEach((row, i) => {
    // ── Job Name — try all known BT variants ─────────────────────────────────
    const rawName = getField(row, 'Job Name', 'job name', 'JobName', 'job_name', 'Name');
    if (!rawName) {
      errors.push(`Row ${i + 1 + skippedTitleRows + 1}: missing Job Name — skipped`);
      return;
    }

    const { clean: cleanName, date: receivedDate } = stripDatePrefix(rawName);
    const normalizedName = normalize(cleanName || rawName);

    const warnings = [];
    const flags = [];

    // Duplicate detection within this batch
    const isDuplicate = seenNames.has(normalizedName);
    if (isDuplicate) {
      warnings.push(`Possible duplicate of row ${seenNames.get(normalizedName) + 1 + skippedTitleRows + 1}`);
    } else {
      seenNames.set(normalizedName, i);
    }

    // ── Field extraction — BT actual column names + common variants ──────────
    const address = getField(row, 'Street Address', 'Address', 'address', 'street_address');
    const city    = getField(row, 'City', 'city');
    const state   = getField(row, 'State', 'state');
    const zip     = getField(row, 'Zip', 'zip', 'Postal Code', 'postal_code', 'ZIP Code');
    const client  = getField(row, 'Clients', 'Client', 'client', 'Customer', 'customer');
    const phone   = getField(row, 'Client Phone', 'Phone', 'phone', 'client_phone');
    const email   = getField(row, 'Client Email', 'Email', 'email', 'client_email');
    const sqft    = parseFloat(getField(row, 'Square Footage', 'square_footage', 'Sq Ft', 'sqft')) || null;
    const schedSt = getField(row, 'Schedule Status', 'schedule_status', 'Status');

    if (!address && !city) flags.push('missing_address');
    if (!client)            flags.push('missing_client');
    if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) flags.push('invalid_zip');

    if (/grand strand office|gs office|\binternal\b|\btest\b|office only/i.test(normalizedName)) {
      flags.push('internal_record');
    }

    staged.push({
      import_batch_id: batchId,
      source_file_name: fileName,
      source_row: i + 1 + skippedTitleRows + 1, // 1-based, accounting for skipped rows
      raw_source_text: JSON.stringify(row).slice(0, 1000),
      raw_job_name: rawName,
      clean_job_name: cleanName,
      normalized_job_name: normalizedName,
      received_date: receivedDate || null,
      address,
      city,
      state,
      zip,
      customer_name: client,
      customer_phone: phone,
      customer_email: email,
      schedule_status: schedSt || null,
      square_footage: sqft,
      match_status: isDuplicate ? 'possible_duplicate' : 'new',
      matched_job_id: null,
      warnings: safeJson(warnings),
      errors: safeJson([]),
      flags: safeJson(flags),
      review_status: 'pending',
    });
  });

  console.log(`[btParsers] Staged ${staged.length} jobs, ${errors.length} skipped/errors`);
  return { staged, errors };
}

// ─── Daily Log Text ────────────────────────────────────────────────────────────

/**
 * Parse a plain-text Buildertrend Daily Log export.
 * Logs are separated by blank lines; each block starts with "Date: " and "Job: ".
 */
export function parseDailyLogText(text, batchId, fileName) {
  const staged = [];
  const errors = [];

  if (!text || !text.trim()) {
    errors.push('Empty daily log file');
    return { staged, errors };
  }

  // Split into blocks by double newlines
  const blocks = text.split(/\n{2,}/);

  blocks.forEach((block, i) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    const get = (prefix) => {
      const line = lines.find(l => l.toLowerCase().startsWith(prefix.toLowerCase()));
      return line ? line.slice(prefix.length).trim() : '';
    };

    const rawDate     = get('Date:') || get('date:');
    const jobName     = get('Job:')  || get('job:') || get('Project:');
    const addedBy     = get('Added By:') || get('added by:') || get('Author:');
    const title       = get('Title:') || get('title:') || '';
    const weatherSum  = get('Weather:') || get('weather:') || '';

    // Notes: everything after known headers
    const headerPrefixes = ['date:', 'job:', 'added by:', 'author:', 'title:', 'weather:', 'temperature:', 'wind:', 'humidity:', 'precipitation:'];
    const noteLines = lines.filter(l => !headerPrefixes.some(p => l.toLowerCase().startsWith(p)));
    const logNotes = noteLines.join('\n').trim();

    if (!rawDate && !jobName) return; // skip completely empty blocks

    // Parse date
    let logDate = null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        logDate = d.toISOString().split('T')[0];
      } else {
        errors.push(`Block ${i + 1}: could not parse date "${rawDate}"`);
      }
    }

    if (!logDate) {
      errors.push(`Block ${i + 1}: missing date — skipped`);
      return;
    }

    // Weather temp parse
    const tempLine = get('Temperature:') || get('temperature:') || '';
    let tempHigh = null, tempLow = null;
    if (tempLine) {
      const nums = tempLine.match(/\d+/g);
      if (nums && nums.length >= 2) { tempHigh = Number(nums[0]); tempLow = Number(nums[1]); }
      else if (nums && nums.length === 1) { tempHigh = Number(nums[0]); }
    }

    const attachmentCount = (block.match(/\[attachment\]|\[photo\]|\.jpg|\.png|\.pdf/gi) || []).length;

    staged.push({
      import_batch_id: batchId,
      source_file_name: fileName,
      source_row: i + 1,
      raw_source_text: block.slice(0, 2000),
      log_date: logDate,
      source_job_name: jobName || '',
      normalized_job_name: normalize(jobName || ''),
      title: title || null,
      added_by: addedBy || null,
      log_notes: logNotes || null,
      weather_summary: weatherSum || null,
      temp_high: tempHigh,
      temp_low: tempLow,
      wind: get('Wind:') || null,
      humidity: get('Humidity:') || null,
      precipitation: get('Precipitation:') || null,
      attachment_count: attachmentCount,
      needs_attachment_review: attachmentCount > 0,
      match_status: 'unmatched',
      matched_job_id: null,
      matched_staged_job_id: null,
      warnings: safeJson([]),
      errors: safeJson([]),
      review_status: 'pending',
    });
  });

  return { staged, errors };
}

// ─── Calendar/Schedule Text ────────────────────────────────────────────────────

const NON_PRODUCTION_KEYWORDS = /\b(estimate|tour|birthday|reminder|meeting|office|holiday|closed|vacation|training)\b/i;
const OFFICE_KEYWORDS = /grand strand office|gs office|office only/i;

/**
 * Parse a plain-text Buildertrend schedule/calendar export.
 * Each line is: "DATE   EVENT TITLE (Job Name)"  or  "DATE TIME-TIME EVENT TITLE"
 */
export function parseCalendarText(text, batchId, fileName) {
  const staged = [];
  const errors = [];

  if (!text || !text.trim()) {
    errors.push('Empty calendar file');
    return { staged, errors };
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  lines.forEach((line, i) => {
    // Try to extract a date from start of line
    const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) return; // header or blank

    let eventDate = null;
    try {
      const d = new Date(dateMatch[1]);
      if (!isNaN(d.getTime())) eventDate = d.toISOString().split('T')[0];
    } catch { /* skip */ }

    if (!eventDate) {
      errors.push(`Line ${i + 1}: could not parse date from "${line}"`);
      return;
    }

    const rest = line.slice(dateMatch[0].length).trim();

    // Time range: "9:00 AM - 11:00 AM"
    const timeMatch = rest.match(/^(\d{1,2}:\d{2}\s*[AP]M)\s*[-–]\s*(\d{1,2}:\d{2}\s*[AP]M)\s*/i);
    let startTime = null, endTime = null, titleRest = rest;
    if (timeMatch) {
      startTime = timeMatch[1];
      endTime   = timeMatch[2];
      titleRest = rest.slice(timeMatch[0].length).trim();
    }

    // Extract job name from parentheses at end: "Paint (4008 Braid Ct)"
    const jobMatch = titleRest.match(/\(([^)]+)\)\s*$/);
    let sourceJobName = '';
    let eventTitle = titleRest;
    if (jobMatch) {
      sourceJobName = jobMatch[1].trim();
      eventTitle = titleRest.slice(0, jobMatch.index).trim();
    }

    if (!eventTitle) eventTitle = sourceJobName || 'Untitled';

    const isNonProd = NON_PRODUCTION_KEYWORDS.test(eventTitle) || NON_PRODUCTION_KEYWORDS.test(sourceJobName);
    const isOffice  = OFFICE_KEYWORDS.test(eventTitle) || OFFICE_KEYWORDS.test(sourceJobName) || !sourceJobName;

    let eventCategory = 'other';
    if (/estimate/i.test(eventTitle))        eventCategory = 'estimate';
    else if (/tour/i.test(eventTitle))       eventCategory = 'tour';
    else if (/meeting/i.test(eventTitle))    eventCategory = 'meeting';
    else if (/reminder/i.test(eventTitle))   eventCategory = 'reminder';
    else if (isOffice && !sourceJobName)     eventCategory = 'office_internal';
    else if (sourceJobName)                  eventCategory = 'job_visit';

    staged.push({
      import_batch_id: batchId,
      source_file_name: fileName,
      source_row: i + 1,
      raw_source_text: line,
      event_date: eventDate,
      event_title: eventTitle,
      start_time: startTime,
      end_time: endTime,
      source_job_name: sourceJobName,
      normalized_job_name: normalize(sourceJobName),
      event_category: eventCategory,
      is_non_production: isNonProd,
      is_office_event: isOffice,
      match_status: 'unmatched',
      matched_job_id: null,
      matched_staged_job_id: null,
      warnings: safeJson([]),
      errors: safeJson([]),
      review_status: 'pending',
    });
  });

  return { staged, errors };
}

// ─── Cross-Matching ────────────────────────────────────────────────────────────

/**
 * Try to match staged logs to staged jobs by normalized job name.
 * Updates match_status and matched_staged_job_id in place.
 */
export function matchLogsToJobs(stagedLogs, stagedJobs) {
  // stagedJobs here are post-DB-insert objects (reloaded with IDs) when called from BTImport
  const jobIndex = new Map(stagedJobs.map(j => [j.normalized_job_name, j]));

  return stagedLogs.map(log => {
    const norm = log.normalized_job_name;
    if (!norm) return log;
    const match = jobIndex.get(norm);
    if (match) {
      return {
        ...log,
        match_status: 'matched_staged',
        matched_staged_job_id: match.id || null,
      };
    }
    return log;
  });
}

/**
 * Try to match staged events to staged jobs by normalized job name.
 */
export function matchEventsToJobs(stagedEvents, stagedJobs) {
  const jobIndex = new Map(stagedJobs.map(j => [j.normalized_job_name, j]));

  return stagedEvents.map(ev => {
    const norm = ev.normalized_job_name;
    if (!norm || ev.is_office_event) return ev;
    const match = jobIndex.get(norm);
    if (match) {
      return {
        ...ev,
        match_status: 'matched_staged',
      };
    }
    return ev;
  });
}