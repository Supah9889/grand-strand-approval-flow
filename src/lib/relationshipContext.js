const COMPANY_FIELDS = ['company_id', 'origin_company_id', 'assigned_company_id', 'performing_company_id'];
const JOB_FIELDS = ['job_id', 'linked_job_id', 'current_job_id'];

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

export function getRecordCompanyIds(record) {
  if (!record) return [];
  return uniq(COMPANY_FIELDS.map((field) => clean(record[field])));
}

export function getRecordJobIds(record) {
  if (!record) return [];
  return uniq(JOB_FIELDS.map((field) => clean(record[field])));
}

function normalizeEntityName(entityName = '') {
  return clean(entityName).toLowerCase();
}

async function resolveJobContext(jobId, loaders) {
  if (!jobId || !loaders?.loadJob) return null;
  const job = await loaders.loadJob(jobId);
  const companyIds = getRecordCompanyIds(job);
  return companyIds.length ? { companyIds, jobIds: [jobId], source: 'job', parent: job } : null;
}

async function resolveParent(entityName, record, loaders) {
  const normalized = normalizeEntityName(entityName);
  const estimateId = clean(record?.estimate_id || record?.estimateId);
  const leadId = clean(record?.lead_id || record?.leadId);
  const changeOrderId = clean(record?.co_id || record?.change_order_id || record?.changeOrderId);
  const vendorId = clean(record?.vendor_id || record?.vendorId);

  if (normalized === 'estimateactivity' && estimateId && loaders?.loadEstimate) {
    return resolveRecordCompanyContext('Estimate', await loaders.loadEstimate(estimateId), loaders);
  }
  if (normalized === 'leadactivity' && leadId && loaders?.loadLead) {
    return resolveRecordCompanyContext('Lead', await loaders.loadLead(leadId), loaders);
  }
  if (normalized === 'changeorderactivity' && changeOrderId && loaders?.loadChangeOrder) {
    return resolveRecordCompanyContext('ChangeOrder', await loaders.loadChangeOrder(changeOrderId), loaders);
  }
  if (normalized === 'vendorcompliancedocument' && vendorId && loaders?.loadVendor) {
    return resolveRecordCompanyContext('Vendor', await loaders.loadVendor(vendorId), loaders);
  }
  if (normalized === 'room' && clean(record?.job_id)) {
    return resolveJobContext(clean(record.job_id), loaders);
  }
  if (normalized === 'attachment' && loaders?.loadParentRecord) {
    const parentType = record.parent_type || record.record_type || record.entity_name || record.entityName || record.parentEntity;
    const parentId = record.parent_id || record.record_id || record.entity_id || record.entityId || record.parentEntityId;
    if (parentType && parentId) {
      const parent = await loaders.loadParentRecord(parentType, parentId);
      return resolveRecordCompanyContext(parentType, parent, loaders);
    }
  }
  return null;
}

export async function resolveRecordCompanyContext(entityName, record, loaders = {}) {
  if (!record) return null;

  const directCompanyIds = getRecordCompanyIds(record);
  if (directCompanyIds.length) {
    return { companyIds: directCompanyIds, jobIds: getRecordJobIds(record), source: 'direct', parent: record };
  }

  for (const jobId of getRecordJobIds(record)) {
    const context = await resolveJobContext(jobId, loaders);
    if (context) return context;
  }

  return resolveParent(entityName, record, loaders);
}

export async function recordBelongsToCompanyByRelationship(entityName, record, companyId, loaders = {}) {
  if (!companyId) return false;
  const context = await resolveRecordCompanyContext(entityName, record, loaders);
  return !!context?.companyIds?.includes(companyId);
}

export function filterRecordsByAllowedJobIds(records = [], allowedJobIds = [], jobFields = JOB_FIELDS) {
  const allowed = new Set(allowedJobIds.filter(Boolean));
  if (!allowed.size) return [];
  return records.filter((record) => jobFields.some((field) => record?.[field] && allowed.has(record[field])));
}

export function recordBelongsToAllowedJobs(record, allowedJobIds = [], jobFields = JOB_FIELDS) {
  return filterRecordsByAllowedJobIds([record], allowedJobIds, jobFields).length === 1;
}
