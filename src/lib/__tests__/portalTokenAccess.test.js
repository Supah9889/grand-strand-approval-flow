import { describe, expect, test } from 'vitest';
import {
  buildPortalGrantContext,
  extractPortalToken,
  getPortalAllowedJobIds,
  resolvePortalTokenAccess,
} from '../portalTokenAccess';

describe('portal token access', () => {
  test('resolves active tokens and rejects missing or unknown tokens', () => {
    const grants = [{ access_token: 'tok-a', invite_token: 'tok-b', job_id: 'job-1', active: true, access_status: 'active' }];

    expect(resolvePortalTokenAccess('', grants).reason).toBe('missing_token');
    expect(resolvePortalTokenAccess('tok-x', grants).reason).toBe('invalid_token');
    expect(resolvePortalTokenAccess('tok-a', grants).ok).toBe(true);
    expect(resolvePortalTokenAccess('tok-b', grants).ok).toBe(true);
  });

  test('rejects inactive and expired grants', () => {
    const now = new Date('2026-06-29T12:00:00Z').getTime();
    expect(resolvePortalTokenAccess('tok-a', [{ access_token: 'tok-a', active: false }], now).reason).toBe('invalid_token');
    expect(resolvePortalTokenAccess('tok-a', [{ access_token: 'tok-a', active: true, access_status: 'revoked' }], now).reason).toBe('inactive');
    expect(resolvePortalTokenAccess('tok-b', [{
      access_token: 'tok-b',
      active: true,
      access_status: 'active',
      expires_at: '2026-06-29T12:00:00Z',
    }], now).reason).toBe('expired');
  });
});

describe('portal grant context', () => {
  const activeClient = {
    id: 'portal-client',
    name: 'Client User',
    email: 'client@example.com',
    portal_type: 'client',
    access_status: 'active',
    access_token: 'client-token',
    job_id: 'job-a',
    linked_job_ids: JSON.stringify(['job-b']),
  };

  const activeVendor = {
    id: 'portal-vendor',
    portal_type: 'vendor',
    access_status: 'active',
    access_token: 'vendor-token',
    linked_job_ids: JSON.stringify(['job-b']),
  };

  const jobs = [
    { id: 'job-a', company_id: 'company-a', address: 'A Street', private_notes: 'hidden' },
    { id: 'job-b', origin_company_id: 'company-b', address: 'B Street' },
    { id: 'job-x', company_id: 'company-x', address: 'X Street' },
  ];

  test('extracts supported token parameter names', () => {
    expect(extractPortalToken({ token: ' tok ' })).toBe('tok');
    expect(extractPortalToken({ access_token: 'access' })).toBe('access');
    expect(extractPortalToken({ invite_token: 'invite' })).toBe('invite');
  });

  test('resolves client portal context with safe jobs only', () => {
    const result = buildPortalGrantContext(activeClient, jobs, { allowedPortalTypes: ['client'] });

    expect(result.ok).toBe(true);
    expect(result.context.allowedJobIds).toEqual(['job-a', 'job-b']);
    expect(result.context.companyIds).toEqual(['company-a', 'company-b']);
    expect(result.context.jobs[0].private_notes).toBeUndefined();
  });

  test('resolves vendor portal context for linked jobs', () => {
    const result = buildPortalGrantContext(activeVendor, jobs, { allowedPortalTypes: ['vendor', 'subcontractor'] });

    expect(result.ok).toBe(true);
    expect(result.context.allowedJobIds).toEqual(['job-b']);
  });

  test('does not allow caller-supplied job IDs to expand token scope', () => {
    expect(getPortalAllowedJobIds(activeClient)).toEqual(['job-a', 'job-b']);

    const result = buildPortalGrantContext(activeClient, jobs, { allowedPortalTypes: ['client'] });

    expect(result.context.allowedJobIds).not.toContain('job-x');
    expect(result.context.jobs.map((job) => job.id)).not.toContain('job-x');
  });

  test('rejects inactive, expired, wrong-type, missing-job, and missing-company grants', () => {
    const nowMs = new Date('2026-06-29T12:00:00Z').getTime();

    expect(buildPortalGrantContext({ ...activeClient, access_status: 'disabled' }, jobs, { allowedPortalTypes: ['client'] }).reason).toBe('inactive');
    expect(buildPortalGrantContext({ ...activeClient, expires_at: '2026-06-29T11:00:00Z' }, jobs, { allowedPortalTypes: ['client'], nowMs }).reason).toBe('expired');
    expect(buildPortalGrantContext(activeVendor, jobs, { allowedPortalTypes: ['client'] }).reason).toBe('wrong_portal_type');
    expect(buildPortalGrantContext({ ...activeClient, job_id: '', linked_job_ids: '[]' }, jobs, { allowedPortalTypes: ['client'] }).reason).toBe('no_jobs');
    expect(buildPortalGrantContext(activeClient, [{ id: 'job-a' }], { allowedPortalTypes: ['client'] }).reason).toBe('no_company');
  });
});
