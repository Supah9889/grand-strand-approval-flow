/**
 * Job Lifecycle Service
 * Central authority for classifying and executing job archive/delete actions.
 * All removal decisions happen here — the UI never decides unilaterally.
 */
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';

// ── Action classification results ────────────────────────────────────────────
export const REMOVAL_ACTION = {
  HARD_DELETE: 'HARD_DELETE',
  ARCHIVE_ONLY: 'ARCHIVE_ONLY',
  PROTECTED:   'PROTECTED',
};

// ── Child entities that reference job_id ─────────────────────────────────────
export const CHILD_ENTITIES = [
  'SignatureRecord',
  'JobFile',
  'JobNote',
  'Task',
  'DailyLog',
  'CalendarEvent',
  'JobAssignment',
  'TimeEntry',
  'Invoice',
  'Bill',
  'Expense',
  'ChangeOrder',
  'WarrantyItem',
  'JobContact',
  'AuditLog',
];

// "Heavy" entities that trigger ARCHIVE_ONLY if they exist
const FINANCIAL_ENTITIES = new Set(['Invoice', 'Bill', 'Expense', 'ChangeOrder']);
const APPROVAL_ENTITIES  = new Set(['SignatureRecord', 'AuditLog']);

/**
 * Normalize a job record regardless of whether it came from `.list()` (flat)
 * or `.filter()` (may have data wrapper). Returns flat data object.
 */
export function normalizeJob(job) {
  if (!job) return {};
  // Base44 entity records from list/filter have top-level fields directly
  return job;
}

/**
 * Safely get a field from a job, supporting both flat and .data-wrapped shapes.
 */
function getField(job, field) {
  return job?.[field] ?? job?.data?.[field];
}

/**
 * Classify what removal action is allowed for a single job, given its child record counts.
 * Returns { action, reason, childCounts }
 */
export function classifyJobRemovalAction(job, childCounts = {}) {
  const sourceSystem = (getField(job, 'source_system') || getField(job, 'sourceSystem') || '').toLowerCase();
  const status       = (getField(job, 'status') || '').toLowerCase();
  const locked       = getField(job, 'locked');
  const btId         = getField(job, 'buildertrend_id') || getField(job, 'buildertrendId');

  // PROTECTED: Buildertrend imports
  if (sourceSystem === 'buildertrend' || btId) {
    return { action: REMOVAL_ACTION.PROTECTED, reason: 'Buildertrend import — protected from deletion' };
  }

  // ARCHIVE_ONLY: has signature / approval records
  if ((childCounts.SignatureRecord || 0) > 0) {
    return { action: REMOVAL_ACTION.ARCHIVE_ONLY, reason: 'Has signature/approval records' };
  }

  // ARCHIVE_ONLY: has financial records
  for (const entity of FINANCIAL_ENTITIES) {
    if ((childCounts[entity] || 0) > 0) {
      return { action: REMOVAL_ACTION.ARCHIVE_ONLY, reason: `Has ${entity} records` };
    }
  }

  // ARCHIVE_ONLY: approved/completed/locked
  if (status === 'approved' || locked) {
    return { action: REMOVAL_ACTION.ARCHIVE_ONLY, reason: 'Job is approved/locked' };
  }

  // ARCHIVE_ONLY: has meaningful audit history (> 2 = more than just job_created)
  if ((childCounts.AuditLog || 0) > 2) {
    return { action: REMOVAL_ACTION.ARCHIVE_ONLY, reason: 'Has audit history' };
  }

  // HARD_DELETE: only unsigned, draft, no financial/approval records
  return { action: REMOVAL_ACTION.HARD_DELETE, reason: 'Draft job with no protected records' };
}

/**
 * Fetch child record counts for an array of job IDs.
 * Returns { [jobId]: { EntityName: count, ... } }
 */
export async function fetchChildCountsForJobs(jobIds) {
  const counts = {};
  jobIds.forEach(id => { counts[id] = {}; });

  await Promise.all(
    CHILD_ENTITIES.map(async (entity) => {
      try {
        const records = await base44.entities[entity].list();
        (records || []).forEach(rec => {
          const jid = rec?.job_id;
          if (jid && counts[jid] !== undefined) {
            counts[jid][entity] = (counts[jid][entity] || 0) + 1;
          }
        });
      } catch {
        // entity unavailable or empty — skip
      }
    })
  );

  return counts;
}

/**
 * Archive a single job (and optionally record reason/actor).
 * Does NOT delete any records. Just marks the job.
 */
export async function archiveJob(jobId, { actorName = 'admin', reason = '' } = {}) {
  const now = new Date().toISOString();
  await base44.entities.Job.update(jobId, {
    lifecycle_status: 'archived',
    archived_at: now,
    archived_by: actorName,
    archived_reason: reason || null,
  });
  await logAudit(jobId, 'record_archived', actorName,
    `Job archived by ${actorName}${reason ? `: ${reason}` : ''}`, {
      module: 'job', record_id: jobId, job_id: jobId,
      action: 'record_archived', is_sensitive: false,
      timestamp: now,
    }
  ).catch(() => {});
}

/**
 * Hard-delete a job and all its child records.
 * Returns { deletedChildren: { EntityName: count } }
 */
export async function hardDeleteJob(jobId, { actorName = 'admin', reason = '' } = {}) {
  const deletedChildren = {};

  for (const entity of CHILD_ENTITIES) {
    try {
      const records = await base44.entities[entity].list();
      const matching = (records || []).filter(r => r?.job_id === jobId);
      for (const rec of matching) {
        await base44.entities[entity].delete(rec.id);
      }
      if (matching.length) deletedChildren[entity] = matching.length;
    } catch {
      // skip unavailable entities
    }
  }

  await base44.entities.Job.delete(jobId);

  // Best-effort audit log (job is deleted, so log against job_id only)
  await logAudit(jobId, 'record_deleted', actorName,
    `Job hard-deleted by ${actorName}${reason ? `: ${reason}` : ''}`, {
      module: 'job', record_id: jobId, job_id: jobId,
      action: 'record_deleted', is_sensitive: true,
      timestamp: new Date().toISOString(),
      new_value: JSON.stringify({ deletedChildren }),
    }
  ).catch(() => {});

  return { deletedChildren };
}

/**
 * Process a batch of jobs for removal (archive or hard-delete as classified).
 * Returns a full report.
 */
export async function processBatchRemoval(jobs, childCountsMap, { actorName = 'admin', reason = '' } = {}) {
  const archived = [];
  const hardDeleted = [];
  const protected_ = [];
  const errors = [];

  for (const job of jobs) {
    const jobId = job.id;
    const address = getField(job, 'address') || jobId;
    const customer = getField(job, 'customer_name') || '';
    const childCounts = childCountsMap[jobId] || {};
    const { action, reason: classifyReason } = classifyJobRemovalAction(job, childCounts);

    try {
      if (action === REMOVAL_ACTION.PROTECTED) {
        protected_.push({ jobId, address, customer, reason: classifyReason });
      } else if (action === REMOVAL_ACTION.ARCHIVE_ONLY) {
        await archiveJob(jobId, { actorName, reason: reason || classifyReason });
        archived.push({ jobId, address, customer, reason: classifyReason });
      } else {
        const { deletedChildren } = await hardDeleteJob(jobId, { actorName, reason });
        hardDeleted.push({ jobId, address, customer, deletedChildren });
      }
    } catch (err) {
      errors.push({ jobId, address, customer, error: err?.message || 'Unknown error' });
    }
  }

  return { archived, hardDeleted, protected: protected_, errors };
}