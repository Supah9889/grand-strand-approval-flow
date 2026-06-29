# Security Hardening Phase 1B Review

Date: 2026-06-29

## Verdict

Pass with warnings.

Phase 1B verified and tightened the Phase 1 company isolation, route guard, backend R2, and test setup work. The application builds and the security/unit test suite passes. Full project lint still fails because of pre-existing unused-import debt in unrelated legacy files, but the Phase 1B touch set is lint-clean.

## What Was Verified

- No hook-order regressions were found in the Phase 1 guard/query changes.
- Admin-only routes in `src/App.jsx` still require `isAdmin()` and company-required admin pages remain wrapped with `CompanyGuard`.
- Public signing/approval routes remain token-gated and do not bypass unlock without a grant token.
- Token-based client/vendor portal routes can bypass the internal unlock gate only when a `token` query param is present.
- Company-required routes now require a concrete active company id, not just a truthy session object.
- Dashboard, search, financial, field, restoration, work-order, task, daily-log, calendar, navigation, and audit queries were rechecked for broad operational `list()` usage.
- Base44 R2 function entrypoints and duplicate shared function helpers were checked for drift.
- Worker R2 key validation, traversal rejection, method restrictions, and CORS allowlist behavior were rechecked.

## What Was Fixed

- Added `src/lib/routeSecurity.js` to centralize public route and company selection policy.
- Updated `src/App.jsx` to use the centralized route security policy.
- Updated `src/components/CompanyGuard.jsx` so company-required pages fail closed unless the active company has an id.
- Fixed public portal unlock behavior for `/portal/client?token=...` and `/portal/vendor?token=...`.
- Replaced `VendorPortal` broad `Job.list()` usage with token-derived per-job lookups.
- Scoped active and pending time-entry queries by `company_id` in:
  - `src/pages/ManagerDashboard.jsx`
  - `src/pages/FieldDashboard.jsx`
  - `src/pages/GSCPField.jsx`
  - `src/pages/TimeClock.jsx`
  - `src/pages/TimeEntries.jsx`
- Scoped admin manual-entry employee options in `src/pages/TimeEntries.jsx` through active-company `CompanyMembership` rows.
- Removed global employee/vendor filter lookups from:
  - `src/pages/CalendarPage.jsx`
  - `src/pages/AuditLogPage.jsx`
- Fixed `src/pages/SubcontractVisibility.jsx` broad fallback queries when no company is selected.
- Aligned duplicate Base44 shared R2 helper behavior in `base44/functions/_shared/r2Proxy/entry.ts`.
- Updated duplicate signature-grant entry path to issue company-aware grants when that path is deployed.
- Removed unused imports in Phase 1/1B touched files only.

## Tests Added

- `src/lib/__tests__/routeSecurity.test.js`
  - Public signing grant route behavior.
  - Public portal token route behavior.
  - Private route token bypass prevention.
  - Company guard selection behavior.
- `src/lib/__tests__/companyScopedQueries.test.js`
  - Company job filter behavior.
  - Fail-closed behavior without active company.
  - Job-scoped child record batching without broad `list()` calls.
  - Scoped record filtering by job id.

## Validation Results

- `npm run lint`: fails with 70 unused-import errors in pre-existing unrelated files.
- Targeted Phase 1B lint: passes for all files modified in this review.
- `npm run test:run`: passes, 7 test files and 126 tests.
- `npm run build`: passes.

## Security Regression Matrix

| Area | Phase 1B status |
| --- | --- |
| Dashboard | Company job scope and job-child scope verified. |
| AdminOverview | Admin + company guard verified; job-child financial/audit reads scoped through active-company jobs. |
| Admin | Admin + company guard verified; jobs scoped through active company. |
| Financials | Jobs and child financial records scoped by active-company jobs. |
| Invoices | Invoices, payments, estimates, and change orders scoped by active-company jobs. |
| Payments | Payments and invoices scoped by active-company jobs. |
| Bills | Bills scoped by active-company jobs. |
| Expenses | Expenses scoped by active-company jobs. |
| JobSearch | Jobs scoped by active company. |
| GlobalSearch | Searches active-company jobs and job-child records only. |
| DailyLogs | Logs scoped by active-company jobs. |
| Tasks | Tasks scoped by active-company jobs. |
| CalendarPage | Events scoped by active-company jobs; staff filter now derives from scoped events only. |
| WorkOrders | Work orders scoped by `company_id`. |
| TimeEntries | Entries scoped by active company; admin employee options scoped through active-company memberships. |
| FieldDashboard | Jobs, schedule, work orders, and active time entries scoped by active company. |
| FieldSchedule | Schedule and jobs scoped by active company. |
| ManagerDashboard | Fixed time-entry leakage; all dashboard reads now include active company scope. |
| RestorationHub | Restoration jobs/readings/logs/samples/equipment scoped by active company. |
| MoistureReadings | Scoped by `company_id`. |
| DryingLogs | Scoped by `company_id`. |
| AirSamples | Scoped by `company_id`. |
| Equipment | Equipment and jobs scoped by active company. |
| Templates | Job/work-order/documentation templates scoped by active company. |
| Sidebar | Navigation hides company-dependent groups without active company; note badge scoped by active-company jobs. |
| BottomNav | Hides when unlocked but no active company is selected. |

## Schema Risk Recommendations

| Entity | Recommendation |
| --- | --- |
| `Vendor` | Needs `company_id` added or a vendor-company join table. Current vendor bank remains an admin/global risk. |
| `Lead` | Needs `company_id` added. Current `company_name` and optional `linked_job_id` are weaker than an immutable company id. |
| `Estimate` | Needs `company_id` added. Current filtering by `company_name` is temporary and fragile. |
| `Customer` | Already safely company scoped with required `company_id`. |
| `Subcontractor` | No standalone schema exists. Subcontractors are represented as `Vendor.type = subcontractor` and cross-company `WorkOrder` fields; use a relationship map if dedicated subcontractor records are added. |
| `JobContact` | Job-scoped and acceptable when parent job access is enforced. |
| `Property` | Already safely company scoped with required `company_id`; also links to `customer_id`. |
| `PurchaseOrder` | Job-scoped and acceptable when parent job access is enforced. Consider adding `company_id` for faster server filtering. |
| `Bill` | Job-scoped and acceptable when parent job access is enforced. `vendor_id` remains weaker until `Vendor` is scoped. |
| `Payment` | Job-scoped and acceptable when parent job access is enforced. |
| `Invoice` | Job-scoped and acceptable when parent job access is enforced; `customer_id` is secondary. |

## Backend Review Notes

- Primary Base44 function entrypoints validate authenticated user where required, company/job access, safe R2 keys, scoped public signing uploads, and safe errors.
- Duplicate Base44 function paths under `base44/functions/request*/entry/entry.ts` still exist. Phase 1B aligned their shared helper path so accidental deployment of that layout preserves the security assumptions.
- Signature grant validation intentionally keeps old tokens compatible by accepting missing `scope`/`companyId` while enforcing them when present.
- Cloudflare Worker rejects traversal, arbitrary buckets/prefixes, unsafe public signing keys, unsupported methods, and disallowed CORS origins.
- CORS remains fail-closed for browser origins unless `ALLOWED_ORIGINS` or `CORS_ALLOWED_ORIGINS` is configured.

## Remaining Risks

- Full lint still fails on 70 pre-existing unused-import errors outside Phase 1/1B.
- `Vendor`, `Lead`, and `Estimate` need schema-level `company_id` migrations.
- Public signing pages still load job display data by `jobId`; R2 actions are grant-validated, but a server-side "get signing job by grant" function would be stronger.
- Some detail pages still fetch by record id and then rely on UI/page context plus Base44 permissions. Server-side entity permissions should enforce company/job ownership.
- Global admin/export tools such as QuickBooks export, import utilities, access management, employee management, and legacy cleanup still need a separate admin/export hardening pass.
- Existing npm audit vulnerabilities were not remediated in Phase 1B.

## Manual Base44 Actions

- Deploy or confirm the intended Base44 function path for:
  - `requestR2ReadUrl`
  - `requestR2UploadUrl`
  - `requestSignatureAccessGrant`
- If Base44 deploys the nested `entry/entry.ts` files, verify `_shared/r2Proxy` is included/resolved correctly.
- Add schema migrations for `Vendor.company_id`, `Lead.company_id`, and `Estimate.company_id`.
- Backfill `PortalUser.job_id` for legacy rows that only have `linked_job_ids`.
- Confirm `CompanyMembership` rows exist for every employee who needs multi-company access.
- Configure server-side entity permissions in Base44 wherever available; frontend filtering is not a substitute for backend authorization.

## Manual Cloudflare Actions

- Deploy the updated Worker.
- Set `AUTH_SECRET`.
- Set `ALLOWED_ORIGINS` or `CORS_ALLOWED_ORIGINS` to production and approved preview app origins.
- Verify browser uploads from public signing pages succeed from allowed origins and fail from unapproved origins.
- Verify invalid keys such as `../x`, `/jobs/id/x`, `jobs/id/../x`, and encoded traversal are rejected.

## Recommended Next Phase

Phase 2 should be schema and server-side authorization hardening:

- Add and backfill `company_id` for vendor, lead, and estimate records.
- Replace remaining company-name filtering with immutable company ids.
- Add server-side record access functions for detail pages and public signing job display.
- Harden admin/export/import tools separately from operational workflows.
- Clean remaining lint debt so CI can enforce `npm run lint`.
