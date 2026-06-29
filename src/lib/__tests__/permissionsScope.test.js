import { describe, expect, test } from 'vitest';
import {
  canAccessJob,
  canReadEntity,
  canUseActiveCompanySelection,
  canWriteEntity,
  getActiveCompanyId,
  getUserCompanyMemberships,
  hasCompanyAccess,
  requireCompanyScope,
  safeCompanyFilter,
} from '../permissions';

const context = {
  activeCompanyId: 'co-a',
  employee: { id: 'emp-1', role: 'staff' },
  memberships: [
    { employee_id: 'emp-1', company_id: 'co-a', role: 'operations_admin', is_active: true },
    { employee_id: 'emp-1', company_id: 'co-b', role: 'field_technician', is_active: false },
  ],
};

describe('company scope helpers', () => {
  test('getActiveCompanyId resolves common context shapes', () => {
    expect(getActiveCompanyId({ activeCompany: { id: 'co-a' } })).toBe('co-a');
    expect(getActiveCompanyId({ company_id: 'co-b' })).toBe('co-b');
    expect(getActiveCompanyId('co-c')).toBe('co-c');
  });

  test('safeCompanyFilter and requireCompanyScope add company_id', () => {
    expect(safeCompanyFilter('co-a', { status: 'open' })).toEqual({ status: 'open', company_id: 'co-a' });
    expect(requireCompanyScope({ status: 'open' }, 'co-a')).toEqual({ status: 'open', company_id: 'co-a' });
  });

  test('requireCompanyScope fails closed without active company', () => {
    expect(() => requireCompanyScope({}, null)).toThrow(/Company scope is required/);
    expect(safeCompanyFilter(null)).toBeNull();
  });

  test('getUserCompanyMemberships filters inactive and other users from context', () => {
    expect(getUserCompanyMemberships(context)).toEqual([
      { employee_id: 'emp-1', company_id: 'co-a', role: 'operations_admin', is_active: true },
    ]);
  });

  test('hasCompanyAccess accepts active company and active memberships only', () => {
    expect(hasCompanyAccess(context, 'co-a')).toBe(true);
    expect(hasCompanyAccess(context, 'co-b')).toBe(false);
    expect(hasCompanyAccess(context, 'co-c')).toBe(false);
  });

  test('active company selection must match active membership for employee sessions', () => {
    expect(canUseActiveCompanySelection(context, { id: 'co-a' })).toBe(true);
    expect(canUseActiveCompanySelection(context, { id: 'co-b' })).toBe(false);
    expect(canUseActiveCompanySelection({ sessionRole: 'admin', memberships: [] }, { id: 'co-b' })).toBe(true);
    expect(canUseActiveCompanySelection({ sessionRole: 'staff', memberships: [] }, { id: 'co-b' })).toBe(false);
  });
});

describe('entity record permissions', () => {
  test('canAccessJob accepts active company jobs and rejects other companies', () => {
    expect(canAccessJob(context, { id: 'job-1', company_id: 'co-a' })).toBe(true);
    expect(canAccessJob(context, { id: 'job-2', company_id: 'co-x' })).toBe(false);
  });

  test('canAccessJob accepts assigned employee when company field is absent', () => {
    expect(canAccessJob(context, { id: 'job-3', assigned_employee_ids: '["emp-1"]' })).toBe(true);
  });

  test('canReadEntity follows supplied job ownership for job child records', () => {
    const jobsById = { 'job-1': { id: 'job-1', company_id: 'co-a' } };
    expect(canReadEntity({ ...context, jobsById }, 'Invoice', { id: 'inv-1', job_id: 'job-1' })).toBe(true);
    expect(canReadEntity(context, 'Invoice', { id: 'inv-1', job_id: 'job-1' })).toBe(false);
  });

  test('canWriteEntity rejects records from inaccessible companies', () => {
    expect(canWriteEntity(context, 'Job', { id: 'job-1', company_id: 'co-x' })).toBe(false);
  });

  test('tampered active company does not grant record access without active membership', () => {
    const tamperedContext = { ...context, activeCompanyId: 'co-b' };
    expect(hasCompanyAccess(tamperedContext, 'co-b')).toBe(false);
    expect(canAccessJob(tamperedContext, { id: 'job-2', company_id: 'co-b' })).toBe(false);
    expect(canReadEntity(tamperedContext, 'Invoice', { id: 'inv-2', company_id: 'co-b' })).toBe(false);
  });
});
