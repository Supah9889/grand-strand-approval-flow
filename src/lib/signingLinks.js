import { base44 } from '@/api/base44Client';

export function buildApprovalPath(jobId, signingToken = '') {
  const basePath = `/approve?jobId=${encodeURIComponent(jobId)}`;
  return signingToken ? `${basePath}&token=${encodeURIComponent(signingToken)}` : basePath;
}

export async function ensureSignaturePublicToken(job) {
  const response = await base44.functions.invoke('requestSignatureAccessGrant', {
    jobId: job.id,
  });
  const data = response?.data || response;
  if (!data?.token) {
    throw new Error('Could not create a secure signing link.');
  }
  return data.token;
}
