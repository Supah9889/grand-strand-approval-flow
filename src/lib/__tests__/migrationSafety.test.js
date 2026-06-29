import { describe, expect, test } from 'vitest';
import { COMPANY_OWNERSHIP_CONFIRM, resolveMigrationRunMode } from '../migrationSafety';

describe('migration safety', () => {
  test('defaults to dry run for empty bodies', () => {
    expect(resolveMigrationRunMode({})).toEqual({ ok: true, dryRun: true });
  });

  test('requires explicit confirmation for live runs', () => {
    const result = resolveMigrationRunMode({ dryRun: false });

    expect(result.ok).toBe(false);
    expect(result.requiredConfirm).toBe(COMPANY_OWNERSHIP_CONFIRM);
  });

  test('allows live run only with the exact confirmation token', () => {
    expect(resolveMigrationRunMode({
      dryRun: false,
      confirm: COMPANY_OWNERSHIP_CONFIRM,
    })).toEqual({ ok: true, dryRun: false });
  });
});
