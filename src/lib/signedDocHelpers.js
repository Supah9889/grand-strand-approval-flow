/**
 * Shared helpers for determining signed state and the best document URL.
 * Used across JobSearch, JobNextStep, JobSignatureTab, etc.
 */
import { isStampUploadedPdfMode } from '@/lib/signatureDocumentModes';

export const JOB_PRIMARY_ACTIONS = Object.freeze({
  UPLOAD_WORK_ORDER: 'upload_work_order',
  WAITING_ON_WORK_ORDER: 'waiting_on_work_order',
  SEND_FOR_SIGNATURE: 'send_for_signature',
  VIEW_SIGNED_DOCUMENT: 'view_signed_document',
  SIGNED_DOCUMENT_MISSING: 'signed_document_missing',
});

export function canUploadWorkOrder(role) {
  return role === 'admin' || role === 'owner';
}

/**
 * Returns true if the job is considered fully signed/approved.
 */
export function isJobSigned(job) {
  return job.status === 'approved' || job.status === 'locked';
}

export function keyFromR2Ref(value) {
  return typeof value === 'string' && value.startsWith('r2://') ? value.slice(5) : '';
}

export function isBrowserUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

export function hasSourceWorkOrder(job) {
  return Boolean(
    job?.source_work_order_file_url ||
    job?.source_work_order_r2_key ||
    keyFromR2Ref(job?.source_work_order_file_url)
  );
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
  if (isBrowserUrl(primary?.signed_output_file_url)) return primary.signed_output_file_url;
  if (isBrowserUrl(primary?.output_file_url)) return primary.output_file_url;

  const anySigned = records.find(r => r.status === 'signed');
  if (isBrowserUrl(anySigned?.signed_output_file_url)) return anySigned.signed_output_file_url;
  if (isBrowserUrl(anySigned?.output_file_url)) return anySigned.output_file_url;

  return isBrowserUrl(job.signed_output_file_url) ? job.signed_output_file_url : null;
}

export function getBestSignedDocR2Key(job, records = []) {
  const primary = records.find(r => r.status === 'signed' && r.is_primary);
  if (primary?.signed_output_r2_key) return primary.signed_output_r2_key;
  if (primary?.output_file_r2_key) return primary.output_file_r2_key;
  if (keyFromR2Ref(primary?.signed_output_file_url)) return keyFromR2Ref(primary.signed_output_file_url);
  if (keyFromR2Ref(primary?.output_file_url)) return keyFromR2Ref(primary.output_file_url);

  const anySigned = records.find(r => r.status === 'signed');
  if (anySigned?.signed_output_r2_key) return anySigned.signed_output_r2_key;
  if (anySigned?.output_file_r2_key) return anySigned.output_file_r2_key;
  if (keyFromR2Ref(anySigned?.signed_output_file_url)) return keyFromR2Ref(anySigned.signed_output_file_url);
  if (keyFromR2Ref(anySigned?.output_file_url)) return keyFromR2Ref(anySigned.output_file_url);

  return job.signed_output_r2_key || keyFromR2Ref(job.signed_output_file_url) || null;
}

/**
 * Build the previewDoc object for DocumentPreviewModal.
 */
export function buildSignedDocPreview(job) {
  const url = getBestSignedDocUrl(job);
  const r2Key = url ? null : getBestSignedDocR2Key(job);
  if (!url && !r2Key) return null;

  const preview = {
    title: job.source_work_order_file_name
      ? `Signed: ${job.source_work_order_file_name}`
      : 'Signed Work Order (Final)',
    docType: 'Signed Work Order (Final)',
  };

  if (url) {
    return {
      ...preview,
      url,
      isR2Backed: false,
    };
  }

  return {
    ...preview,
    r2Key,
    isR2Backed: true,
  };
}

/**
 * Returns the single primary action a non-technical user should see for a job.
 */
export function getJobPrimaryAction(job, records = [], options = {}) {
  const signedDocUrl = getBestSignedDocUrl(job, records);
  const signedDocR2Key = getBestSignedDocR2Key(job, records);
  const canUpload = options.canUploadWorkOrder ?? true;

  if (isJobSigned(job)) {
    if (signedDocUrl || signedDocR2Key) {
      return {
        type: JOB_PRIMARY_ACTIONS.VIEW_SIGNED_DOCUMENT,
        label: 'View Signed Document',
        url: signedDocUrl,
        r2Key: signedDocR2Key,
      };
    }
    return {
      type: JOB_PRIMARY_ACTIONS.SIGNED_DOCUMENT_MISSING,
      label: 'View Signed Document',
      disabled: true,
    };
  }

  if (isStampUploadedPdfMode(job.signature_document_mode) && !hasSourceWorkOrder(job)) {
    if (!canUpload) {
      return {
        type: JOB_PRIMARY_ACTIONS.WAITING_ON_WORK_ORDER,
        label: 'Waiting on office to upload work order',
        helperText: 'Ask an admin to upload the work order.',
        disabled: true,
      };
    }
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
