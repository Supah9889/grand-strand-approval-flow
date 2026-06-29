# Employee Onboarding Flow

## Admin Workflow

1. Open `Employees`.
2. Click `Add`.
3. Enter employee name, email, optional phone, role, company assignments, and default company.
4. Choose whether the employee sets their own PIN during acceptance.
5. Choose `Send invite now` or save a draft.
6. If sending now, use automatic email delivery when available or copy the generated message/link manually.

The admin UI now creates an `EmployeeInvite` record through `createEmployeeInvite`. The frontend no longer generates or stores raw invite tokens.

## Invite Lifecycle

Statuses:

- `draft`: Admin saved an invite that has not been issued.
- `sent`: Server generated a one-time token hash and returned a one-time invite link.
- `accepted`: Employee completed setup and the token hash was consumed.
- `expired`: Invite is past `expires_at`.
- `revoked`: Admin revoked the invite and company access is deactivated.

Raw invite tokens are only present in the one-time link returned by create/resend functions. Normal list contexts use `sanitizeInviteForList` and the app stores only `invite_token_hash`.

## Employee Acceptance Workflow

Public route:

```text
/accept-invite?token=...
```

Flow:

1. `resolveEmployeeInvite` hashes the token and returns safe invite context.
2. Employee confirms their email.
3. Employee sets a PIN when required.
4. `acceptEmployeeInvite` validates token, status, expiration, and email.
5. The function creates or updates the `Employee` record.
6. The function creates or updates `CompanyMembership` records.
7. The function marks the invite `accepted` and clears `invite_token_hash`.
8. The app starts the existing internal session and redirects to `/dashboard`.

Invalid, expired, revoked, draft, or accepted invites fail closed.

## Role And Company Assignment Model

Internal invite roles:

- `owner`
- `admin`
- `manager`
- `office`
- `field`

Employee session mapping:

- `owner` maps to owner session.
- `admin` maps to admin session.
- `manager`, `office`, and `field` map to staff session and rely on `CompanyMembership` for data access.

Company membership mapping:

- `owner` -> `owner`
- `admin` -> `operations_admin` with `full_admin`
- `manager` -> `operations_admin`
- `office` -> `office_support`
- `field` -> `field_technician`

Vendor/client portal users remain separate and should continue to use portal grant flows.

## Security Notes

- Invite tokens are generated server-side using cryptographic randomness.
- Only SHA-256 token hashes are stored.
- Create, resend, and revoke require owner/admin server-side checks.
- Resolve and accept accept only a token.
- Accepted invites are single-use because the token hash is cleared.
- Revoking an invite deactivates the pending employee and company memberships.
- Deactivating an employee from the UI also deactivates company memberships.

## Manual Testing Checklist

- Create a draft invite and verify no invite link is shown.
- Create a sent invite and verify the link opens `/accept-invite`.
- Confirm wrong email cannot accept the invite.
- Confirm short PIN is rejected when PIN setup is required.
- Accept an invite and verify Employee becomes active.
- Verify CompanyMembership records exist for assigned companies.
- Reopen the same link and confirm it fails closed.
- Resend an invite and verify old accepted links remain unusable.
- Revoke a sent invite and confirm the link fails closed.
- Confirm deactivated employees cannot pass the access gate.

## Known Limitations

- Automatic email depends on existing Base44 `Core.SendEmail` behavior and approved sender configuration.
- Manual-copy invite delivery remains the fallback when email fails or senders are not configured.
- Existing legacy `/verify-invite` links are retained for backward compatibility, but new invites use `/accept-invite`.
- Base44 schema/function deployment is required before this flow works in hosted environments.

## Next Improvements

- Add an invite history table in Employee detail.
- Add server-side email dispatch if Base44 exposes a safe function-side email API.
- Add a dedicated role profile editor for `manager`, `office`, and `field` defaults.
- Add audit log records directly inside invite functions.
