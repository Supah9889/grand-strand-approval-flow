import { describe, expect, test } from 'vitest';
import {
  isSessionEmployeeStillValid,
  mapEmployeeRoleToSessionRole,
} from '../adminAuth';

describe('internal employee session freshness', () => {
  test('maps employee roles to internal session roles conservatively', () => {
    expect(mapEmployeeRoleToSessionRole('owner')).toBe('owner');
    expect(mapEmployeeRoleToSessionRole('admin')).toBe('admin');
    expect(mapEmployeeRoleToSessionRole('manager')).toBe('staff');
    expect(mapEmployeeRoleToSessionRole('office')).toBe('staff');
    expect(mapEmployeeRoleToSessionRole('field')).toBe('staff');
    expect(mapEmployeeRoleToSessionRole('unexpected')).toBe('staff');
  });

  test('accepts current active employee sessions', () => {
    const session = { role: 'staff', employee: { id: 'emp-1', role: 'field' } };
    const employee = { id: 'emp-1', role: 'field', active: true };

    expect(isSessionEmployeeStillValid(session, employee)).toBe(true);
  });

  test('rejects disabled, missing, mismatched, or role-drifted sessions', () => {
    const session = { role: 'admin', employee: { id: 'emp-1', role: 'admin' } };

    expect(isSessionEmployeeStillValid(session, null)).toBe(false);
    expect(isSessionEmployeeStillValid(session, { id: 'emp-1', role: 'admin', active: false })).toBe(false);
    expect(isSessionEmployeeStillValid(session, { id: 'emp-2', role: 'admin', active: true })).toBe(false);
    expect(isSessionEmployeeStillValid(session, { id: 'emp-1', role: 'field', active: true })).toBe(false);
  });

  test('override-code sessions without an employee record remain valid', () => {
    expect(isSessionEmployeeStillValid({ role: 'admin' }, null)).toBe(true);
  });
});
