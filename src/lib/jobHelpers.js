export const JOB_LIFECYCLE_CONFIG = {
  presale:     { label: 'Presale',     color: 'bg-slate-100 text-slate-600',   border: 'border-slate-200' },
  imported:    { label: 'Imported',    color: 'bg-slate-100 text-slate-600',   border: 'border-slate-200' },
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700',     border: 'border-blue-200' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700',   border: 'border-amber-200' },
  waiting:     { label: 'Waiting',     color: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700',   border: 'border-green-200' },
  warranty:    { label: 'Warranty',    color: 'bg-violet-100 text-violet-700', border: 'border-violet-200' },
  closed:      { label: 'Closed',      color: 'bg-gray-100 text-gray-500',     border: 'border-gray-200' },
  archived:    { label: 'Archived',    color: 'bg-muted text-muted-foreground',border: 'border-border' },
  canceled:    { label: 'Canceled',    color: 'bg-red-100 text-red-600',       border: 'border-red-200' },
  on_hold:     { label: 'On Hold',     color: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200' },
};

// ── Operational status system ─────────────────────────────────────────────────
// Groups: neutral | attention | waiting | active | paused | financial/done
export const OP_STATUS_CONFIG = {
  new:               { label: 'New',                  group: 'neutral',    color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  imported:          { label: 'Imported',             group: 'neutral',    color: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
  needs_review:      { label: 'Needs Review',         group: 'neutral',    color: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-400' },
  needs_scheduling:  { label: 'Needs Scheduling',     group: 'attention',  color: 'bg-amber-100 text-amber-700',    dot: 'bg-amber-500' },
  waiting_homeowner: { label: 'Waiting on Homeowner', group: 'waiting',    color: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-500' },
  waiting_builder:   { label: 'Waiting on Builder',   group: 'waiting',    color: 'bg-orange-50 text-orange-600',   dot: 'bg-orange-400' },
  waiting_vendor:    { label: 'Waiting on Vendor/Sub', group: 'waiting',   color: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-500' },
  waiting_materials: { label: 'Waiting on Materials', group: 'waiting',    color: 'bg-yellow-50 text-yellow-600',   dot: 'bg-yellow-400' },
  scheduled:         { label: 'Scheduled',            group: 'active',     color: 'bg-cyan-50 text-cyan-700',       dot: 'bg-cyan-500' },
  in_progress:       { label: 'In Progress',          group: 'active',     color: 'bg-primary/10 text-primary',     dot: 'bg-primary' },
  on_hold:           { label: 'On Hold',              group: 'paused',     color: 'bg-red-50 text-red-600',         dot: 'bg-red-400' },
  complete:          { label: 'Complete',             group: 'done',       color: 'bg-green-100 text-green-700',    dot: 'bg-green-500' },
  invoiced:          { label: 'Invoiced',             group: 'financial',  color: 'bg-teal-50 text-teal-700',       dot: 'bg-teal-500' },
  paid:              { label: 'Paid',                 group: 'financial',  color: 'bg-green-50 text-green-600',     dot: 'bg-green-400' },
  closed:            { label: 'Closed',               group: 'done',       color: 'bg-muted text-muted-foreground', dot: 'bg-slate-300' },
};

export const OP_STATUS_GROUPS = [
  { key: 'neutral',   label: 'New / Review',  statuses: ['new', 'imported', 'needs_review'] },
  { key: 'attention', label: 'Action Needed', statuses: ['needs_scheduling'] },
  { key: 'waiting',   label: 'Waiting',       statuses: ['waiting_homeowner','waiting_builder','waiting_vendor','waiting_materials'] },
  { key: 'active',    label: 'Active',        statuses: ['scheduled','in_progress'] },
  { key: 'paused',    label: 'Paused',        statuses: ['on_hold'] },
  { key: 'done',      label: 'Finished',      statuses: ['complete','closed'] },
  { key: 'financial', label: 'Financial',     statuses: ['invoiced','paid'] },
];

// Grouped filter buckets for list views
export const OP_STATUS_FILTER_BUCKETS = [
  { key: 'all',       label: 'All' },
  { key: 'open',      label: 'Open',      statuses: ['new','imported','needs_review','needs_scheduling','waiting_homeowner','waiting_builder','waiting_vendor','waiting_materials','scheduled','in_progress','on_hold'] },
  { key: 'waiting',   label: 'Waiting',   statuses: ['waiting_homeowner','waiting_builder','waiting_vendor','waiting_materials'] },
  { key: 'active',    label: 'Active',    statuses: ['scheduled','in_progress'] },
  { key: 'financial', label: 'Financial', statuses: ['invoiced','paid'] },
  { key: 'finished',  label: 'Finished',  statuses: ['complete','closed'] },
];

export function getOpStatus(job) {
  return job?.op_status || 'new';
}

export function getOpStatusConfig(statusKey) {
  return OP_STATUS_CONFIG[statusKey] || OP_STATUS_CONFIG.new;
}

export const JOB_GROUP_CONFIG = {
  painting:       { label: 'Painting',         color: 'bg-blue-50 text-blue-700' },
  drywall:        { label: 'Drywall',          color: 'bg-stone-50 text-stone-700' },
  carpentry:      { label: 'Carpentry',        color: 'bg-amber-50 text-amber-700' },
  water_mitigation:{ label: 'Water / Mitigation', color: 'bg-cyan-50 text-cyan-700' },
  warranty:       { label: 'Warranty',         color: 'bg-violet-50 text-violet-700' },
  estimate_only:  { label: 'Estimate Only',    color: 'bg-slate-50 text-slate-600' },
  insurance:      { label: 'Insurance',        color: 'bg-emerald-50 text-emerald-700' },
  builder_vendor: { label: 'Builder / Vendor', color: 'bg-teal-50 text-teal-700' },
  residential:    { label: 'Residential',      color: 'bg-green-50 text-green-700' },
  commercial:     { label: 'Commercial',       color: 'bg-indigo-50 text-indigo-700' },
  internal:       { label: 'Internal',         color: 'bg-gray-50 text-gray-600' },
  other:          { label: 'Other',            color: 'bg-muted text-muted-foreground' },
};

export const ACTIVE_LIFECYCLE_STATUSES = ['open','in_progress','waiting','warranty','on_hold'];
export const CLOSED_LIFECYCLE_STATUSES = ['completed','closed','archived','canceled'];

// ── Centralized lifecycle helpers ─────────────────────────────────────────────

export function isBuildertrendImportedJob(job) {
  if (!job) return false;
  const sourceSystem = String(job.source_system || job.sourceSystem || job.data?.source_system || job.data?.sourceSystem || '').toLowerCase();
  return sourceSystem === 'buildertrend';
}

export function normalizeBuildertrendMatchValue(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAddressParts(...parts) {
  return normalizeBuildertrendMatchValue(parts.filter(Boolean).join(' '));
}

export function findExistingBuildertrendImportedJob(stagedJob, liveJobs = []) {
  if (!stagedJob) return null;

  const importedJobs = (liveJobs || []).filter(isBuildertrendImportedJob);
  const stagedBtId = normalizeBuildertrendMatchValue(stagedJob.buildertrend_id || stagedJob.raw_job_name);
  const stagedRawName = normalizeBuildertrendMatchValue(stagedJob.raw_job_name);
  const stagedCleanName = normalizeBuildertrendMatchValue(stagedJob.clean_job_name || stagedJob.raw_job_name);
  const stagedAddress = normalizeAddressParts(stagedJob.address);
  const stagedCity = normalizeBuildertrendMatchValue(stagedJob.city);
  const stagedState = normalizeBuildertrendMatchValue(stagedJob.state);
  const stagedZip = normalizeBuildertrendMatchValue(stagedJob.zip);
  const stagedFullAddress = normalizeAddressParts(stagedJob.address, stagedJob.city, stagedJob.state, stagedJob.zip);
  const addressMatches = (liveAddress) => (
    liveAddress === stagedAddress ||
    liveAddress === stagedFullAddress ||
    Boolean(stagedAddress && liveAddress.startsWith(`${stagedAddress} `))
  );

  if (stagedBtId) {
    const match = importedJobs.find((job) =>
      normalizeBuildertrendMatchValue(job.buildertrend_id || job.buildertrendId) === stagedBtId
    );
    if (match) return match;
  }

  if (stagedRawName) {
    const match = importedJobs.find((job) =>
      normalizeBuildertrendMatchValue(job.buildertrend_id || job.buildertrendId || job.raw_job_name || job.title) === stagedRawName
    );
    if (match) return match;
  }

  if (stagedCleanName && stagedAddress) {
    const match = importedJobs.find((job) => {
      const liveName = normalizeBuildertrendMatchValue(job.clean_job_name || job.title || job.buildertrend_id || job.buildertrendId);
      const liveAddress = normalizeAddressParts(job.address);
      return liveName === stagedCleanName && addressMatches(liveAddress);
    });
    if (match) return match;
  }

  if (stagedAddress && stagedCity && stagedState && stagedZip) {
    const match = importedJobs.find((job) => {
      const liveAddress = normalizeAddressParts(job.address);
      const liveFullAddress = normalizeAddressParts(job.address, job.city, job.state, job.zip);
      const liveCity = normalizeBuildertrendMatchValue(job.city);
      const liveState = normalizeBuildertrendMatchValue(job.state);
      const liveZip = normalizeBuildertrendMatchValue(job.zip);
      return (
        liveFullAddress === stagedFullAddress ||
        liveAddress === stagedFullAddress ||
        (addressMatches(liveAddress) && liveCity === stagedCity && liveState === stagedState && liveZip === stagedZip)
      );
    });
    if (match) return match;
  }

  return null;
}

export function requiresJobSignatureWorkflow(job) {
  if (!job) return false;
  if (isBuildertrendImportedJob(job)) return false;
  if (job.requires_signature === false || job.signature_required === false) return false;
  if (job.signature_status === 'not_required' || job.approval_status === 'imported') return false;
  return job.status === 'pending';
}

/** Returns true if the job is considered "active" and should appear in normal selectors */
export function isActiveJob(job) {
  if (!job) return false;
  const ls = job.lifecycle_status || '';
  const s  = job.status || '';
  if (ls === 'archived' || s === 'archived') return false;
  if (ls === 'canceled' || ls === 'closed') return false;
  return true;
}

/** Filter an array of jobs to only active ones */
export function getActiveJobs(jobs = []) {
  return jobs.filter(isActiveJob);
}
