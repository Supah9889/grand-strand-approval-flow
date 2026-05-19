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

const MONTHS = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

const DATE_HEADING_RE = /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2}),\s+(\d{4})$/i;

function parseDateHeading(line) {
  const match = String(line || '').trim().match(DATE_HEADING_RE);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${month}-${String(match[2]).padStart(2, '0')}`;
}

function isLabelLine(line, label) {
  return String(line || '').trim().toLowerCase() === label.toLowerCase();
}

function nextNonEmptyIndex(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (String(lines[i] || '').trim()) return i;
  }
  return -1;
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

function normalizeJobNameForMatch(name) {
  return normalize(stripDatePrefix(name || '').clean || name || '');
}

function normalizeHashValue(value) {
  return normalizeJobNameForMatch(value)
    .replace(/[^\w\s#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    const normalizedName = normalizeJobNameForMatch(rawName);

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
function parseDailyLogTextLegacy(text, batchId, fileName) {
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
      normalized_job_name: normalizeJobNameForMatch(jobName || ''),
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
const PRODUCTION_KEYWORDS = /\b(drywall|paint|painting|patch|skim|install|repair|trim|texture|caulk|carpentry|framing|siding|ceiling|punch|warranty|touch\s*up)\b/i;
const TIME_RE = /\b\d{1,2}:\d{2}\s*[AP]M\b/gi;
const TIME_LINE_RE = /^\d{1,2}:\d{2}\s*[AP]M$/i;

function classifyCalendarEvent(eventTitle, sourceJobName) {
  const combined = `${eventTitle || ''} ${sourceJobName || ''}`;
  const isOffice = OFFICE_KEYWORDS.test(combined) || NON_PRODUCTION_KEYWORDS.test(combined) || !sourceJobName;

  let eventCategory = 'other';
  if (/estimate/i.test(combined)) eventCategory = 'estimate';
  else if (/tour/i.test(combined)) eventCategory = 'tour';
  else if (/meeting/i.test(combined)) eventCategory = 'meeting';
  else if (/reminder/i.test(combined)) eventCategory = 'reminder';
  else if (isOffice) eventCategory = 'office_internal';
  else if (PRODUCTION_KEYWORDS.test(combined) || sourceJobName) eventCategory = 'job_visit';

  return {
    eventCategory,
    isNonProduction: isOffice && !PRODUCTION_KEYWORDS.test(combined),
    isOffice,
  };
}

function createCalendarDuplicateHash({ eventTitle, eventDate, startTime, endTime, sourceJobName }) {
  return [
    eventDate || '',
    startTime || '',
    endTime || '',
    normalizeHashValue(eventTitle),
    normalizeHashValue(sourceJobName),
  ].join('|');
}

function cleanCalendarText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s*$/, '')
    .replace(/-\s*$/, '')
    .trim();
}

function isValidIsoCalendarDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeCalendarDateParts(year, month, day) {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidIsoCalendarDate(iso) ? iso : null;
}

function extractCalendarDate(value) {
  const text = String(value || '');
  const datePrefix = stripDatePrefix(text);
  if (datePrefix.date && isValidIsoCalendarDate(datePrefix.date)) return datePrefix.date;

  const isoMatch = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoMatch) {
    const iso = normalizeCalendarDateParts(isoMatch[1], isoMatch[2], isoMatch[3]);
    if (iso) return iso;
  }

  const slashMatch = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (slashMatch) {
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    const iso = normalizeCalendarDateParts(year, slashMatch[1], slashMatch[2]);
    if (iso) return iso;
  }

  return null;
}

function extractCalendarDateTokens(value) {
  const text = String(value || '');
  const tokens = [];
  const patterns = [
    /\b20\d{2}\s+\d{1,2}\/\d{1,2}\b/g,
    /\b20\d{2}-\d{1,2}-\d{1,2}\b/g,
    /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g,
  ];
  patterns.forEach((pattern) => {
    const matches = text.match(pattern);
    if (matches) tokens.push(...matches);
  });
  return [...new Set(tokens)];
}

function extractCalendarTime(value) {
  const match = String(value || '').match(/\b(\d{1,2}:\d{2})\s*([AP]M)\b/i);
  return match ? `${match[1]} ${match[2].toUpperCase()}` : null;
}

function isCalendarNoiseLine(line) {
  const value = String(line || '').trim();
  if (!value) return true;
  if (value === '-') return true;
  if (/^non-workday$/i.test(value)) return true;
  if (/^(schedule\s+-|all listed jobs$)/i.test(value)) return true;
  if (/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i.test(value)) return true;
  if (/^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i.test(value)) return true;
  if (/^\d{1,2}$/.test(value)) return true;
  return false;
}

function collectCalendarParenValue(lines, startIndex) {
  const collected = [];
  for (let i = startIndex; i < lines.length; i++) {
    collected.push(lines[i]);
    if (lines[i].includes(')')) {
      const raw = collected.join(' ');
      const match = raw.match(/\(([\s\S]*?)\)/);
      return {
        endIndex: i,
        value: cleanCalendarText(match?.[1] || raw.replace(/[()]/g, ' ')),
      };
    }
  }

  return {
    endIndex: startIndex,
    value: cleanCalendarText(lines[startIndex].replace(/[()]/g, ' ')),
  };
}

function collectCalendarTitleLines(lines, parenStartIndex, previousBlockEnd) {
  const titleLines = [];
  let startIndex = parenStartIndex;

  for (let i = parenStartIndex - 1; i > previousBlockEnd; i--) {
    const line = String(lines[i] || '').trim();
    if (TIME_LINE_RE.test(line)) break;
    if (line.includes(')')) break;
    if (line === '-') {
      startIndex = i;
      continue;
    }
    if (isCalendarNoiseLine(line)) break;
    titleLines.unshift(line);
    startIndex = i;
    if (titleLines.length >= 4) break;
  }

  return {
    startIndex,
    title: cleanCalendarText(titleLines.join(' ')),
  };
}

function collectCalendarTimes(lines, startIndex) {
  const times = [];
  let endIndex = startIndex - 1;

  for (let i = startIndex; i < Math.min(lines.length, startIndex + 8); i++) {
    const line = String(lines[i] || '').trim();
    if (!line) continue;
    const time = extractCalendarTime(line);
    if (time && TIME_LINE_RE.test(line)) {
      times.push(time);
      endIndex = i;
      if (times.length >= 2) break;
      continue;
    }
    if (!isCalendarNoiseLine(line)) break;
  }

  return {
    startTime: times[0] || null,
    endTime: times[1] || null,
    endIndex,
  };
}

function splitFlattenedCalendarTextBlocks(lines) {
  const blocks = [];
  let previousBlockEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    if (!String(lines[i] || '').includes('(')) continue;

    const title = collectCalendarTitleLines(lines, i, previousBlockEnd);
    const paren = collectCalendarParenValue(lines, i);
    const times = collectCalendarTimes(lines, paren.endIndex + 1);
    const blockEnd = Math.max(paren.endIndex, times.endIndex);
    const sourceStart = Math.min(title.startIndex, i);
    const rawLines = lines.slice(sourceStart, blockEnd + 1);

    blocks.push({
      sourceRow: sourceStart + 1,
      rawLines,
      eventTitle: title.title,
      sourceJobName: paren.value,
      startTime: times.startTime,
      endTime: times.endTime,
    });

    previousBlockEnd = blockEnd;
    i = Math.max(i, blockEnd);
  }

  return blocks;
}

function hasStructuredCalendarText(lines) {
  const joined = lines.join('\n');
  return /^Calendar Event\s+\d+\b/im.test(joined)
    && /^Event Date:\s*/im.test(joined)
    && /^Title:\s*/im.test(joined)
    && /^Job:\s*/im.test(joined);
}

function splitStructuredCalendarTextBlocks(lines) {
  const starts = [];
  lines.forEach((line, index) => {
    if (/^Calendar Event\s+\d+\b/i.test(line)) starts.push(index);
  });

  return starts.map((start, index) => {
    const end = starts[index + 1] ?? lines.length;
    return {
      sourceRow: start + 1,
      rawLines: lines.slice(start, end),
    };
  });
}

function getStructuredCalendarField(blockLines, label) {
  const pattern = new RegExp(`^${label}:\\s*(.*)$`, 'i');
  const match = blockLines.find(line => pattern.test(line))?.match(pattern);
  return cleanCalendarText(match?.[1] || '');
}

function parseStructuredCalendarBlock(block) {
  const eventDate = getStructuredCalendarField(block.rawLines, 'Event Date');
  return {
    sourceRow: block.sourceRow,
    rawSourceText: block.rawLines.join('\n'),
    eventDate,
    eventTitle: getStructuredCalendarField(block.rawLines, 'Title'),
    sourceJobName: getStructuredCalendarField(block.rawLines, 'Job'),
    startTime: extractCalendarTime(getStructuredCalendarField(block.rawLines, 'Start Time')),
    endTime: extractCalendarTime(getStructuredCalendarField(block.rawLines, 'End Time')),
  };
}

function normalizePdfItems(items) {
  return (items || [])
    .map(item => ({
      ...item,
      str: String(item.str || '').trim(),
      x: Number(item.x || 0),
      y: Number(item.y || 0),
      page: Number(item.page || 1),
    }))
    .filter(item => item.str);
}

function detectCalendarMonthYear(pages) {
  const monthNames = Object.keys(MONTHS).filter(name => name.length > 3 || name === 'may');
  const allText = pages.flatMap(page => page.items.map(item => item.str));
  const monthLabel = allText.find(text => monthNames.some(month => month.toLowerCase() === text.toLowerCase()));
  const month = monthLabel ? Number(MONTHS[monthLabel.toLowerCase()]) : null;
  const yearMatch = allText.join(' ').match(/\b(20\d{2})\s+\d{1,2}\/\d{1,2}\b/) || allText.join(' ').match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  return { month, year, label: monthLabel || '' };
}

function findDayMarkerRows(items) {
  const candidates = items
    .filter(item => /^\d{1,2}$/.test(item.str) && Number(item.str) >= 1 && Number(item.str) <= 31)
    .filter(item => item.x >= 35 && item.x <= 740);

  const byY = new Map();
  candidates.forEach(item => {
    const yKey = Math.round(item.y / 4) * 4;
    if (!byY.has(yKey)) byY.set(yKey, []);
    byY.get(yKey).push(item);
  });

  return [...byY.entries()]
    .map(([y, rowItems]) => ({
      y: Number(y),
      items: rowItems.sort((a, b) => a.x - b.x).slice(0, 7),
    }))
    .filter(row => row.items.length >= 7)
    .sort((a, b) => b.y - a.y);
}

function assignDatesToRows(rows, month, year) {
  if (!month || !year) return rows;
  let cursorMonth = rows[0]?.items?.[0] && Number(rows[0].items[0].str) > 7 ? month - 1 : month;
  let cursorYear = year;
  if (cursorMonth === 0) {
    cursorMonth = 12;
    cursorYear -= 1;
  }
  let previousDay = null;

  return rows.map(row => ({
    ...row,
    dates: row.items.map(item => {
      const day = Number(item.str);
      if (previousDay != null && day < previousDay) {
        cursorMonth += 1;
        if (cursorMonth === 13) {
          cursorMonth = 1;
          cursorYear += 1;
        }
      }
      previousDay = day;
      return `${cursorYear}-${String(cursorMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }),
  }));
}

function getColumnIndex(item, row) {
  const centers = row.items.map(marker => marker.x);
  let bestIndex = 0;
  let bestDistance = Infinity;
  centers.forEach((center, index) => {
    const distance = Math.abs(item.x - center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function groupCellLines(items) {
  const seen = new Set();
  const uniqueItems = [];
  items.forEach(item => {
    const key = `${Math.round(item.x)}|${Math.round(item.y)}|${item.str}`;
    if (seen.has(key)) return;
    seen.add(key);
    uniqueItems.push(item);
  });

  const rows = [];
  uniqueItems.sort((a, b) => b.y - a.y || a.x - b.x).forEach(item => {
    const row = rows.find(existing => Math.abs(existing.y - item.y) <= 4);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  });

  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.str).join(' ').trim())
    .filter(line => line && !/^non-workday$/i.test(line) && !/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i.test(line));
}

function splitCalendarEventBlocks(lines) {
  const raw = lines.join('\n');
  const parenMatches = [...raw.matchAll(/\([^)]{2,200}\)/g)];
  if (parenMatches.length) {
    return parenMatches.map((match, index) => {
      const previousEnd = index > 0 ? parenMatches[index - 1].index + parenMatches[index - 1][0].length : 0;
      const nextStart = parenMatches[index + 1]?.index ?? raw.length;
      return raw.slice(previousEnd, nextStart).split('\n').map(line => line.trim()).filter(Boolean);
    });
  }

  const blocks = [];
  let current = [];
  let timeCount = 0;

  lines.forEach(line => {
    current.push(line);
    timeCount += (line.match(TIME_RE) || []).length;
    if (timeCount >= 2) {
      blocks.push(current);
      current = [];
      timeCount = 0;
    }
  });

  if (current.some(line => /\([^)]*/.test(line))) blocks.push(current);
  return blocks;
}

function parseCalendarEventBlock(blockLines) {
  const raw = blockLines.join('\n').trim();
  const times = [...raw.matchAll(TIME_RE)].map(match => match[0].replace(/\s+/g, ' ').toUpperCase());
  const withoutTimes = raw.replace(TIME_RE, ' ');
  const jobMatch = withoutTimes.match(/\(([\s\S]*?)\)/);
  const sourceJobName = cleanCalendarText(jobMatch?.[1] || '');
  let beforeJob = jobMatch ? withoutTimes.slice(0, jobMatch.index) : withoutTimes;
  if (beforeJob.includes(')')) beforeJob = beforeJob.slice(beforeJob.lastIndexOf(')') + 1);
  const eventTitle = cleanCalendarText(beforeJob) || sourceJobName || 'Untitled calendar event';

  if (!eventTitle && !sourceJobName) return null;

  return {
    raw,
    eventTitle,
    sourceJobName,
    startTime: times[0] || null,
    endTime: times[1] || null,
  };
}

export function parseCalendarPdfPages(pages, batchId, fileName) {
  const staged = [];
  const errors = [];
  const malformedBlocks = [];
  const duplicateHashes = new Set();
  let rawBlockCount = 0;
  let duplicateSkipped = 0;

  const normalizedPages = (pages || []).map(page => ({
    page: page.page,
    items: normalizePdfItems(page.items),
  }));
  const { month, year, label } = detectCalendarMonthYear(normalizedPages);

  if (!month || !year) {
    errors.push('Calendar PDF parser could not detect month/year from the text layer.');
    return { staged, errors, diagnostics: { parser: 'Buildertrend Calendar PDF text-layer parser', totalRawBlocks: 0, deduplicatedEvents: 0, duplicateSkipped: 0, malformedBlocks: 0, first10Events: [] } };
  }

  const rowRefs = [];
  normalizedPages.forEach(page => {
    findDayMarkerRows(page.items).forEach(row => rowRefs.push({ ...row, page: page.page }));
  });
  const rowsWithDates = assignDatesToRows(rowRefs, month, year);
  const rowsByPage = new Map();
  rowsWithDates.forEach(row => {
    if (!rowsByPage.has(row.page)) rowsByPage.set(row.page, []);
    rowsByPage.get(row.page).push(row);
  });

  let carryRow = null;
  normalizedPages.forEach(page => {
    const rows = (rowsByPage.get(page.page) || []).sort((a, b) => b.y - a.y);
    const segments = [];
    if (carryRow && rows[0]) segments.push({ row: carryRow, top: Infinity, bottom: rows[0].y + 4 });
    rows.forEach((row, index) => {
      segments.push({
        row,
        top: row.y - 5,
        bottom: rows[index + 1] ? rows[index + 1].y + 4 : -Infinity,
      });
    });

    segments.forEach(segment => {
      const cellItems = Array.from({ length: 7 }, () => []);
      page.items.forEach(item => {
        if (item.y > segment.top || item.y <= segment.bottom) return;
        if (/^\d{1,2}$/.test(item.str) && Math.abs(item.y - segment.row.y) <= 6) return;
        const col = getColumnIndex(item, segment.row);
        cellItems[col].push(item);
      });

      cellItems.forEach((items, colIndex) => {
        const eventDate = segment.row.dates?.[colIndex];
        if (!eventDate || items.length === 0) return;
        const lines = groupCellLines(items);
        splitCalendarEventBlocks(lines).forEach(blockLines => {
          rawBlockCount++;
          const parsed = parseCalendarEventBlock(blockLines);
          if (!parsed || !parsed.sourceJobName) {
            malformedBlocks.push(blockLines.join(' | ').slice(0, 250));
            return;
          }

          const duplicateHash = createCalendarDuplicateHash({
            eventTitle: parsed.eventTitle,
            eventDate,
            startTime: parsed.startTime,
            endTime: parsed.endTime,
            sourceJobName: parsed.sourceJobName,
          });
          if (duplicateHashes.has(duplicateHash)) {
            duplicateSkipped++;
            return;
          }
          duplicateHashes.add(duplicateHash);

          const classification = classifyCalendarEvent(parsed.eventTitle, parsed.sourceJobName);
          const warnings = [];
          if (classification.isOffice) warnings.push('Office/internal calendar item - requires review');

          staged.push({
            import_batch_id: batchId,
            source_file_name: fileName,
            source_row: rawBlockCount,
            source_page: page.page,
            raw_source_text: parsed.raw.slice(0, 2000),
            event_date: eventDate,
            event_title: parsed.eventTitle,
            start_time: parsed.startTime,
            end_time: parsed.endTime,
            source_job_name: parsed.sourceJobName,
            normalized_job_name: normalizeJobNameForMatch(parsed.sourceJobName),
            duplicate_hash: duplicateHash,
            event_category: classification.eventCategory,
            is_non_production: classification.isNonProduction,
            is_office_event: classification.isOffice,
            match_status: 'unmatched',
            matched_job_id: null,
            matched_staged_job_id: null,
            warnings: safeJson(warnings),
            errors: safeJson([]),
            review_status: classification.isOffice ? 'needs_review' : 'pending',
          });
        });
      });
    });

    carryRow = rows[rows.length - 1] || carryRow;
  });

  const diagnostics = {
    parser: 'Buildertrend Calendar PDF text-layer parser',
    month: label,
    year,
    totalRawBlocks: rawBlockCount,
    deduplicatedEvents: staged.length,
    duplicateSkipped,
    malformedBlocks: malformedBlocks.length,
    first10Events: staged.slice(0, 10).map(event => `${event.event_date} ${event.start_time || ''}-${event.end_time || ''} ${event.event_title} (${event.source_job_name})`.trim()),
  };

  if (staged.length === 0) {
    errors.push('Calendar PDF parser produced zero staged events from the text layer.');
  }

  return { staged, errors, diagnostics };
}

/**
 * Parse a plain-text Buildertrend schedule/calendar export.
 * Supports both one-line rows and flattened monthly calendar text.
 */
export function parseCalendarText(text, batchId, fileName) {
  const staged = [];
  const errors = [];
  const rawLines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const lines = rawLines.map(l => l.trim()).filter(Boolean);
  const detectedDatePatterns = lines.map(line => extractCalendarDate(line)).filter(Boolean).slice(0, 20);
  const detectedTimePatterns = lines.map(line => extractCalendarTime(line)).filter(Boolean).slice(0, 20);
  const skippedReasons = [];
  const invalidEventSkips = [];
  const malformedBlocks = [];
  const duplicateHashes = new Set();
  let duplicateSkipped = 0;

  const buildDiagnostics = (totalRawBlocks = 0, parser = 'Buildertrend Calendar TXT flattened-block parser') => ({
    parser,
    totalLines: lines.length,
    first20Lines: rawLines.slice(0, 20).map((line, index) => `${index + 1}: ${line}`).join('\n'),
    detectedDatePatterns,
    detectedTimePatterns,
    totalRawBlocks,
    deduplicatedEvents: staged.length,
    duplicateSkipped,
    malformedBlocks: malformedBlocks.length,
    skippedReasons,
    invalidEventSkips,
    first10Events: staged.slice(0, 10).map(event => `${event.event_date || '(date review)'} ${event.start_time || ''}-${event.end_time || ''} ${event.event_title} (${event.source_job_name || 'no job'})`.trim()),
  });

  if (!text || !text.trim()) {
    errors.push('Empty calendar file');
    skippedReasons.push('empty file');
    return { staged, errors, diagnostics: buildDiagnostics() };
  }

  const addStagedEvent = ({
    sourceRow,
    rawSourceText,
    eventDate,
    eventTitle,
    startTime,
    endTime,
    sourceJobName,
  }) => {
    const cleanTitle = cleanCalendarText(eventTitle) || cleanCalendarText(sourceJobName) || 'Untitled calendar event';
    const cleanJobName = cleanCalendarText(sourceJobName);
    const rawText = String(rawSourceText || '').slice(0, 2000);
    const dateTokens = extractCalendarDateTokens(`${cleanTitle}\n${cleanJobName}\n${rawText}`);
    if (!isValidIsoCalendarDate(eventDate)) {
      const reason = eventDate
        ? `Invalid calendar date "${eventDate}"`
        : 'Calendar date could not be inferred from TXT block';
      invalidEventSkips.push({
        sourceRow,
        reason,
        detectedDateTokens: dateTokens,
        rawPreview: rawText.slice(0, 200),
      });
      skippedReasons.push(`Line ${sourceRow}: ${reason}`);
      return;
    }

    const duplicateHash = createCalendarDuplicateHash({
      eventTitle: cleanTitle,
      eventDate,
      startTime,
      endTime,
      sourceJobName: cleanJobName,
    });

    if (duplicateHashes.has(duplicateHash)) {
      duplicateSkipped++;
      return;
    }
    duplicateHashes.add(duplicateHash);

    const classification = classifyCalendarEvent(cleanTitle, cleanJobName);
    const warnings = [];
    if (classification.isOffice) warnings.push('Office/internal calendar item - requires review');
    if (!cleanJobName) warnings.push('Job reference missing from TXT block');
    if (!startTime || !endTime) warnings.push('Calendar time range incomplete');
    const needsReview = classification.isOffice || !cleanJobName || !startTime || !endTime;

    staged.push({
      import_batch_id: batchId,
      source_file_name: fileName,
      source_row: sourceRow,
      raw_source_text: rawText,
      event_date: eventDate,
      event_title: cleanTitle,
      start_time: startTime,
      end_time: endTime,
      source_job_name: cleanJobName,
      normalized_job_name: normalizeJobNameForMatch(cleanJobName),
      duplicate_hash: duplicateHash,
      event_category: classification.eventCategory,
      is_non_production: classification.isNonProduction,
      is_office_event: classification.isOffice,
      match_status: 'unmatched',
      matched_job_id: null,
      matched_staged_job_id: null,
      warnings: safeJson(warnings),
      errors: safeJson([]),
      review_status: needsReview ? 'needs_review' : 'pending',
    });
  };

  if (hasStructuredCalendarText(lines)) {
    const structuredBlocks = splitStructuredCalendarTextBlocks(lines);
    if (structuredBlocks.length > 0) {
      structuredBlocks.forEach((block) => {
        const parsed = parseStructuredCalendarBlock(block);
        addStagedEvent(parsed);
      });

      const diagnostics = buildDiagnostics(
        structuredBlocks.length,
        'Buildertrend Calendar TXT structured-block parser'
      );

      if (staged.length === 0) {
        errors.push([
          'Calendar TXT structured parser produced zero staged events.',
          `Parser used: ${diagnostics.parser}`,
          `Total raw blocks found: ${diagnostics.totalRawBlocks}`,
          `Invalid date skips: ${diagnostics.invalidEventSkips.map(skip => `${skip.reason} [${skip.detectedDateTokens.join(', ') || 'no date tokens'}]`).join(' | ') || '(none)'}`,
        ].join('\n'));
      }

      return { staged, errors, diagnostics };
    }
  }

  const legacy = parseCalendarTextLegacy(text, batchId, fileName);
  legacy.staged.forEach((event) => {
    addStagedEvent({
      sourceRow: event.source_row,
      rawSourceText: event.raw_source_text,
      eventDate: event.event_date,
      eventTitle: event.event_title,
      startTime: event.start_time,
      endTime: event.end_time,
      sourceJobName: event.source_job_name,
    });
  });
  errors.push(...legacy.errors);

  const flattenedBlocks = splitFlattenedCalendarTextBlocks(lines);
  flattenedBlocks.forEach((block) => {
    const eventDate = extractCalendarDate(block.sourceJobName) || extractCalendarDate(block.eventTitle);
    const hasUsefulSignal = block.eventTitle || block.sourceJobName || block.startTime || block.endTime;
    if (!hasUsefulSignal) {
      malformedBlocks.push(block.rawLines.join(' | ').slice(0, 250));
      skippedReasons.push(`Line ${block.sourceRow}: block had no title, job, or time`);
      return;
    }

    addStagedEvent({
      sourceRow: block.sourceRow,
      rawSourceText: block.rawLines.join('\n'),
      eventDate,
      eventTitle: block.eventTitle,
      startTime: block.startTime,
      endTime: block.endTime,
      sourceJobName: block.sourceJobName,
    });
  });

  const diagnostics = buildDiagnostics(flattenedBlocks.length);

  if (staged.length === 0) {
    errors.push([
      'Calendar TXT parser produced zero staged events.',
      `Parser used: ${diagnostics.parser}`,
      `Total lines: ${diagnostics.totalLines}`,
      `Detected date patterns: ${detectedDatePatterns.join(' | ') || '(none)'}`,
      `Detected time patterns: ${detectedTimePatterns.join(' | ') || '(none)'}`,
      `First 20 lines:\n${diagnostics.first20Lines || '(none)'}`,
      `Skipped reasons: ${diagnostics.skippedReasons.join(' | ') || '(none)'}`,
      `Invalid date skips: ${diagnostics.invalidEventSkips.map(skip => `${skip.reason} [${skip.detectedDateTokens.join(', ') || 'no date tokens'}]`).join(' | ') || '(none)'}`,
    ].join('\n'));
  }

  return { staged, errors, diagnostics };
}

/**
 * Parse a plain-text Buildertrend schedule/calendar export.
 * Each line is: "DATE   EVENT TITLE (Job Name)"  or  "DATE TIME-TIME EVENT TITLE"
 */
function parseCalendarTextLegacy(text, batchId, fileName) {
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
      normalized_job_name: normalizeJobNameForMatch(sourceJobName),
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
    if (log.match_status && log.match_status !== 'unmatched') return log;
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
        matched_staged_job_id: match.id || null,
      };
    }
    return ev;
  });
}

export function parseDailyLogText(text, batchId, fileName) {
  const staged = [];
  const errors = [];
  const parserUsed = 'manual Daily Logs text parser';
  const rawLines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const nonEmptyLines = rawLines.map(line => line.trim()).filter(Boolean);
  const detectedDateHeadings = nonEmptyLines.filter(line => parseDateHeading(line));
  const jobLabelCount = nonEmptyLines.filter(line => isLabelLine(line, 'Job:')).length;
  const first40Lines = rawLines.slice(0, 40).map((line, index) => `${index + 1}: ${line}`).join('\n');

  const buildDiagnostics = () => ({
    parser: parserUsed,
    totalBlocks: 0,
    stagedCount: staged.length,
    matchedCount: 0,
    unmatchedCount: staged.length,
    attachmentReviewCount: staged.filter(log => log.needs_attachment_review).length,
    first5Jobs: staged.slice(0, 5).map(log => log.source_job_name || '(no job name)'),
    first3UnmatchedJobs: staged.slice(0, 3).map(log => log.source_job_name || '(no job name)'),
    detectedDateHeadings,
    jobLabelCount,
    first40Lines,
  });

  if (!text || !text.trim()) {
    errors.push('Empty daily log file');
    return { staged, errors, diagnostics: buildDiagnostics() };
  }

  const starts = [];
  for (let i = 0; i < nonEmptyLines.length; i++) {
    if (!parseDateHeading(nonEmptyLines[i])) continue;
    const nextIndex = nextNonEmptyIndex(nonEmptyLines, i + 1);
    if (nextIndex >= 0 && isLabelLine(nonEmptyLines[nextIndex], 'Job:')) {
      starts.push(i);
    }
  }

  if (starts.length === 0) {
    const legacy = parseDailyLogTextLegacy(text, batchId, fileName);
    if (legacy.staged.length > 0) {
      return {
        ...legacy,
        diagnostics: {
          ...buildDiagnostics(),
          parser: `${parserUsed} fallback legacy label parser`,
          totalBlocks: legacy.staged.length,
          stagedCount: legacy.staged.length,
          unmatchedCount: legacy.staged.length,
          first5Jobs: legacy.staged.slice(0, 5).map(log => log.source_job_name || '(no job name)'),
          first3UnmatchedJobs: legacy.staged.slice(0, 3).map(log => log.source_job_name || '(no job name)'),
        },
      };
    }
  }

  const blocks = starts.map((start, index) => ({
    sourceRow: index + 1,
    lines: nonEmptyLines.slice(start, starts[index + 1] ?? nonEmptyLines.length),
  }));

  const getValueAfterLabel = (lines, label) => {
    const index = lines.findIndex(line => isLabelLine(line, label));
    if (index < 0) return '';
    const valueIndex = nextNonEmptyIndex(lines, index + 1);
    return valueIndex >= 0 ? lines[valueIndex] : '';
  };

  const collectAfterLabel = (lines, label, stopLabels) => {
    const index = lines.findIndex(line => isLabelLine(line, label));
    if (index < 0) return '';
    const collected = [];
    for (let i = index + 1; i < lines.length; i++) {
      if (stopLabels.some(stop => isLabelLine(lines[i], stop))) break;
      collected.push(lines[i]);
    }
    return collected.join('\n').trim();
  };

  blocks.forEach((block) => {
    const lines = block.lines;
    const logDate = parseDateHeading(lines[0]);
    const jobName = getValueAfterLabel(lines, 'Job:');
    const title = getValueAfterLabel(lines, 'Title:');
    const addedBy = getValueAfterLabel(lines, 'Added By:');
    const logNotes = collectAfterLabel(lines, 'Log Notes:', ['Weather Conditions:', 'Attachments:']);
    const weatherSummary = getValueAfterLabel(lines, 'Weather Conditions:');
    const weatherTimestamp = lines.find(line => /^[a-z]{3},\s+[a-z]{3}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s+[ap]m$/i.test(line)) || null;
    const temps = lines
      .map(line => line.match(/(-?\d+(?:\.\d+)?)\s*°?\s*f\b/i))
      .filter(Boolean)
      .map(match => Number(match[1]));
    const tempHigh = temps[0] ?? null;
    const tempLow = temps[1] ?? null;
    const wind = (lines.find(line => /^wind:/i.test(line)) || '').replace(/^wind:\s*/i, '').trim() || null;
    const humidity = (lines.find(line => /^humidity:/i.test(line)) || '').replace(/^humidity:\s*/i, '').trim() || null;
    const precipitation = (lines.find(line => /^total precip:/i.test(line)) || '').replace(/^total precip:\s*/i, '').trim() || null;
    const attachmentCount = Number.parseInt(getValueAfterLabel(lines, 'Attachments:'), 10) || 0;

    if (!logDate) {
      errors.push(`Block ${block.sourceRow}: missing date - skipped`);
      return;
    }

    staged.push({
      import_batch_id: batchId,
      source_file_name: fileName,
      source_row: block.sourceRow,
      raw_source_text: lines.join('\n').slice(0, 2000),
      log_date: logDate,
      source_job_name: jobName || '',
      normalized_job_name: normalizeJobNameForMatch(jobName || ''),
      title: title || null,
      added_by: addedBy || null,
      log_notes: logNotes || null,
      weather_summary: weatherSummary || null,
      weather_timestamp: weatherTimestamp,
      temp_high: tempHigh,
      temp_low: tempLow,
      wind,
      humidity,
      precipitation,
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

  const diagnostics = {
    ...buildDiagnostics(),
    totalBlocks: blocks.length,
  };

  if (staged.length === 0) {
    errors.push([
      'Daily Logs parse produced zero logs.',
      `parser used: ${parserUsed}`,
      `detected date headings: ${detectedDateHeadings.join(' | ') || '(none)'}`,
      `detected Job: labels count: ${jobLabelCount}`,
      'first 40 lines:',
      first40Lines || '(empty)',
    ].join('\n'));
  }

  return { staged, errors, diagnostics };
}
