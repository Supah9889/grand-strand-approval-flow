import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      Job: {
        filter: vi.fn(),
      },
    },
  },
}));

import { base44 } from '@/api/base44Client';
import {
  fetchCompanyJobs,
  fetchCompanyRecords,
  fetchScopedRecordById,
  fetchJobScopedRecords,
  filterRecordsByScopedJobs,
} from '../companyScopedQueries';

describe('company scoped query helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('fetchCompanyJobs fails closed without an active company', async () => {
    await expect(fetchCompanyJobs(null)).resolves.toEqual([]);
    expect(base44.entities.Job.filter).not.toHaveBeenCalled();
  });

  test('fetchCompanyJobs applies company_id to the Base44 filter', async () => {
    base44.entities.Job.filter.mockResolvedValue([{ id: 'job-1', company_id: 'co-a' }]);

    await expect(fetchCompanyJobs('co-a', '-updated_date', 25)).resolves.toEqual([
      { id: 'job-1', company_id: 'co-a' },
    ]);

    expect(base44.entities.Job.filter).toHaveBeenCalledWith({ company_id: 'co-a' }, '-updated_date', 25);
  });

  test('fetchCompanyRecords fails closed for missing company or entity filter', async () => {
    await expect(fetchCompanyRecords(null, 'co-a')).resolves.toEqual([]);
    await expect(fetchCompanyRecords({ list: vi.fn() }, 'co-a')).resolves.toEqual([]);
  });

  test('fetchJobScopedRecords queries each scoped job id without broad list calls', async () => {
    const entity = {
      filter: vi.fn()
        .mockResolvedValueOnce([{ id: 'inv-1', job_id: 'job-1' }])
        .mockRejectedValueOnce(new Error('not found')),
      list: vi.fn(),
    };

    await expect(fetchJobScopedRecords(entity, [{ id: 'job-1' }, { id: 'job-2' }], {
      order: '-created_date',
      limitPerJob: 10,
    })).resolves.toEqual([{ id: 'inv-1', job_id: 'job-1' }]);

    expect(entity.filter).toHaveBeenCalledWith({ job_id: 'job-1' }, '-created_date', 10);
    expect(entity.filter).toHaveBeenCalledWith({ job_id: 'job-2' }, '-created_date', 10);
    expect(entity.list).not.toHaveBeenCalled();
  });

  test('filterRecordsByScopedJobs removes records outside the scoped job set', () => {
    const records = [
      { id: 'a', job_id: 'job-1' },
      { id: 'b', linked_job_id: 'job-2' },
      { id: 'c', job_id: 'job-x' },
    ];

    expect(filterRecordsByScopedJobs(records, [{ id: 'job-1' }, { id: 'job-2' }])).toEqual([
      { id: 'a', job_id: 'job-1' },
      { id: 'b', linked_job_id: 'job-2' },
    ]);
  });

  test('fetchScopedRecordById returns direct company records only inside active company', async () => {
    const entity = {
      filter: vi.fn().mockResolvedValue([{ id: 'lead-1', company_id: 'co-a' }]),
    };

    await expect(fetchScopedRecordById(entity, 'lead-1', 'co-a')).resolves.toEqual({ id: 'lead-1', company_id: 'co-a' });
    await expect(fetchScopedRecordById(entity, 'lead-1', 'co-b')).resolves.toBeNull();
  });

  test('fetchScopedRecordById allows job-owned child records through scoped jobs', async () => {
    const entity = {
      filter: vi.fn().mockResolvedValue([{ id: 'task-1', job_id: 'job-1' }]),
    };

    await expect(fetchScopedRecordById(entity, 'task-1', 'co-a', {
      jobs: [{ id: 'job-1', company_id: 'co-a' }],
    })).resolves.toEqual({ id: 'task-1', job_id: 'job-1' });
  });
});
