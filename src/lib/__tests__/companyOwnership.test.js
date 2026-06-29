import { describe, expect, test } from 'vitest';
import {
  UNASSIGNED_COMPANY_ID,
  buildBackfillPatch,
  buildCompanyNameMap,
  inferEstimateCompanyId,
  inferLeadCompanyId,
  inferVendorCompanyId,
  recordBelongsToCompany,
} from '../companyOwnership';

describe('company ownership helpers', () => {
  const jobs = [
    { id: 'job-a', company_id: 'co-a' },
    { id: 'job-b', company_id: 'co-b' },
  ];
  const companies = [
    { id: 'co-a', name: 'Grand Strand Custom Painting', slug: 'gscp' },
    { id: 'co-b', company_name: 'DryHouse' },
  ];

  test('recordBelongsToCompany accepts direct and parent-job ownership', () => {
    expect(recordBelongsToCompany({ id: 'lead-1', company_id: 'co-a' }, 'co-a')).toBe(true);
    expect(recordBelongsToCompany({ id: 'task-1', job_id: 'job-a' }, 'co-a', { jobs })).toBe(true);
    expect(recordBelongsToCompany({ id: 'task-2', job_id: 'job-b' }, 'co-a', { jobs })).toBe(false);
  });

  test('lead migration preserves company_id, then infers from linked job, then company name', () => {
    const companyNameMap = buildCompanyNameMap(companies);
    expect(inferLeadCompanyId({ id: 'lead-1', company_id: 'co-b' }, { jobs, companyNameMap })).toBe('co-b');
    expect(inferLeadCompanyId({ id: 'lead-2', linked_job_id: 'job-a' }, { jobs, companyNameMap })).toBe('co-a');
    expect(inferLeadCompanyId({ id: 'lead-3', company_name: 'DryHouse' }, { jobs, companyNameMap })).toBe('co-b');
    expect(inferLeadCompanyId({ id: 'lead-4' }, { jobs, companyNameMap })).toBe(UNASSIGNED_COMPANY_ID);
  });

  test('estimate migration uses linked job before linked lead and name fallback', () => {
    const companyNameMap = buildCompanyNameMap(companies);
    const leads = [{ id: 'lead-a', company_id: 'co-a' }];

    expect(inferEstimateCompanyId({ id: 'est-1', linked_job_id: 'job-b', linked_lead_id: 'lead-a' }, { jobs, leads, companyNameMap })).toBe('co-b');
    expect(inferEstimateCompanyId({ id: 'est-2', linked_lead_id: 'lead-a' }, { jobs, leads, companyNameMap })).toBe('co-a');
    expect(inferEstimateCompanyId({ id: 'est-3', company_name: 'Grand Strand Custom Painting' }, { jobs, leads, companyNameMap })).toBe('co-a');
  });

  test('vendor migration infers from related financial/job records', () => {
    const vendor = { id: 'vendor-a', company_name: 'ABC Supplies' };
    expect(inferVendorCompanyId(vendor, {
      jobs,
      bills: [{ id: 'bill-1', vendor_id: 'vendor-a', job_id: 'job-a' }],
    })).toBe('co-a');
  });

  test('backfill patch is idempotent and never overwrites an existing company_id', () => {
    expect(buildBackfillPatch({ id: 'lead-1' }, 'co-a')).toEqual({ id: 'lead-1', updates: { company_id: 'co-a' } });
    expect(buildBackfillPatch({ id: 'lead-2', company_id: 'co-b' }, 'co-a')).toBeNull();
    expect(buildBackfillPatch({ name: 'missing id' }, 'co-a')).toBeNull();
  });
});
