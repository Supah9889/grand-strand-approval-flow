export function resolvePortalTokenAccess(token, grants = [], nowMs = Date.now()) {
  if (!token) return { ok: false, reason: 'missing_token' };
  const grant = grants.find((record) =>
    (record?.access_token === token || record?.token === token || record?.invite_token === token) && record.active !== false
  );
  if (!grant) return { ok: false, reason: 'invalid_token' };
  if (grant.access_status && grant.access_status !== 'active') return { ok: false, reason: 'inactive' };
  const expiresAt = grant.expires_at || grant.expiresAt;
  if (expiresAt && new Date(expiresAt).getTime() <= nowMs) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, grant };
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseJsonList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safePortalUser(record) {
  return {
    id: record.id || '',
    name: record.name || '',
    email: record.email || '',
    portal_type: record.portal_type || '',
    access_status: record.access_status || '',
    job_id: record.job_id || '',
    job_address: record.job_address || '',
    linked_vendor_id: record.linked_vendor_id || '',
    section_permissions: record.section_permissions || '',
  };
}

function safeJob(job) {
  return {
    id: job.id,
    company_id: job.company_id || '',
    origin_company_id: job.origin_company_id || '',
    assigned_company_id: job.assigned_company_id || '',
    performing_company_id: job.performing_company_id || '',
    address: job.address || '',
    title: job.title || '',
    customer_name: job.customer_name || '',
    customer_email: job.customer_email || '',
    customer_phone: job.customer_phone || '',
    description: job.description || '',
    lifecycle_status: job.lifecycle_status || '',
    status: job.status || '',
    start_date: job.start_date || '',
    end_date: job.end_date || '',
    approval_timestamp: job.approval_timestamp || '',
  };
}

function jobCompanyIds(job) {
  return [
    job?.company_id,
    job?.origin_company_id,
    job?.assigned_company_id,
    job?.performing_company_id,
  ].filter(Boolean);
}

export function extractPortalToken(input = {}) {
  if (typeof input === 'string') return clean(input);
  return clean(input.token || input.access_token || input.accessToken || input.invite_token || input.inviteToken);
}

export function getPortalAllowedJobIds(portalUser) {
  return [...new Set([
    clean(portalUser?.job_id),
    ...parseJsonList(portalUser?.linked_job_ids).map(clean),
  ].filter(Boolean))];
}

export function buildPortalGrantContext(portalUser, jobs = [], {
  allowedPortalTypes = [],
  nowMs = Date.now(),
} = {}) {
  if (!portalUser) return { ok: false, reason: 'invalid_token' };
  if (portalUser.active === false) return { ok: false, reason: 'inactive' };
  if (portalUser.access_status !== 'active') return { ok: false, reason: 'inactive' };
  if (allowedPortalTypes.length && !allowedPortalTypes.includes(portalUser.portal_type)) {
    return { ok: false, reason: 'wrong_portal_type' };
  }

  const expiresAt = portalUser.expires_at || portalUser.expiresAt || portalUser.expiration_date || portalUser.access_expires_at;
  if (expiresAt && new Date(expiresAt).getTime() <= nowMs) return { ok: false, reason: 'expired' };

  const allowedJobIds = getPortalAllowedJobIds(portalUser);
  if (!allowedJobIds.length) return { ok: false, reason: 'no_jobs' };

  const jobMap = new Map(jobs.filter((job) => allowedJobIds.includes(job?.id)).map((job) => [job.id, safeJob(job)]));
  const resolvedJobs = allowedJobIds.map((jobId) => jobMap.get(jobId)).filter(Boolean);
  if (!resolvedJobs.length) return { ok: false, reason: 'no_jobs' };

  const companyIds = [...new Set(resolvedJobs.flatMap(jobCompanyIds))];
  if (!companyIds.length) return { ok: false, reason: 'no_company' };

  return {
    ok: true,
    context: {
      portalUser: safePortalUser(portalUser),
      allowedJobIds: resolvedJobs.map((job) => job.id),
      companyIds,
      jobs: resolvedJobs,
    },
  };
}
