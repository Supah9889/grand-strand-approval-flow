# Grand Strand Worker

Cloudflare Worker for secure private file storage access.

## What This Is

This Worker is the secure file API layer between the Grand Strand Approval Flow app and a private Cloudflare R2 storage bucket. The app currently stores files via Base44 UploadFile which produces public URLs. This Worker replaces that with private R2 storage and short-lived signed URLs.

## Security Rules

- R2 credentials and secrets are NEVER stored in frontend code or committed to GitHub
- Secrets are added via: npx wrangler secret put SECRET_NAME
- The app must never hold permanent public file URLs for private documents
- Every file access goes through this Worker for permission checks

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check - no auth required |
| POST | /files/upload-url | Get a signed URL for a private upload |
| POST | /files/read-url | Get a signed URL to read a private file |

## Auth

All routes except /health require an Authorization header:
Authorization: Bearer <AUTH_SECRET>

AUTH_SECRET is set via: npx wrangler secret put AUTH_SECRET
Never hardcode it anywhere.

## Deployment

cd cloudflare-worker
npm install
npx wrangler deploy

## Next Steps

- Set AUTH_SECRET via wrangler secret put
- Deploy the Worker
- Update the app to request signed URLs from this Worker instead of using Base44 UploadFile
- Migrate file fields from public URLs to private R2 keys
