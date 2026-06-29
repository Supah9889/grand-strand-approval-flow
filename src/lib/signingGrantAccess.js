export function getSigningGrantJobCompanyIds(job) {
  return [
    job?.company_id,
    job?.origin_company_id,
    job?.assigned_company_id,
    job?.performing_company_id,
  ].filter(Boolean);
}

export function validateSigningGrantPayload(payload, job, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!payload || !job) return { ok: false, reason: 'missing_context' };
  if (!payload.jobId || payload.jobId !== job.id) return { ok: false, reason: 'job_mismatch' };
  if (payload.scope && payload.scope !== 'job-signature') return { ok: false, reason: 'invalid_scope' };
  if (!payload.exp || Number(payload.exp) < nowSeconds) return { ok: false, reason: 'expired' };

  const companyIds = getSigningGrantJobCompanyIds(job);
  if (payload.companyId && companyIds.length && !companyIds.includes(payload.companyId)) {
    return { ok: false, reason: 'company_mismatch' };
  }

  return {
    ok: true,
    context: {
      job,
      customer: {
        name: job.customer_name || '',
        email: job.customer_email || job.email || '',
        phone: job.customer_phone || job.phone || '',
      },
      signingPurpose: 'job-signature',
      companyId: companyIds[0] || payload.companyId || '',
      expiresAt: new Date(Number(payload.exp) * 1000).toISOString(),
      canSign: !(job.locked || job.status === 'approved'),
    },
  };
}
