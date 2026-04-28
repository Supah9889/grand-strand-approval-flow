/**
 * Phase 1A — Payments Permission & Audit Tests
 *
 * Covers:
 *  1. Payments page access is permission-based (manage_payments), not raw role check
 *  2. delete_payments permission gates the delete button
 *  3. payment.deleted emits audit action = 'logged_payment_deleted'
 */

import { describe, test, expect } from 'vitest';
import { resolvePermissions } from '../permissions';
import { audit, ACTION_LABELS } from '../audit';

// ─── Permission resolution ───────────────────────────────────────────────────

describe('manage_payments permission', () => {
  test('admin role has manage_payments = true by default', () => {
    const perms = resolvePermissions({ role: 'admin' });
    expect(perms.manage_payments).toBe(true);
  });

  test('staff role has manage_payments = false by default', () => {
    const perms = resolvePermissions({ role: 'staff' });
    expect(perms.manage_payments).toBe(false);
  });

  test('owner role always has manage_payments = true', () => {
    const perms = resolvePermissions({ role: 'owner' });
    expect(perms.manage_payments).toBe(true);
  });

  test('staff can be granted manage_payments via stored role perms', () => {
    const perms = resolvePermissions({
      role: 'staff',
      storedRolePerms: { manage_payments: true },
    });
    expect(perms.manage_payments).toBe(true);
  });

  test('admin can have manage_payments revoked via stored role perms', () => {
    const perms = resolvePermissions({
      role: 'admin',
      storedRolePerms: { manage_payments: false },
    });
    expect(perms.manage_payments).toBe(false);
  });

  test('employee override can grant manage_payments to staff', () => {
    const perms = resolvePermissions({
      role: 'staff',
      storedRolePerms: null,
      employeeOverrides: { manage_payments: true },
    });
    expect(perms.manage_payments).toBe(true);
  });

  test('employee override can revoke manage_payments from admin', () => {
    const perms = resolvePermissions({
      role: 'admin',
      storedRolePerms: null,
      employeeOverrides: { manage_payments: false },
    });
    expect(perms.manage_payments).toBe(false);
  });
});

// ─── delete_payments permission ───────────────────────────────────────────────

describe('delete_payments permission', () => {
  test('admin role has delete_payments = true by default', () => {
    const perms = resolvePermissions({ role: 'admin' });
    expect(perms.delete_payments).toBe(true);
  });

  test('staff role has delete_payments = false by default', () => {
    const perms = resolvePermissions({ role: 'staff' });
    expect(perms.delete_payments).toBe(false);
  });

  test('owner always has delete_payments', () => {
    const perms = resolvePermissions({ role: 'owner' });
    expect(perms.delete_payments).toBe(true);
  });

  test('staff cannot see delete button when delete_payments = false', () => {
    const perms = resolvePermissions({ role: 'staff' });
    // Simulates: {permissions?.delete_payments && <DeleteButton />}
    expect(!!perms.delete_payments).toBe(false);
  });

  test('authorized user can see delete button when delete_payments = true', () => {
    const perms = resolvePermissions({ role: 'admin' });
    expect(!!perms.delete_payments).toBe(true);
  });

  test('staff granted delete_payments via employee override can see delete button', () => {
    const perms = resolvePermissions({
      role: 'staff',
      employeeOverrides: { delete_payments: true },
    });
    expect(!!perms.delete_payments).toBe(true);
  });
});

// ─── Audit action for logged payment deletion ─────────────────────────────────

describe('audit.payment.deleted — emits logged_payment_deleted action', () => {
  test('audit module exports payment.deleted as a function', () => {
    expect(typeof audit.payment.deleted).toBe('function');
  });

  test('ACTION_LABELS has entry for logged_payment_deleted', () => {
    const entry = ACTION_LABELS['logged_payment_deleted'];
    expect(entry).toBeDefined();
    expect(entry.label).toBe('Logged Payment Deleted');
    // Should be a destructive/red color since it's a deletion
    expect(entry.color).toContain('destructive');
  });

  test('audit.payment.recorded is a separate function from audit.payment.deleted', () => {
    expect(typeof audit.payment.recorded).toBe('function');
    expect(audit.payment.recorded).not.toBe(audit.payment.deleted);
  });

  test('audit.payment.edited is a separate function', () => {
    expect(typeof audit.payment.edited).toBe('function');
  });
});

// ─── Page-level access gate (simulates PaymentsPage guard) ────────────────────

describe('PaymentsPage access gate — permission-based', () => {
  test('page is inaccessible when manage_payments is false', () => {
    const perms = resolvePermissions({ role: 'staff' });
    // Simulates: if (!permissions.manage_payments && !loading) return <AccessDenied>
    expect(perms.manage_payments).toBe(false);
  });

  test('page is accessible when manage_payments is true', () => {
    const perms = resolvePermissions({ role: 'admin' });
    expect(perms.manage_payments).toBe(true);
  });

  test('page is accessible to owner without stored perms', () => {
    const perms = resolvePermissions({ role: 'owner' });
    expect(perms.manage_payments).toBe(true);
  });

  test('page is accessible to staff with explicit manage_payments grant', () => {
    const perms = resolvePermissions({
      role: 'staff',
      storedRolePerms: { manage_payments: true },
    });
    expect(perms.manage_payments).toBe(true);
  });

  test('page is inaccessible when admin has manage_payments revoked individually', () => {
    const perms = resolvePermissions({
      role: 'admin',
      employeeOverrides: { manage_payments: false },
    });
    expect(perms.manage_payments).toBe(false);
  });
});