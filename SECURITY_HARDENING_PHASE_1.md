# Security Hardening Phase 1

Date: 2026-06-29

## What Changed

Phase 1 added centralized company-scope helpers, route-level company guards, scoped frontend data fetching for major operational and financial records, stricter R2 key validation, scoped signature grants, and a root Vitest test runner.

## Files Modified

- `src/lib/permissions.js`
- `src/hooks/usePermissions.js`
- `src/lib/companyScopedQueries.js`
- `src/lib/AuthContext.jsx`
- `src/lib/app-params.js`
- `src/App.jsx`
- `src/components/Sidebar.jsx`
- `src/components/BottomNav.jsx`
- `src/pages/Admin.jsx`
- `src/pages/AdminOverview.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/JobSearch.jsx`
- `src/pages/GlobalSearch.jsx`
- `src/pages/Financials.jsx`
- `src/pages/Invoices.jsx`
- `src/pages/PaymentsPage.jsx`
- `src/pages/Bills.jsx`
- `src/pages/Expenses.jsx`
- `src/pages/PurchaseOrders.jsx`
- `src/pages/Notes.jsx`
- `src/pages/JobComms.jsx`
- `src/pages/AuditLogPage.jsx`
- `src/pages/ChangeOrders.jsx`
- `src/pages/ChangeOrderDetail.jsx`
- `src/pages/Estimates.jsx`
- `src/pages/EstimateDetail.jsx`
- `src/pages/PortalManager.jsx`
- `src/pages/DailyLogs.jsx`
- `src/pages/DailyLogDetail.jsx`
- `src/pages/Tasks.jsx`
- `src/pages/TaskDetail.jsx`
- `src/pages/CalendarPage.jsx`
- `src/pages/WorkOrders.jsx`
- `src/pages/TimeEntries.jsx`
- `src/pages/TimeEntryDetail.jsx`
- `src/pages/TimeClock.jsx`
- `src/pages/FieldDashboard.jsx`
- `src/pages/FieldSchedule.jsx`
- `src/pages/ManagerDashboard.jsx`
- `src/pages/RestorationHub.jsx`
- `src/pages/MoistureReadingsPage.jsx`
- `src/pages/DryingLogsPage.jsx`
- `src/pages/AirSamplesPage.jsx`
- `src/pages/EquipmentPage.jsx`
- `src/pages/JobTemplatesPage.jsx`
- `src/pages/WorkOrderTemplatesPage.jsx`
- `src/pages/DocumentationRequirementsPage.jsx`
- `src/pages/GSCPField.jsx`
- `src/components/JobContextSidebar.jsx`
- `src/components/workorders/WorkOrderModal.jsx`
- `base44/functions/requestR2ReadUrl/entry.ts`
- `base44/functions/requestR2UploadUrl/entry.ts`
- `base44/functions/requestSignatureAccessGrant/entry.ts`
- `base44/functions/_shared/r2Proxy/entry.ts`
- `cloudflare-worker/src/index.js`
- `cloudflare-worker/src/security.js`
- `cloudflare-worker/src/security.test.js`
- `src/lib/__tests__/permissionsScope.test.js`
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `vitest.config.js`

## Permission Model Summary

- Active company comes from `active_company` session storage and is exposed through `getActiveCompanyId`.
- Company access is granted through the active company or active `CompanyMembership` records.
- Job child records such as invoices, payments, bills, expenses, daily logs, tasks, files, audit logs, and schedule records are scoped through parent `Job.company_id`.
- Helpers fail closed when company ownership cannot be inferred without supplied parent job context.
- Route protection now combines internal unlock auth, admin-only checks, and company-required guards.

## Backend And R2 Changes

- Base44 R2 functions validate authenticated users where required.
- Job access now requires matching company membership before admin or assignment access is accepted.
- R2 keys must be under `jobs/{jobId}/...`, cannot contain traversal segments, encoded traversal, leading slashes, backslashes, empty segments, or control characters.
- Public signing upload keys are restricted to `jobs/{jobId}/public-signing/{sessionId}/{fileName}`.
- Signature grants now include `scope`, `companyId`, `iat`, `exp`, and `nonce`; maximum TTL is 7 days.
- Cloudflare Worker now restricts methods, validates CORS against `ALLOWED_ORIGINS` or `CORS_ALLOWED_ORIGINS`, sanitizes uploaded filenames, and validates keys before read/upload/head/delete.

## Remaining Risks

- `Vendor` has no `company_id` or ownership relationship in `base44/entities/Vendor.jsonc`; vendor master-data views remain a global/admin risk until the schema is changed.
- `Employee` and some access-management views are global administrative data by design; they need final product decision on whether they should be platform-global or company-scoped.
- `Lead`, `Estimate`, and some template/config records lack strong company ids. Estimates are temporarily filtered by `company_name`, which is weaker than `company_id`.
- Legacy `PortalUser` records that only use `linked_job_ids` cannot be server-filtered by job without a migration to populate `job_id`.
- Buildertrend import, QuickBooks export, cost-code analytics, and legacy cleanup tools still contain broad admin reads and should be handled in a separate admin/export hardening pass.
- Some entities rely on `job_id` only. Queries are scoped in major pages, but Base44 should still enforce server-side entity permissions where available.
- Public signing pages still display job data by `jobId`; R2 upload/read actions are token-validated, but a dedicated server-side "get signing job by grant" function would be stronger.
- Existing lint debt remains: `npm run lint` fails on unused imports across many pre-existing files.
- `npm install` reports existing dependency audit findings; no broad dependency upgrade was performed.

## Manual QA Checklist

- Sign in as owner/admin, select Company A, verify dashboards/search/financials show only Company A records.
- Switch to Company B and confirm cached/search/financial data changes to Company B only.
- Visit company-required routes with no active company and confirm the company selection guard renders.
- Confirm non-admin users cannot render admin routes by direct URL.
- Create an invoice/payment/bill/expense and verify it is linked to an active-company job.
- Use a valid signing grant and confirm public signing upload/read still succeeds.
- Try invalid R2 keys such as `../x`, `/jobs/id/x`, and `jobs/id/../x`; confirm safe errors.
- Confirm Worker preflight succeeds only for configured allowed app origins.

## Base44 Deployment Notes

- Deploy updated functions:
  - `requestR2ReadUrl`
  - `requestR2UploadUrl`
  - `requestSignatureAccessGrant`
- Ensure Base44 function environment variables are set:
  - `R2_WORKER_BASE_URL`
  - `R2_WORKER_AUTH_SECRET`
  - `SIGNING_GRANT_SECRET` if separate from the Worker auth secret
- Confirm all employees who need cross-company work have active `CompanyMembership` rows for each company.
- Consider adding `company_id` or a scoped join entity to `Vendor`.

## Cloudflare Worker Deployment Notes

- Deploy the updated Worker after setting:
  - `AUTH_SECRET`
  - `ALLOWED_ORIGINS` or `CORS_ALLOWED_ORIGINS`
- `ALLOWED_ORIGINS` should be a comma-separated list of the production Base44 app origins and approved preview origins.
- Public signing upload URLs depend on CORS; missing allowed origins will block browser uploads by design.

## Validation

- `npm install` completed.
- `npm run test:run` passed: 5 test files, 116 tests.
- `npm run build` passed.
- `npm run lint` failed on existing unused-import violations.
