import { base44 } from '@/api/base44Client';
import { TERMS_VERSION, buildApprovalStatement } from '@/lib/terms';

export const SIGNATURE_STATUSES = ['draft', 'sent', 'viewed', 'signed', 'declined', 'replaced', 'archived'];
export const SIGNER_ROLES = [
  'homeowner',
  'tenant',
  'builder_rep',
  'customer',
  'internal_approver',
  'vendor_sub',
  'office_admin',
  'general',
];

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function validIso(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function normalizeSignatureRecordPayload(input = {}) {
  const title = cleanString(input.title);
  const status = pickEnum(input.status, SIGNATURE_STATUSES, 'draft');
  const signedDate = status === 'signed'
    ? validIso(input.signed_date) || new Date().toISOString()
    : validIso(input.signed_date);

  const payload = {
    job_id: cleanString(input.job_id),
    title,
    status,
    signer_role: pickEnum(input.signer_role, SIGNER_ROLES, 'customer'),
    is_primary: Boolean(input.is_primary),
    linked_job_approval: Boolean(input.linked_job_approval),
  };

  [
    'job_address',
    'description',
    'signer_name',
    'signer_email',
    'signed_date',
    'signature_url',
    'output_file_url',
    'output_file_name',
    'terms_version',
    'approval_statement',
    'created_by_name',
    'notes',
  ].forEach((field) => {
    const value = field === 'signed_date' ? signedDate : cleanString(input[field]);
    if (value) payload[field] = value;
  });

  if (typeof input.signed_price === 'number' && Number.isFinite(input.signed_price)) {
    payload.signed_price = input.signed_price;
  }

  return payload;
}

export function validateSignatureRecordPayload(payload) {
  const errors = [];
  if (!payload.job_id) errors.push('Job is required.');
  if (!payload.title) errors.push('Title is required.');
  if (!SIGNATURE_STATUSES.includes(payload.status)) errors.push('Status is invalid.');
  if (!SIGNER_ROLES.includes(payload.signer_role)) errors.push('Signer role is invalid.');
  if (payload.status === 'signed' && !payload.signed_date) errors.push('Signed records require a signed date.');
  return errors;
}

export function buildJobApprovalRecordPayload({ job, signatureUrl, signedAt, actorName = 'Customer' }) {
  const approvalStatement = buildApprovalStatement(job.customer_name, job.address, job.price);

  return normalizeSignatureRecordPayload({
    job_id: job.id,
    job_address: job.address,
    title: 'Work Authorization',
    description: job.description,
    signer_name: job.customer_name,
    signer_email: job.customer_email || job.email,
    signer_role: 'customer',
    status: 'signed',
    signed_date: signedAt,
    signature_url: signatureUrl,
    output_file_url: signatureUrl,
    output_file_name: 'Customer signature',
    terms_version: TERMS_VERSION,
    approval_statement: approvalStatement,
    signed_price: Number(job.price),
    is_primary: true,
    linked_job_approval: true,
    created_by_name: actorName,
  });
}

export async function upsertPrimaryJobApprovalRecord({ job, signatureUrl, signedAt, actorName = 'Customer' }) {
  const payload = buildJobApprovalRecordPayload({ job, signatureUrl, signedAt, actorName });
  const errors = validateSignatureRecordPayload(payload);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  const existing = await base44.entities.SignatureRecord.filter({ job_id: job.id });
  const primary = existing.find(record => record.linked_job_approval || record.is_primary);

  if (primary?.id) {
    await base44.entities.SignatureRecord.update(primary.id, payload);
    return { ...primary, ...payload };
  }

  return base44.entities.SignatureRecord.create(payload);
}
