import { describe, expect, test, vi } from 'vitest';
import {
  BOOTSTRAP_COMPANY_MEMBERSHIPS_CONFIRM,
  planCompanyMembershipBootstrap,
  runCompanyMembershipBootstrap,
} from '../companyMembershipBootstrap';

describe('company membership bootstrap', () => {
  const companies = [
    { id: 'co-a', name: 'Destination Home', slug: 'DH', is_active: true },
    { id: 'co-b', name: 'Grand Strand Custom Painting', slug: 'GSCP', is_active: true },
    { id: 'co-inactive', name: 'Inactive', slug: 'OLD', is_active: false },
  ];
  const employees = [
    { id: 'emp-owner', name: 'Owner User', email: 'owner@example.com', role: 'owner', active: true },
    { id: 'emp-admin', name: 'Admin User', email: 'admin@example.com', role: 'admin', active: true },
    { id: 'emp-field', name: 'Field User', email: 'field@example.com', role: 'field', active: true },
  ];

  test('dry run does not write memberships', async () => {
    const createMembership = vi.fn();
    const result = await runCompanyMembershipBootstrap({
      companies,
      employees,
      memberships: [],
      dryRun: true,
      createMembership,
    });

    expect(result.dryRun).toBe(true);
    expect(result.adminOwnerMembershipsToCreate).toBe(4);
    expect(createMembership).not.toHaveBeenCalled();
  });

  test('live run requires exact confirmation', async () => {
    await expect(runCompanyMembershipBootstrap({
      companies,
      employees,
      memberships: [],
      dryRun: false,
      confirm: '',
      createMembership: vi.fn(),
    })).rejects.toThrow(/requires BOOTSTRAP_COMPANY_MEMBERSHIPS/);
  });

  test('live run creates admin memberships across all active companies', async () => {
    const createMembership = vi.fn(async payload => ({ id: `${payload.employee_id}-${payload.company_id}`, ...payload }));
    const result = await runCompanyMembershipBootstrap({
      companies,
      employees,
      memberships: [],
      dryRun: false,
      confirm: BOOTSTRAP_COMPANY_MEMBERSHIPS_CONFIRM,
      createMembership,
    });

    expect(createMembership).toHaveBeenCalledTimes(4);
    expect(result.createdCount).toBe(4);
    expect(result.created.map(record => `${record.employee_id}:${record.company_id}`).sort()).toEqual([
      'emp-admin:co-a',
      'emp-admin:co-b',
      'emp-owner:co-a',
      'emp-owner:co-b',
    ]);
    expect(result.created.find(record => record.employee_id === 'emp-admin')).toMatchObject({
      role: 'operations_admin',
      permission_group: 'full_admin',
      can_manage_users: true,
      can_view_assigned_only: false,
    });
  });

  test('does not duplicate existing memberships', () => {
    const plan = planCompanyMembershipBootstrap({
      companies,
      employees,
      memberships: [
        { employee_id: 'emp-owner', company_id: 'co-a', is_active: true },
        { employee_id: 'emp-admin', company_id: 'co-b', is_active: true },
      ],
    });

    expect(plan.skippedExistingMemberships).toBe(2);
    expect(plan.adminMembershipsToCreate.map(record => `${record.employee_id}:${record.company_id}`).sort()).toEqual([
      'emp-admin:co-a',
      'emp-owner:co-b',
    ]);
  });

  test('non-admin employees require manual review', () => {
    const plan = planCompanyMembershipBootstrap({ companies, employees, memberships: [] });

    expect(plan.manualReviewRequired).toEqual([
      {
        id: 'emp-field',
        name: 'Field User',
        email: 'field@example.com',
        role: 'field',
        reason: 'Company access cannot be safely inferred for non-admin employee.',
      },
    ]);
  });
});
