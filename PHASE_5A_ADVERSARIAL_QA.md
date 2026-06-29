# Phase 5A Adversarial QA / Leak Test

Date: 2026-06-29

## Verdict

PASS WITH WARNINGS.

The highest-confidence cross-company and stale-session defects found during this pass were patched. Tests and build pass. Full lint still fails on legacy unused-import debt outside the Phase 5A changes.

## Critical Defects Patched

- Active company selection no longer lists every active company for employee sessions.
- Company-required routes now verify that employee sessions have active membership in the selected company.
- Permission helpers no longer trust `active_company` alone as proof of company access.
- Employee-backed internal sessions are revalidated against the current Employee record and are logged out if disabled, missing, or role-drifted.
- React Query cache is cleared when switching companies to reduce stale cross-company cache exposure.
- Admin reporting job counts are scoped to the selected company.
- Cost-code usage counts for expenses, bills, invoices, estimates, and time entries are scoped to the selected company.
- Daily log create/update now stamps `company_id` and rejects job IDs outside the selected company.
- TimeClock re-checks for an open entry before clock-in to prevent duplicate open punches from multiple tabs.
- Portal token helper tests now cover inactive/revoked status, invite-token aliases, and exact expiry.
- R2 key tests now cover double-encoded traversal and strict public-signing key shape.

## Remaining Risks

- PortalUser still stores raw portal tokens. EmployeeInvite uses hashed tokens, but portal grants should move to hash-at-rest.
- Authenticated private R2 uploads rely on metadata checks before issuing presigned URLs; final byte-size enforcement is not guaranteed for direct presigned uploads.
- Several entities inherit ownership through `job_id` only. That is acceptable where scoped helpers are used, but broad `list()` calls remain high risk.
- Legacy global/admin pages still have broad reads and should be reviewed before external or wider employee rollout.
- Full ESLint is blocked by legacy unused imports, which can hide newly introduced lint failures until cleaned.
- Live Base44 function behavior still needs smoke testing with real deployed schemas, functions, and Cloudflare env vars.

## Validation

- `npm run test:run`: 14 files, 167 tests passed.
- `npm run build`: passed.
- Targeted lint on Phase 5A files: passed.
- `npm run lint`: failed on 66 legacy unused-import errors outside Phase 5A changes.

## Employee Rollout Blockers

- Deploy and smoke-test Base44 schemas/functions from Phases 1-4.
- Confirm CompanyMembership records for every employee before enabling access.
- Clean or explicitly baseline full lint debt.
- Verify Cloudflare Worker `ALLOWED_ORIGINS` or `CORS_ALLOWED_ORIGINS`, `AUTH_SECRET`, R2 bucket binding, and signing secrets in staging.
- Run manual QA for invite acceptance, company switch, disabled employee logout, portal token expiry, and file read/upload paths.
