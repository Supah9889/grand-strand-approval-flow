/**
 * duplicateDetection — client-side heuristic duplicate checker for expenses.
 * Returns an array of match objects sorted by confidence (high → low).
 *
 * Each match: { expense, confidence: 'high'|'medium'|'low', reasons: string[] }
 */

function normalize(str) {
  if (!str) return '';
  return String(str).toLowerCase().trim().replace(/\s+/g, ' ');
}

function amountsClose(a, b, tolerance = 0.02) {
  const fa = parseFloat(a) || 0;
  const fb = parseFloat(b) || 0;
  if (fa === 0 && fb === 0) return false;
  return Math.abs(fa - fb) <= tolerance;
}

function sameDate(a, b) {
  if (!a || !b) return false;
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

function vendorSimilar(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Check if one contains the other
  return na.includes(nb) || nb.includes(na);
}

export function detectDuplicates(newExpense, existingExpenses) {
  const matches = [];

  for (const existing of existingExpenses) {
    // Skip archived/trashed records
    if (existing.inbox_status === 'archived') continue;
    // Skip itself if editing
    if (existing.id && existing.id === newExpense.id) continue;

    const reasons = [];
    let score = 0;

    const sameVendor = vendorSimilar(newExpense.vendor_name, existing.vendor_name);
    const sameAmt    = amountsClose(newExpense.total_amount, existing.total_amount);
    const sameDay    = sameDate(
      newExpense.expense_date || newExpense.receipt_date,
      existing.expense_date  || existing.receipt_date
    );
    const sameRcptNum = newExpense.receipt_number && existing.receipt_number &&
      normalize(newExpense.receipt_number) === normalize(existing.receipt_number);
    const sameFile    = newExpense.file_name && existing.file_name &&
      normalize(newExpense.file_name) === normalize(existing.file_name);
    const sameJob     = newExpense.job_id && existing.job_id &&
      newExpense.job_id === existing.job_id;

    // ── Scoring ──────────────────────────────────────────────────────────────
    // Same file name → almost certainly a duplicate
    if (sameFile) {
      score += 40;
      reasons.push('same file');
    }

    // Same receipt number + same vendor → very strong
    if (sameRcptNum && sameVendor) {
      score += 30;
      reasons.push('same receipt #');
    } else if (sameRcptNum) {
      score += 15;
      reasons.push('same receipt #');
    }

    // Same vendor + same date + same amount → strong
    if (sameVendor && sameDay && sameAmt) {
      score += 25;
      reasons.push('same vendor, date & amount');
    } else {
      if (sameVendor) { score += 8; reasons.push('same vendor'); }
      if (sameDay)    { score += 8; reasons.push('same date'); }
      if (sameAmt)    { score += 8; reasons.push('same amount'); }
    }

    if (sameJob && (sameAmt || sameDay)) {
      score += 5;
      reasons.push('same job');
    }

    // Only report if score meets minimum threshold
    if (score < 16 || reasons.length === 0) continue;

    let confidence;
    if (score >= 35) confidence = 'high';
    else if (score >= 22) confidence = 'medium';
    else confidence = 'low';

    matches.push({ expense: existing, confidence, score, reasons });
  }

  // Sort by score descending, cap at 3
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}