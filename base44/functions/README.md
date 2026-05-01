# Base44 R2 proxy functions

These backend functions are the server-side proxy between the React app and the Cloudflare Worker that issues private R2 signed URLs.

Flow:

```text
React app -> Base44 backend function -> Cloudflare Worker -> private R2
```

The React app must never receive or store the Cloudflare Worker `AUTH_SECRET`. These functions read the Worker URL and bearer secret from protected Base44 function environment variables, validate the current Base44 user/session, perform conservative role/job permission checks, and return only short-lived signed URLs.

## Functions

### `requestR2UploadUrl`

Called from React with:

```js
await base44.functions.invoke("requestR2UploadUrl", {
  jobId,
  fileName: file.name,
  fileType: file.type,
  fileSize: file.size,
  category: "photo",
  purpose: "job_file_upload",
});
```

Returns:

```js
{
  uploadUrl,
  fileKey,
  r2Key,
  expiresIn,
  metadata
}
```

### `requestR2ReadUrl`

Called from React with either an R2 key or existing file metadata:

```js
await base44.functions.invoke("requestR2ReadUrl", {
  jobId,
  fileKey: file.r2_key,
  category: file.category,
  purpose: "preview",
});
```

Returns:

```js
{
  readUrl,
  signedUrl,
  fileKey,
  r2Key,
  expiresIn
}
```

## Required server-side secrets

Configure these as Base44 project secrets, not frontend environment variables:

```text
R2_WORKER_BASE_URL=https://your-worker.your-subdomain.workers.dev
R2_WORKER_AUTH_SECRET=<same value configured as the Worker AUTH_SECRET>
```

Use the Base44 CLI:

```powershell
base44 secrets set R2_WORKER_BASE_URL=https://your-worker.your-subdomain.workers.dev
base44 secrets set R2_WORKER_AUTH_SECRET=your-secret-value
```

Base44 exposes secrets to backend functions through `Deno.env.get()`. Do not add these values to `.env`, Vite env vars, React code, or committed files.

## Current permission model

- A valid Base44 user/session is required.
- The function attempts to map the current user email to an active `Employee` record.
- `owner` and `admin` can request upload/read URLs for job-scoped files.
- `staff` must be assigned to the job through `JobAssignment`.
- `staff` must have document read permission for read URLs.
- `staff` uploads are limited to non-legal operational categories such as job photos and field documentation.
- Protected legal, signed, financial, vendor, and contract-style uploads are admin/owner only for now.
- File keys must be scoped to `jobs/{jobId}/...` for read requests.

Deletion is intentionally not included.

## Limitations

- These functions do not yet create or update `JobFile` or `SignatureRecord` records.
- Existing public URL fallback behavior remains unchanged.
- Portal token access is not implemented here.
- The current Worker returns 5-minute signed URLs. If that changes, update the `expiresIn` default returned by these functions.
