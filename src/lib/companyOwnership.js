export const UNASSIGNED_COMPANY_ID = 'GLOBAL_ADMIN_UNASSIGNED';

const COMPANY_FIELDS = [
  'company_id',
  'origin_company_id',
  'assigned_company_id',
  'performing_company_id',
];

const JOB_FIELDS = ['job_id', 'linked_job_id', 'current_job_id'];

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeCompanyName(value) {
  return clean(value).toLowerCase().replace(/\s+/g, ' ');
}

export function buildCompanyNameMap(companies = []) {
  const map = new Map();
  companies.forEach((company) => {
    const id = company?.id || company?.company_id;
    if (!id) return;
    [
      company.name,
      company.company_name,
      company.display_name,
      company.slug,
    ].forEach((name) => {
      const normalized = normalizeCompanyName(name);
      if (normalized) map.set(normalized, id);
    });
  });
  return map;
}

export function getRecordCompanyIds(record) {
  if (!record) return [];
  return COMPANY_FIELDS.map((field) => clean(record[field])).filter(Boolean);
}

export function getRecordJobIds(record) {
  if (!record) return [];
  return JOB_FIELDS.map((field) => clean(record[field])).filter(Boolean);
}

export function createJobMap(jobs = []) {
  return new Map(jobs.filter((job) => job?.id).map((job) => [job.id, job]));
}

export function getJobCompanyId(job) {
  return getRecordCompanyIds(job)[0] || '';
}

export function recordBelongsToCompany(record, companyId, { jobs = [], jobsById = null } = {}) {
  const activeCompanyId = clean(companyId);
  if (!record || !activeCompanyId) return false;

  if (getRecordCompanyIds(record).includes(activeCompanyId)) return true;

  const jobMap = jobsById || createJobMap(jobs);
  return getRecordJobIds(record).some((jobId) => {
    const job = jobMap instanceof Map ? jobMap.get(jobId) : jobMap?.[jobId];
    return getJobCompanyId(job) === activeCompanyId;
  });
}

export function filterRecordsForCompany(records = [], companyId, options = {}) {
  return records.filter((record) => recordBelongsToCompany(record, companyId, options));
}

export function assertCompanyScopedRecord(record, companyId, options = {}) {
  return recordBelongsToCompany(record, companyId, options) ? record : null;
}

function firstCompanyIdFromRecords(records = [], jobMap) {
  for (const record of records) {
    const directCompanyId = getRecordCompanyIds(record)[0];
    if (directCompanyId) return directCompanyId;
    const jobId = clean(record?.job_id || record?.linked_job_id);
    const job = jobMap.get(jobId);
    const jobCompanyId = getJobCompanyId(job);
    if (jobCompanyId) return jobCompanyId;
  }
  return '';
}

function matchesVendor(vendor, record) {
  const vendorId = clean(vendor?.id);
  const vendorName = normalizeCompanyName(vendor?.company_name || vendor?.display_name);
  return (vendorId && clean(record?.vendor_id) === vendorId)
    || (vendorName && normalizeCompanyName(record?.vendor_name || record?.company_name) === vendorName);
}

export function inferVendorCompanyId(vendor, context = {}) {
  const existingCompanyId = getRecordCompanyIds(vendor)[0];
  if (existingCompanyId) return existingCompanyId;

  const jobMap = context.jobsById || createJobMap(context.jobs || []);
  const relatedRecords = [
    ...(context.bills || []),
    ...(context.purchaseOrders || []),
    ...(context.invoices || []),
    ...(context.expenses || []),
  ].filter((record) => matchesVendor(vendor, record));

  return firstCompanyIdFromRecords(relatedRecords, jobMap) || UNASSIGNED_COMPANY_ID;
}

export function inferLeadCompanyId(lead, context = {}) {
  const existingCompanyId = getRecordCompanyIds(lead)[0];
  if (existingCompanyId) return existingCompanyId;

  const jobMap = context.jobsById || createJobMap(context.jobs || []);
  const linkedJob = jobMap.get(clean(lead?.linked_job_id));
  const linkedJobCompanyId = getJobCompanyId(linkedJob);
  if (linkedJobCompanyId) return linkedJobCompanyId;

  const companyNameMap = context.companyNameMap || buildCompanyNameMap(context.companies || []);
  return companyNameMap.get(normalizeCompanyName(lead?.company_name)) || UNASSIGNED_COMPANY_ID;
}

export function inferEstimateCompanyId(estimate, context = {}) {
  const existingCompanyId = getRecordCompanyIds(estimate)[0];
  if (existingCompanyId) return existingCompanyId;

  const jobMap = context.jobsById || createJobMap(context.jobs || []);
  const linkedJob = jobMap.get(clean(estimate?.linked_job_id || estimate?.job_id));
  const linkedJobCompanyId = getJobCompanyId(linkedJob);
  if (linkedJobCompanyId) return linkedJobCompanyId;

  const leadsById = context.leadsById || new Map((context.leads || []).filter((lead) => lead?.id).map((lead) => [lead.id, lead]));
  const linkedLead = leadsById instanceof Map
    ? leadsById.get(clean(estimate?.linked_lead_id))
    : leadsById?.[clean(estimate?.linked_lead_id)];
  const linkedLeadCompanyId = getRecordCompanyIds(linkedLead)[0];
  if (linkedLeadCompanyId) return linkedLeadCompanyId;

  const companyNameMap = context.companyNameMap || buildCompanyNameMap(context.companies || []);
  return companyNameMap.get(normalizeCompanyName(estimate?.company_name)) || UNASSIGNED_COMPANY_ID;
}

export function buildBackfillPatch(record, companyId) {
  if (!record?.id || getRecordCompanyIds(record).length > 0) return null;
  const resolvedCompanyId = clean(companyId) || UNASSIGNED_COMPANY_ID;
  return { id: record.id, updates: { company_id: resolvedCompanyId } };
}
