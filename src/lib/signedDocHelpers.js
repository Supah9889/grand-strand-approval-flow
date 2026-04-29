/**
 * Shared helpers for determining signed state and the best document URL.
 * Used across JobSearch, JobNextStep, JobSignatureTab, etc.
 */
import { isStampUploadedPdfMode } from '@/lib/signatureDocumentModes';

export const JOB_PRIMARY_ACTIONS = Object.freeze({
  UPLOAD_WORK_ORDER: 'upload_work_order',
  SEND_FOR_SIGNATURE: 'send_for_signature',
  VIEW_SIGNED_DOCUMENT: 'view_signed_document',
  SIGNED_DOCUMENT_MISSING: 'signed_document_missing',
});

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

/**
 * Returns the single primary action a non-technical user should see for a job.
 */
export function getJobPrimaryAction(job, records = []) {
  const signedDocUrl = getBestSignedDocUrl(job, records);

  if (isJobSigned(job)) {
    if (signedDocUrl) {
      return {
        type: JOB_PRIMARY_ACTIONS.VIEW_SIGNED_DOCUMENT,
        label: 'View Signed Document',
        url: signedDocUrl,
      };
    }
    return {
      type: JOB_PRIMARY_ACTIONS.SIGNED_DOCUMENT_MISSING,
      label: 'View Signed Document',
      disabled: true,
    };
  }

  if (isStampUploadedPdfMode(job.signature_document_mode) && !job.source_work_order_file_url) {
    return {
      type: JOB_PRIMARY_ACTIONS.UPLOAD_WORK_ORDER,
      label: 'Upload Work Order',
    };
  }

  return {
    type: JOB_PRIMARY_ACTIONS.SEND_FOR_SIGNATURE,
    label: 'Send for Signature',
  };
}
