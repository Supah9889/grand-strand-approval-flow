/**
 * integrationSync.js — Integration readiness boundary for accounting sync.
 *
 * This module is the single future plug-in point for external accounting
 * provider integrations (initially QuickBooks Online).
 *
 * ─────────────────────────────────────────────────────────────────
 *  CURRENT STATE: Readiness layer only.
 *  - No live API calls are made here.
 *  - No OAuth flows are implemented here.
 *  - All helpers operate on local record data only.
 *  - When QuickBooks (or another provider) is wired in, this is the
 *    only file that needs to change — callers stay stable.
 * ─────────────────────────────────────────────────────────────────
 *
 * PROVIDER CONSTANTS
 * Field mapping (existing entity fields → canonical sync metadata):
 *
 *  qb_sync_status           → sync_status        ('not_synced' | 'pending' | 'synced' | 'failed')
 *  qb_export_date           → last_synced_at      (ISO timestamp)
 *  qb_export_batch_id       → sync_batch_id
 *  qb_export_error          → sync_error
 *  qb_export_attempt_count  → sync_attempt_count
 *
 *  external_id is record-type-specific and resolved via EXTERNAL_ID_FIELDS:
 *    invoice       → qb_invoice_id       (future field — ready to add to entity)
 *    payment       → qb_payment_id       (future field — ready to add to entity)
 *    bill          → qb_bill_id          (future field — ready to add to entity)
 *    purchase_order→ qb_po_id            (future field — ready to add to entity)
 *    vendor        → qb_vendor_id        (already on Vendor entity)
 *    employee      → qb_employee_id      (already on Employee entity)
 *    time_entry    → qb_time_activity_id (already on TimeEntry entity)
 *    expense       → qb_expense_id       (already on Expense entity)
 *
 * Callers must pass recordType explicitly — record._type is not reliable.
 * These field names are stable on the entities; this module is the
 * canonical way to read and stage updates to them.
 */

// ─── Provider registry ───────────────────────────────────────────────────────

/** Supported integration providers. Extend here when adding new providers. */
export const INTEGRATION_PROVIDERS = {
  QUICKBOOKS: 'quickbooks',
};

/** Which entity types are syncable to accounting providers. */
const SYNCABLE_RECORD_TYPES = new Set([
  'invoice',
  'payment',
  'bill',
  'purchase_order',
  'vendor',
  'employee',
  'time_entry',
  'expense',
]);

/**
 * Returns true if the given record type participates in accounting sync.
 * @param {string} recordType — e.g. 'invoice', 'payment', 'bill'
 */
export function isSyncableFinancialRecord(recordType) {
  return SYNCABLE_RECORD_TYPES.has(recordType);
}

// ─── Field resolution ────────────────────────────────────────────────────────

/**
 * Map provider → external_id field name on the entity.
 * Add entries here as new providers are supported.
 */
const EXTERNAL_ID_FIELDS = {
  [INTEGRATION_PROVIDERS.QUICKBOOKS]: {
    invoice:       'qb_invoice_id',       // QuickBooks Invoice ID (not yet on entity — ready to add)
    payment:       'qb_payment_id',       // QuickBooks Payment ID (not yet on entity — ready to add)
    bill:          'qb_bill_id',          // QuickBooks Bill ID (not yet on entity — ready to add)
    purchase_order:'qb_po_id',            // QuickBooks PO ID (not yet on entity — ready to add)
    vendor:        'qb_vendor_id',        // Already on Vendor entity
    employee:      'qb_employee_id',      // Already on Employee entity
    time_entry:    'qb_time_activity_id', // Already on TimeEntry entity
    expense:       'qb_expense_id',       // Already on Expense entity
  },
};

/**
 * Get the provider-specific external ID field name for a record type.
 * @param {string} provider
 * @param {string} recordType
 * @returns {string|null}
 */
function getExternalIdField(provider, recordType) {
  return EXTERNAL_ID_FIELDS[provider]?.[recordType] ?? null;
}

// ─── Read helpers ────────────────────────────────────────────────────────────

/**
 * Extract canonical sync metadata from a financial record.
 * Works with the existing qb_* fields already present on entities.
 *
 * @param {object} record — any financial entity record
 * @param {string} recordType — the entity type key e.g. 'invoice', 'vendor', 'time_entry'
 * @param {string} [provider] — defaults to QUICKBOOKS
 * @returns {{
 *   provider: string,
 *   record_type: string,
 *   sync_status: string,
 *   external_id: string|null,
 *   last_synced_at: string|null,
 *   sync_batch_id: string|null,
 *   sync_error: string|null,
 *   sync_attempt_count: number,
 * }}
 */
export function getIntegrationMetadata(record, recordType, provider = INTEGRATION_PROVIDERS.QUICKBOOKS) {
  if (!record) return null;

  // Resolve the external ID using the canonical field map for this record type.
  // This is symmetrical with what markSyncSuccess() writes.
  const idField = getExternalIdField(provider, recordType);
  const externalIdValue = (idField ? record[idField] : null) ?? null;

  return {
    provider,
    record_type:        recordType,
    sync_status:        record.qb_sync_status           ?? 'not_synced',
    external_id:        externalIdValue,
    last_synced_at:     record.qb_export_date            ?? null,
    sync_batch_id:      record.qb_export_batch_id        ?? null,
    sync_error:         record.qb_export_error           ?? null,
    sync_attempt_count: record.qb_export_attempt_count   ?? 0,
  };
}

// ─── Staged update builders ──────────────────────────────────────────────────
// These functions return a PARTIAL UPDATE OBJECT — they do not call the API.
// Pass the result to base44.entities.EntityName.update(id, patch) at the call site.

/**
 * Return a partial update object that marks a record as sync-pending.
 * Call this before enqueuing a record for export.
 * Preserves any existing external ID — pending does not clear it.
 *
 * @param {object} record — the current entity record (used for attempt count)
 * @returns {object} partial update fields
 */
export function markSyncPending(record) {
  return {
    qb_sync_status:    'pending',
    qb_export_error:   null,
  };
}

/**
 * Return a partial update object that marks a record as successfully synced.
 * Writes the external ID to the correct provider field for the given record type.
 *
 * @param {object} record     — the current entity record (used for attempt count)
 * @param {string} recordType — entity type key e.g. 'invoice', 'vendor', 'time_entry'
 * @param {string} externalId — the ID assigned by the external provider
 * @param {string} [timestamp] — ISO timestamp; defaults to now
 * @param {string} [provider]
 * @returns {object} partial update fields
 */
export function markSyncSuccess(record, recordType, externalId, timestamp, provider = INTEGRATION_PROVIDERS.QUICKBOOKS) {
  const now = timestamp || new Date().toISOString();
  const idField = getExternalIdField(provider, recordType);

  const patch = {
    qb_sync_status:    'synced',
    qb_export_date:    now,
    qb_export_error:   null,
    qb_export_attempt_count: (record.qb_export_attempt_count || 0) + 1,
  };

  // Write the external ID to the correct provider field if known
  if (idField && externalId) patch[idField] = externalId;

  return patch;
}

/**
 * Return a partial update object that marks a record as sync-failed.
 *
 * @param {object} record — the current entity record (used for attempt count)
 * @param {string} errorMessage — human-readable sync error
 * @returns {object} partial update fields
 */
export function markSyncError(record, errorMessage) {
  return {
    qb_sync_status:    'failed',
    qb_export_error:   errorMessage || 'Unknown sync error',
    qb_export_attempt_count: (record.qb_export_attempt_count || 0) + 1,
  };
}

/**
 * Return a partial update object that resets sync state (e.g. after a record edit
 * that invalidates the previously-synced version).
 *
 * @param {string} [provider]
 * @returns {object} partial update fields
 */
export function resetSyncState(provider = INTEGRATION_PROVIDERS.QUICKBOOKS) {
  return {
    qb_sync_status:    'not_synced',
    qb_export_error:   null,
    // Do NOT clear external_id here — the record may still exist upstream.
    // Clearing it is a deliberate provider-disconnect action, not a reset.
  };
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Human-readable labels and colors for qb_sync_status values. */
export const SYNC_STATUS_CONFIG = {
  not_synced: { label: 'Not Synced',  color: 'text-muted-foreground',   bg: 'bg-muted' },
  pending:    { label: 'Pending',     color: 'text-amber-700',           bg: 'bg-amber-50' },
  synced:     { label: 'Synced',      color: 'text-green-700',           bg: 'bg-green-50' },
  failed:     { label: 'Sync Failed', color: 'text-destructive',         bg: 'bg-red-50' },
  needs_review: { label: 'Needs Review', color: 'text-amber-700',        bg: 'bg-amber-50' },
};

/**
 * Get display config for a sync status value.
 * @param {string} status
 */
export function getSyncStatusConfig(status) {
  return SYNC_STATUS_CONFIG[status] ?? SYNC_STATUS_CONFIG.not_synced;
}

// ─── Future wiring point ─────────────────────────────────────────────────────
/**
 * PLACEHOLDER: executeSync(record, recordType, provider)
 *
 * When the QuickBooks API is wired in, this function will:
 *  1. Authenticate with the provider (via stored OAuth tokens)
 *  2. Map the record to the provider's data model using recordType
 *  3. POST or PUT to the provider API
 *  4. Return { externalId: string, timestamp: string } on success
 *  5. Throw on failure so the caller can call markSyncError(record, err.message)
 *
 * Recommended call pattern at the call site:
 *   await base44.entities.X.update(id, markSyncPending(record));
 *   try {
 *     const { externalId, timestamp } = await executeSync(record, 'invoice');
 *     await base44.entities.X.update(id, markSyncSuccess(record, 'invoice', externalId, timestamp));
 *   } catch (err) {
 *     await base44.entities.X.update(id, markSyncError(record, err.message));
 *   }
 *
 * For now it is intentionally not implemented. Do not add fake logic here.
 */
export async function executeSync(record, recordType, provider = INTEGRATION_PROVIDERS.QUICKBOOKS) {
  throw new Error(
    `[integrationSync] executeSync is not yet implemented. ` +
    `Provider "${provider}" is not connected. ` +
    `Wire the OAuth flow and API client here when ready.`
  );
}