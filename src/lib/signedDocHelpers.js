/**
 * Shared helpers for determining signed state and the best document URL.
 * Used across JobSearch, JobNextStep, JobSignatureTab, etc.
 */

/**
 * Returns true if the job is considered fully signed/approved.
 */
export function isJobSigned(job) {
  return job.status === 'approved' || job.status === 'locked';
}

/**
 * Given a job and an optional array of its SignatureRecords,
 * returns the best URL for the signed document.
 *
 * Priority:
 *  1. Primary SignatureRecord.signed_output_file_url
 *  2. Primary SignatureRecord.output_file_url
 *  3. Any SignatureRecord.signed_output_file_url (signed status)
 *  4. Any SignatureRecord.output_file_url (signed status)
 *  5. job.signed_output_file_url
 */
export function getBestSignedDocUrl(job, records = []) {
  const primary = records.find(r => r.status === 'signed' && r.is_primary);
  if (primary?.signed_output_file_url) return primary.signed_output_file_url;
  if (primary?.output_file_url) return primary.output_file_url;

  const anySigned = records.find(r => r.status === 'signed');
  if (anySigned?.signed_output_file_url) return anySigned.signed_output_file_url;
  if (anySigned?.output_file_url) return anySigned.output_file_url;

  return job.signed_output_file_url || null;
}

/**
 * Build the previewDoc object for DocumentPreviewModal.
 */
export function buildSignedDocPreview(job) {
  const url = getBestSignedDocUrl(job);
  if (!url) return null;
  return {
    url,
    title: job.source_work_order_file_name
      ? `Signed: ${job.source_work_order_file_name}`
      : 'Signed Work Order (Final)',
    docType: 'Signed Work Order (Final)',
  };
}