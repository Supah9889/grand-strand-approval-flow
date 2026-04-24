/**
 * Default client portal section visibility.
 * All sections are ON by default.
 */
export const DEFAULT_SECTIONS = {
  job_summary:      true,
  schedule:         true,
  documents:        true,
  photos:           true,
  invoices:         true,
  estimates:        true,
  change_orders:    true,
  warranty:         true,
  messages:         true,
};

export const SECTION_LABELS = {
  job_summary:   'Job Summary',
  schedule:      'Schedule',
  documents:     'Documents',
  photos:        'Photos / Progress',
  invoices:      'Invoices',
  estimates:     'Estimates',
  change_orders: 'Change Orders / Requests',
  warranty:      'Warranty Claims',
  messages:      'Messages',
};

/**
 * Parse stored section_permissions JSON, filling in defaults for missing keys.
 */
export function parseSections(raw) {
  let stored = {};
  try { stored = JSON.parse(raw || '{}'); } catch {}
  return { ...DEFAULT_SECTIONS, ...stored };
}