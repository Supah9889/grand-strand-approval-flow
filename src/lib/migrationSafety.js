export const COMPANY_OWNERSHIP_CONFIRM = 'MIGRATE_COMPANY_OWNERSHIP';

export function resolveMigrationRunMode(body = {}) {
  const dryRun = body?.dryRun !== false;
  if (dryRun) return { ok: true, dryRun: true };

  if (body?.confirm !== COMPANY_OWNERSHIP_CONFIRM) {
    return {
      ok: false,
      dryRun: false,
      reason: 'missing_confirm',
      requiredConfirm: COMPANY_OWNERSHIP_CONFIRM,
      example: { dryRun: false, confirm: COMPANY_OWNERSHIP_CONFIRM },
    };
  }

  return { ok: true, dryRun: false };
}
