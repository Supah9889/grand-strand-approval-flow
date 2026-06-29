import { base44 } from '@/api/base44Client';
import { assertCompanyScopedRecord } from '@/lib/companyOwnership';

const DEFAULT_JOB_LIMIT = 300;
const DEFAULT_CHILD_LIMIT = 200;

export function getScopedJobIds(jobs = []) {
  return jobs.map(job => job?.id).filter(Boolean);
}

export async function fetchCompanyJobs(companyId, order = '-created_date', limit = DEFAULT_JOB_LIMIT) {
  if (!companyId) return [];
  return base44.entities.Job.filter({ company_id: companyId }, order, limit);
}

export async function fetchCompanyRecords(entity, companyId, order = '-created_date', limit = DEFAULT_CHILD_LIMIT) {
  if (!companyId || !entity?.filter) return [];
  return entity.filter({ company_id: companyId }, order, limit);
}

/**
 * For child records that only carry job_id, fetch by each active-company job.
 * This avoids broad entity.list() calls for operational and financial records.
 */
export async function fetchJobScopedRecords(entity, jobs = [], {
  order = '-created_date',
  limitPerJob = DEFAULT_CHILD_LIMIT,
  jobField = 'job_id',
} = {}) {
  if (!entity?.filter) return [];
  const jobIds = getScopedJobIds(jobs);
  if (!jobIds.length) return [];

  const batches = await Promise.all(
    jobIds.map(jobId => entity.filter({ [jobField]: jobId }, order, limitPerJob).catch(() => [])),
  );
  return batches.flat();
}

export function filterRecordsByScopedJobs(records = [], jobs = [], jobFields = ['job_id', 'linked_job_id']) {
  const jobIds = new Set(getScopedJobIds(jobs));
  if (!jobIds.size) return [];
  return records.filter(record =>
    jobFields.some(field => record?.[field] && jobIds.has(record[field])),
  );
}

export async function fetchScopedRecordById(entity, id, companyId, {
  jobs = [],
  order = '-created_date',
  limit = 1,
} = {}) {
  if (!entity?.filter || !id || !companyId) return null;
  const records = await entity.filter({ id }, order, limit).catch(() => []);
  return assertCompanyScopedRecord(records?.[0], companyId, { jobs });
}
