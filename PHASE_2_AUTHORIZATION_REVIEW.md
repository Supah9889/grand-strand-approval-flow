# Phase 2 Authorization Review

## What Changed

Phase 2 normalized company ownership for the highest-risk name-scoped records and tightened ID-based access paths.

- Added `company_id` to `Vendor`, `Lead`, and `Estimate` schemas.
- Added idempotent migration function `migrateCompanyOwnership`.
- Added shared server authorization helpers in `base44/functions/_shared/accessControl.ts`.
- Added public grant resolver function `resolveSigningGrant`.
- Replaced company-name tenant filters with `company_id` filters in Sales, Estimates, Vendor Bank, New Job, Global Search, and QB export flows.
- Hardened direct-ID internal detail pages with active-company or parent-job ownership checks.
- Updated public signing, approval, confirmation, and review pages to resolve job context from signed grants.
- Added unit tests for ownership inference, scoped record fetching, signing grants, portal token behavior, and existing R2 traversal protections.

## Files Modified

- `base44/entities/Vendor.jsonc`
- `base44/entities/Lead.jsonc`
- `base44/entities/Estimate.jsonc`
- `base44/functions/_shared/accessControl.ts`
- `base44/functions/migrateCompanyOwnership/entry.ts`
- `base44/functions/resolveSigningGrant/entry.ts`
- `src/lib/companyOwnership.js`
- `src/lib/companyScopedQueries.js`
- `src/lib/signingGrantAccess.js`
- `src/lib/portalTokenAccess.js`
- `src/pages/Estimates.jsx`
- `src/pages/EstimateDetail.jsx`
- `src/pages/Sales.jsx`
- `src/pages/LeadDetail.jsx`
- `src/pages/VendorBank.jsx`
- `src/pages/NewJobPage.jsx`
- `src/pages/GlobalSearch.jsx`
- `src/pages/DailyLogDetail.jsx`
- `src/pages/TaskDetail.jsx`
- `src/pages/ChangeOrderDetail.jsx`
- `src/pages/WorkOrderDetail.jsx`
- `src/pages/JobHub.jsx`
- `src/pages/JobCommsDetail.jsx`
- `src/pages/Signature.jsx`
- `src/pages/JobApproval.jsx`
- `src/pages/Confirmation.jsx`
- `src/pages/Review.jsx`
- `src/components/admin/QBExportPanel.jsx`
- `src/lib/__tests__/companyOwnership.test.js`
- `src/lib/__tests__/companyScopedQueries.test.js`
- `src/lib/__tests__/signingGrantAccess.test.js`
- `src/lib/__tests__/portalTokenAccess.test.js`
- `SCHEMA_OWNERSHIP_MATRIX.md`
- `PHASE_2_AUTHORIZATION_REVIEW.md`

## Migration Added

Function: `base44/functions/migrateCompanyOwnership/entry.ts`

Behavior:

- Requires authenticated admin or owner.
- Defaults to dry run unless called with `{ "dryRun": false }`.
- Skips records that already have `company_id`.
- Backfills:
  - `Vendor.company_id` from linked bills, purchase orders, invoices, or expenses.
  - `Lead.company_id` from linked job, then company-name mapping.
  - `Estimate.company_id` from linked job, linked lead, then company-name mapping.
- Uses `GLOBAL_ADMIN_UNASSIGNED` when ownership cannot be inferred.
- Logs migrated, skipped, unassigned, and error counts.
- Never deletes records.

## Authorization Model

Client-side pages now fail closed when no active company is selected. Operational list queries use one of:

- `company_id` filters for company-owned records.
- active-company job lists plus per-job queries for job-owned child records.
- signed public grants for public signing/review routes.

Server-side helper functions support:

- authenticated user lookup,
- admin checks,
- active company membership checks,
- job ownership checks,
- direct record ownership checks,
- portal token grant validation.

R2/file functions remain inline-hardened from Phase 1 for Base44 deployment compatibility. The new `_shared/accessControl.ts` is the source of truth for new functions and future refactors.

## Base44 Function Classification

| Function | Class | Requirements |
| --- | --- | --- |
| `requestR2Health` | PUBLIC | Health check only; no object access. |
| `requestR2ReadUrl` | AUTHENTICATED / TOKEN_GRANT | Authenticated job/company access, or public signing token for approved read purposes. |
| `requestR2UploadUrl` | AUTHENTICATED / TOKEN_GRANT | Authenticated job/company access, or public signing token for constrained signing uploads. |
| `requestSignatureAccessGrant` | AUTHENTICATED | Authenticated user with job/company access; refuses already signed jobs. |
| `resolveSigningGrant` | TOKEN_GRANT | Signed grant token; resolves job/company context server-side. |
| `migrateCompanyOwnership` | ADMIN_ONLY | Authenticated owner/admin; dry-run by default; updates missing `company_id` only. |
| `_shared/r2Proxy` | SHARED | Shared implementation used by R2-style functions where Base44 supports shared imports. |
| `_shared/accessControl` | SHARED | Shared authorization helper module for new server functions. |

## Remaining Risks

- Existing portal pages still resolve `PortalUser` directly on the frontend. They are token-based and filtered by linked jobs, but should move to a server-side `resolvePortalGrant` function in the next phase.
- Some child activity entities need relationship-map enforcement if they are ever queried outside their parent detail pages.
- `QBExportBatch`, templates, import staging, and review/admin entities are still global admin-only. Add `company_id` later if per-company audit/export history is required.
- Existing legacy rows without `company_id` will not appear in new scoped Vendor/Lead/Estimate views until the migration is run.
- `GLOBAL_ADMIN_UNASSIGNED` rows require manual review and reassignment.

## Manual Base44 Actions

1. Deploy schema changes for `Vendor`, `Lead`, and `Estimate`.
2. Deploy new functions:
   - `migrateCompanyOwnership`
   - `resolveSigningGrant`
3. Run dry run:
   - invoke `migrateCompanyOwnership` with `{ "dryRun": true }`.
4. Review unassigned counts.
5. Run live migration:
   - invoke `migrateCompanyOwnership` with `{ "dryRun": false }`.
6. Manually assign any `GLOBAL_ADMIN_UNASSIGNED` records to the correct company.
7. Regenerate public signing links after deployment so new links use resolvable grants.

## Manual Cloudflare Actions

- No Worker code changes were required in this phase.
- Confirm `SIGNING_GRANT_SECRET` or `R2_WORKER_AUTH_SECRET` matches between grant issuer and resolver.
- Keep `ALLOWED_ORIGINS` or `CORS_ALLOWED_ORIGINS` configured.

## Deployment Checklist

- Run lint and confirm only legacy lint errors remain.
- Run `npm run test:run`.
- Run `npm run build`.
- Deploy Base44 entities.
- Deploy Base44 functions.
- Run migration dry run and live run.
- Smoke-test:
  - company switch clears Vendor/Lead/Estimate data from prior company,
  - direct detail URL for another company returns not found/access denied,
  - public approval/signature/confirmation/review works with token-only links,
  - QB export contains active-company records only.

## Validation Results

- `npm run test:run`: passed, 10 test files and 138 tests.
- `npm run build`: passed. Vite reported `[base44] Proxy not enabled (VITE_BASE44_APP_BASE_URL not set)`, which is expected for local builds without a Base44 proxy URL.
- `npm run lint`: failed on 68 legacy unused-import errors outside Phase 2 scope.
- Targeted Phase 2 lint: passed for all modified JS/JSX helper, page, component, and test files.
- New Base44 function/helper lint: passed for `accessControl.ts`, `migrateCompanyOwnership/entry.ts`, and `resolveSigningGrant/entry.ts`.

## Recommended Next Phase

Phase 3 should add server-side portal grant resolution and relationship-map functions for parent activity records (`LeadActivity`, `EstimateActivity`, `ChangeOrderActivity`, `VendorComplianceDocument`, and attachment-style records).
