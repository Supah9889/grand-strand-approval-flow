# Deployment Readiness Checklist

Phase 3 adds deployment-critical portal grant resolution, relationship-map enforcement helpers, and migration run controls. Use this checklist before staging and again before production.

## Pre-Deploy Checks

- Confirm `npm run test:run` passes locally.
- Confirm `npm run build` passes locally.
- Review `npm run lint` output and confirm remaining errors are legacy or unrelated to Phase 3.
- Run targeted ESLint on all Phase 3 JS/JSX files.
- Confirm the frontend build includes the new portal resolver calls before deploying portal routes.

## Base44 Schema Deploy Steps

- Deploy Phase 2 schema changes before running Phase 3 portal pages:
  - `Vendor.company_id`
  - `Lead.company_id`
  - `Estimate.company_id`
- Confirm existing records are not deleted or overwritten during schema deployment.
- Confirm PortalUser records keep existing `access_token`, `job_id`, and `linked_job_ids` values.
- Deploy Phase 4 onboarding schema before enabling employee invites:
  - `EmployeeInvite`
  - extended `Employee.role` values for `owner`, `manager`, and `office`
  - extended `Employee.invite_status` values for `draft`, `sent`, `accepted`, and `revoked`

## Base44 Function Deploy Steps

- Deploy or redeploy these functions together:
  - `resolveClientPortalGrant`
  - `resolveVendorPortalGrant`
  - `createEmployeeInvite`
  - `resolveEmployeeInvite`
  - `acceptEmployeeInvite`
  - `resendEmployeeInvite`
  - `revokeEmployeeInvite`
  - `migrateCompanyOwnership`
  - `resolveSigningGrant`
  - `requestSignatureAccessGrant`
  - `requestR2ReadUrl`
  - `requestR2UploadUrl`
- Verify public invocation is allowed for portal and signing resolver functions.
- Verify authenticated invocation remains required for R2 read/upload URL issuance and migration functions.
- Confirm safe errors are returned without private job, bucket, or key details.

## Cloudflare Worker And Env Checks

- Confirm the Cloudflare Worker is deployed from `cloudflare-worker/src`.
- Set one of:
  - `ALLOWED_ORIGINS`
  - `CORS_ALLOWED_ORIGINS`
- Confirm allowed origins include staging and production app domains only.
- Confirm R2 bucket binding points to the intended private bucket.
- Confirm any shared proxy secret or signing secret used by Base44 functions matches the Worker environment.
- Confirm unsupported methods and path traversal attempts are rejected.

## Migration Dry-Run Steps

1. Invoke `migrateCompanyOwnership` as an admin with:

```json
{}
```

2. Confirm response has `"dryRun": true`.
3. Review per-entity:
   - `migrated`
   - `skipped`
   - `unassigned`
   - `sampleUnassignedIds`
   - `sampleInferredAssignments`
   - `errors`
4. Manually review records that would receive `GLOBAL_ADMIN_UNASSIGNED`.
5. Do not run live migration until sampled assignments are reasonable.

## Live Migration Steps

1. Run only after dry-run review.
2. Invoke `migrateCompanyOwnership` as an admin with:

```json
{
  "dryRun": false,
  "confirm": "MIGRATE_COMPANY_OWNERSHIP"
}
```

3. Confirm totals and errors.
4. Manually review and resolve records assigned to `GLOBAL_ADMIN_UNASSIGNED`.
5. Re-run dry-run to verify idempotency and remaining work.

## Rollback Plan

- Keep a pre-migration export of affected entities:
  - Vendor
  - Lead
  - Estimate
- If portal resolver deployment fails, roll back frontend portal pages or redeploy previous frontend build before disabling tokens.
- If migration assignments are wrong, restore exported records or patch `company_id` values from the reviewed export.
- Do not delete migrated records during rollback.

## Manual Smoke Tests

- Client portal valid token opens only authorized job data.
- Client portal expired, disabled, revoked, or missing token shows access unavailable.
- Client portal URL `jobId` changes do not alter visible job data.
- Vendor portal valid token opens only linked jobs.
- Vendor portal job switcher only lists resolver-authorized jobs.
- Vendor portal files, comments, tasks, events, and change orders are limited to resolved job IDs.
- Public signing token flow still resolves through `resolveSigningGrant`.
- R2 read URLs reject unsafe keys and unrelated job/file IDs.

## Office User Acceptance Tests

- Office user can open assigned-company dashboard data.
- Admin can view company-scoped financial records.
- Super/admin-only workflows still render only for allowed roles.
- Company switch clears or re-keys operational reads.
- Detail pages show 404/access denied for records outside the active company.

## Known Blockers

- Full-project lint still contains legacy unused import errors outside Phase 3 scope.
- Base44 portal resolver functions must be deployed before frontend portal pages that call them.
- Company ownership migration must be dry-run and reviewed before live production migration.
- `GLOBAL_ADMIN_UNASSIGNED` records require manual ownership assignment after migration.
