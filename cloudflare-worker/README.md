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
| GET | /health | Health check |
| POST | /files/upload-url | Get a signed URL for a private upload (not yet implemented) |
| POST | /files/read-url | Get a signed URL to read a private file (not yet implemented) |

## Deployment

cd cloudflare-worker
npm install
npx wrangler deploy

## Next Steps

- Implement auth and permission checks in the Worker
- Wire /files/upload-url to R2 signed upload logic
- Wire /files/read-url to R2 signed read logic
- Update the app to use this Worker instead of Base44 UploadFile
- Migrate file fields from public URLs to private R2 keys
