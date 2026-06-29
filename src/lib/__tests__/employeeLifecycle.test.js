import { describe, expect, test } from 'vitest';
import { buildSoftDeleteEmployeePlan, isPendingEmployeeInvite } from '../employeeLifecycle';

describe('employee lifecycle helpers', () => {
  const now = '2026-06-29T12:00:00.000Z';
  const employee = { id: 'emp-1', name: 'Jane Team' };

  test('soft delete revokes pending invites and deactivates memberships', () => {
    const plan = buildSoftDeleteEmployeePlan({
      employee,
      now,
      invites: [
        { id: 'invite-draft', employee_id: 'emp-1', status: 'draft' },
        { id: 'invite-sent', employee_id: 'emp-1', status: 'sent' },
        { id: 'invite-accepted', employee_id: 'emp-1', status: 'accepted' },
        { id: 'invite-other', employee_id: 'emp-2', status: 'sent' },
      ],
      memberships: [
        { id: 'membership-a', employee_id: 'emp-1', is_active: true },
        { id: 'membership-b', employee_id: 'emp-2', is_active: true },
      ],
    });

    expect(plan.employeeUpdate).toMatchObject({
      active: false,
      invite_status: 'revoked',
      invite_token: null,
      invite_token_expires: '',
      deleted_at: now,
    });
    expect(plan.inviteUpdates).toEqual([
      {
        id: 'invite-draft',
        data: { status: 'revoked', invite_token_hash: '', last_revoked_at: now },
      },
      {
        id: 'invite-sent',
        data: { status: 'revoked', invite_token_hash: '', last_revoked_at: now },
      },
    ]);
    expect(plan.membershipUpdates).toEqual([
      { id: 'membership-a', data: { is_active: false } },
    ]);
  });

  test('does not create delete actions for historical records', () => {
    const plan = buildSoftDeleteEmployeePlan({
      employee,
      now,
      invites: [{ id: 'invite-sent', employee_id: 'emp-1', status: 'sent' }],
      memberships: [{ id: 'membership-a', employee_id: 'emp-1', is_active: true }],
    });

    expect(plan.historicalRecordActions).toEqual([]);
    expect(plan).not.toHaveProperty('timeEntryDeletes');
    expect(plan).not.toHaveProperty('dailyLogDeletes');
    expect(plan).not.toHaveProperty('jobAssignmentDeletes');
    expect(plan).not.toHaveProperty('jobNoteDeletes');
    expect(plan).not.toHaveProperty('auditLogDeletes');
  });

  test('fails closed when no employee is supplied', () => {
    expect(buildSoftDeleteEmployeePlan()).toEqual({
      employeeUpdate: null,
      inviteUpdates: [],
      membershipUpdates: [],
      historicalRecordActions: [],
    });
  });

  test('identifies only pending employee invite statuses', () => {
    expect(isPendingEmployeeInvite({ status: 'draft' })).toBe(true);
    expect(isPendingEmployeeInvite({ status: 'sent' })).toBe(true);
    expect(isPendingEmployeeInvite({ status: 'expired' })).toBe(true);
    expect(isPendingEmployeeInvite({ status: 'accepted' })).toBe(false);
    expect(isPendingEmployeeInvite({ status: 'revoked' })).toBe(false);
  });
});
