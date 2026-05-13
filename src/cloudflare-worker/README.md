# Cloudflare Worker — Maintenance Notice

⚠️ **This folder is deprecated and kept for historical reference only.**

The actual Cloudflare Worker implementation has been moved to a separate repository to streamline deployment and maintenance.

## Active Worker Repository

All Worker development, R2 proxy functions, and backend integrations are now maintained at:

👉 **https://github.com/Supah9889/grand-strand-worker**

### What's there:
- R2 signed URL generation
- File upload/download proxies
- External API integrations
- Worker configuration and deployment scripts

### What was here:
- Legacy code using outdated R2 methods (e.g., `createPresignedUrl()`)
- Development notes from early iterations

## For Contributors

If you need to:
- **Add a new Worker endpoint** → Clone and PR the `grand-strand-worker` repo
- **Update R2 operations** → Modify the Worker repo, deploy independently
- **Fix app-side API calls** → Check `functions/` and `lib/` in this Base44 app repo

Please refer to the Worker repository's README and contributing guidelines.