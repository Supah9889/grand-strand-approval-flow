import { describe, expect, test, vi } from 'vitest';
import {
  filterRecordsByAllowedJobIds,
  recordBelongsToAllowedJobs,
  recordBelongsToCompanyByRelationship,
  resolveRecordCompanyContext,
} from '../relationshipContext';

describe('relationship company context', () => {
  const loaders = {
    loadJob: vi.fn(async (id) => ({
      id,
      company_id: id === 'job-a' ? 'company-a' : 'company-b',
    })),
    loadEstimate: vi.fn(async (id) => ({ id, linked_job_id: 'job-a' })),
    loadLead: vi.fn(async (id) => ({ id, company_id: 'company-lead' })),
    loadChangeOrder: vi.fn(async (id) => ({ id, job_id: 'job-b' })),
    loadVendor: vi.fn(async (id) => ({ id, company_id: 'company-vendor' })),
    loadParentRecord: vi.fn(async (entityName, id) => ({
      id,
      entityName,
      job_id: 'job-a',
    })),
  };

  test('resolves direct company ownership', async () => {
    const context = await resolveRecordCompanyContext('Invoice', { id: 'inv-1', company_id: 'company-a' });

    expect(context).toMatchObject({ companyIds: ['company-a'], source: 'direct' });
  });

  test('resolves job-scoped child records through job ownership', async () => {
    const context = await resolveRecordCompanyContext('JobFile', { id: 'file-1', job_id: 'job-a' }, loaders);

    expect(context).toMatchObject({ companyIds: ['company-a'], jobIds: ['job-a'], source: 'job' });
  });

  test('resolves activity records through parent entities', async () => {
    await expect(resolveRecordCompanyContext('EstimateActivity', { estimate_id: 'estimate-1' }, loaders))
      .resolves.toMatchObject({ companyIds: ['company-a'] });
    await expect(resolveRecordCompanyContext('LeadActivity', { lead_id: 'lead-1' }, loaders))
      .resolves.toMatchObject({ companyIds: ['company-lead'] });
    await expect(resolveRecordCompanyContext('ChangeOrderActivity', { co_id: 'co-1' }, loaders))
      .resolves.toMatchObject({ companyIds: ['company-b'] });
  });

  test('resolves vendor compliance documents through vendor ownership', async () => {
    const context = await resolveRecordCompanyContext('VendorComplianceDocument', { vendor_id: 'vendor-1' }, loaders);

    expect(context).toMatchObject({ companyIds: ['company-vendor'] });
  });

  test('resolves attachments through direct job or parent record', async () => {
    await expect(resolveRecordCompanyContext('Attachment', { job_id: 'job-a' }, loaders))
      .resolves.toMatchObject({ companyIds: ['company-a'] });
    await expect(resolveRecordCompanyContext('Attachment', { record_type: 'estimate', record_id: 'estimate-1' }, loaders))
      .resolves.toMatchObject({ companyIds: ['company-a'] });
  });

  test('fails closed when relationship cannot be resolved', async () => {
    await expect(resolveRecordCompanyContext('JobNote', { id: 'note-1', job_id: 'job-a' })).resolves.toBeNull();
    await expect(recordBelongsToCompanyByRelationship('JobNote', { job_id: 'job-a' }, 'company-a')).resolves.toBe(false);
  });

  test('filters records by allowed jobs only', () => {
    const records = [
      { id: 'a', job_id: 'job-a' },
      { id: 'b', linked_job_id: 'job-b' },
      { id: 'x', job_id: 'job-x' },
    ];

    expect(filterRecordsByAllowedJobIds(records, ['job-a', 'job-b']).map((record) => record.id)).toEqual(['a', 'b']);
    expect(recordBelongsToAllowedJobs({ job_id: 'job-x' }, ['job-a'])).toBe(false);
  });
});
