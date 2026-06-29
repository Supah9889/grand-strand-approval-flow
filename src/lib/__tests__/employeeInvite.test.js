import { describe, expect, test } from 'vitest';
import {
  assertInviteEmailMatch,
  buildInviteLink,
  buildSafeInviteContext,
  canManageEmployeeInvites,
  createMembershipPayloads,
  getEffectiveInviteStatus,
  normalizeInviteRole,
  sanitizeInviteForList,
  validateEmployeeInviteDraft,
  validateInviteAcceptanceInput,
  validateInviteForAcceptance,
} from '../employeeInvite';

describe('employee invite helpers', () => {
  const nowMs = new Date('2026-06-29T12:00:00Z').getTime();
  const baseInvite = {
    id: 'invite-1',
    name: 'Jane Team',
    email: 'jane@example.com',
    role: 'manager',
    company_ids: JSON.stringify(['co-a', 'co-b']),
    default_company_id: 'co-a',
    permission_group: 'operations_admin',
    status: 'sent',
    expires_at: '2026-06-30T12:00:00Z',
    invite_token_hash: 'secret-hash',
    token: 'raw-token',
  };
  const companies = [
    { id: 'co-a', name: 'Company A', slug: 'A' },
    { id: 'co-b', name: 'Company B', slug: 'B' },
  ];

  test('builds invite links without storing raw tokens in list contexts', () => {
    expect(buildInviteLink('tok 123', 'https://app.example.com')).toBe('https://app.example.com/accept-invite?token=tok%20123');
    expect(sanitizeInviteForList(baseInvite)).not.toHaveProperty('invite_token_hash');
    expect(sanitizeInviteForList(baseInvite)).not.toHaveProperty('token');
  });

  test('validates active, expired, revoked, and accepted invites', () => {
    expect(validateInviteForAcceptance(baseInvite, nowMs).ok).toBe(true);
    expect(getEffectiveInviteStatus({ ...baseInvite, status: 'accepted' }, nowMs)).toBe('accepted');
    expect(validateInviteForAcceptance({ ...baseInvite, status: 'accepted' }, nowMs).reason).toBe('accepted');
    expect(validateInviteForAcceptance({ ...baseInvite, status: 'revoked' }, nowMs).reason).toBe('revoked');
    expect(validateInviteForAcceptance({ ...baseInvite, expires_at: '2026-06-29T11:59:00Z' }, nowMs).reason).toBe('expired');
  });

  test('enforces invite email confirmation', () => {
    expect(assertInviteEmailMatch(baseInvite, 'JANE@example.com')).toBe(true);
    expect(assertInviteEmailMatch(baseInvite, 'other@example.com')).toBe(false);
  });

  test('normalizes unsupported roles safely', () => {
    expect(normalizeInviteRole('owner')).toBe('owner');
    expect(normalizeInviteRole('admin')).toBe('admin');
    expect(normalizeInviteRole('vendor')).toBe('field');
  });

  test('creates company membership payloads from invite assignments', () => {
    const payloads = createMembershipPayloads(baseInvite, { id: 'emp-1', name: 'Jane Team' }, companies);

    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toMatchObject({
      company_id: 'co-a',
      employee_id: 'emp-1',
      role: 'operations_admin',
      permission_group: 'operations_admin',
      is_active: true,
    });
  });

  test('invite acceptance creates memberships only for assigned companies', () => {
    const payloads = createMembershipPayloads(
      { ...baseInvite, company_ids: JSON.stringify(['co-b']) },
      { id: 'emp-1', name: 'Jane Team' },
      companies
    );

    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      company_id: 'co-b',
      company_name: 'Company B',
      employee_id: 'emp-1',
      is_active: true,
    });
    expect(payloads.some(payload => payload.company_id === 'co-a')).toBe(false);
  });

  test('safe invite context includes companies and omits token data', () => {
    const context = buildSafeInviteContext(baseInvite, companies);

    expect(context.companies.map(company => company.name)).toEqual(['Company A', 'Company B']);
    expect(context).not.toHaveProperty('invite_token_hash');
  });

  test('admin-only invite actions allow owner/admin only', () => {
    expect(canManageEmployeeInvites({ role: 'owner' })).toBe(true);
    expect(canManageEmployeeInvites({ role: 'admin' })).toBe(true);
    expect(canManageEmployeeInvites({ role: 'manager' })).toBe(false);
    expect(canManageEmployeeInvites({ role: 'field' })).toBe(false);
  });

  test('allows blank employee code when employee will set PIN from invite link', () => {
    const result = validateEmployeeInviteDraft({
      ...baseInvite,
      requires_pin_setup: true,
      employee_code: '',
    });

    expect(result).toMatchObject({
      ok: true,
      requiresPinSetup: true,
      employeeCode: '',
    });
  });

  test('requires admin-provided employee code only when PIN setup is disabled', () => {
    expect(validateEmployeeInviteDraft({
      ...baseInvite,
      requires_pin_setup: false,
      employee_code: '',
    })).toMatchObject({
      ok: false,
      reason: 'missing_employee_code',
    });

    expect(validateEmployeeInviteDraft({
      ...baseInvite,
      requires_pin_setup: false,
      employee_code: '4321',
    })).toMatchObject({
      ok: true,
      employeeCode: '4321',
    });
  });

  test('acceptance requires employee-created PIN when invite requires PIN setup', () => {
    expect(validateInviteAcceptanceInput({
      ...baseInvite,
      requires_pin_setup: true,
    }, {
      email: 'jane@example.com',
      employee_code: '',
    }, nowMs)).toMatchObject({
      ok: false,
      reason: 'missing_employee_code',
    });

    expect(validateInviteAcceptanceInput({
      ...baseInvite,
      requires_pin_setup: true,
    }, {
      email: 'jane@example.com',
      employee_code: '9090',
    }, nowMs)).toMatchObject({
      ok: true,
      employeeCode: '9090',
    });
  });
});
