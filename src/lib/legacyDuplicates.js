/**
 * legacyDuplicates.js
 * Helpers for detecting potential duplicate LegacyJobRecords before conversion.
 * Does NOT auto-merge — returns candidates only.
 */

function normalize(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function similarity(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Simple contains check
  if (na.includes(nb) || nb.includes(na)) return 0.8;
  // Word overlap
  const wordsA = na.split(/\s+/);
  const wordsB = nb.split(/\s+/);
  const overlap = wordsA.filter(w => w.length > 2 && wordsB.includes(w));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? overlap.length / union.size : 0;
}

/**
 * Find potential duplicates for a given record within a list of records.
 * Returns array of { record, score, reasons } sorted by score descending.
 */
export function findDuplicateCandidates(target, allRecords) {
  const candidates = [];

  for (const rec of allRecords) {
    if (rec.id === target.id) continue;
    if (rec.migration_status === 'archived') continue;

    const reasons = [];
    let score = 0;

    const customerSim = similarity(target.customer_name, rec.customer_name);
    const addressSim = similarity(target.property_address, rec.property_address);
    const jobSim = similarity(target.job_name, rec.job_name);

    if (customerSim >= 0.8) { reasons.push('Same customer name'); score += 40; }
    else if (customerSim >= 0.5) { reasons.push('Similar customer name'); score += 20; }

    if (addressSim >= 0.8) { reasons.push('Same property address'); score += 40; }
    else if (addressSim >= 0.5) { reasons.push('Similar property address'); score += 20; }

    if (jobSim >= 0.8) { reasons.push('Same job name'); score += 20; }
    else if (jobSim >= 0.5) { reasons.push('Similar job name'); score += 10; }

    // Same legacy_id
    if (target.legacy_id && rec.legacy_id && normalize(target.legacy_id) === normalize(rec.legacy_id)) {
      reasons.push('Same legacy ID'); score += 60;
    }

    if (score >= 40) {
      candidates.push({ record: rec, score, reasons });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Quick boolean — does this record have any high-confidence duplicate candidates?
 */
export function hasDuplicates(target, allRecords) {
  return findDuplicateCandidates(target, allRecords).some(c => c.score >= 60);
}