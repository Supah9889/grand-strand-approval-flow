# Grand Strand Construction Management App

A comprehensive construction management system built with Base44, React, and Tailwind CSS.

## Architecture

### Base44 App (This Repository)
- React frontend with job management, time tracking, invoicing, and reporting
- Base44 backend functions for R2 file management and integrations
- Mobile-optimized responsive design

### Cloudflare Worker (Separate Repository)
The R2 proxy Worker and other backend Worker functions are maintained separately:
- **Repository**: https://github.com/Supah9889/grand-strand-worker
- **Purpose**: Handles R2 signed URL generation, file operations, and external integrations
- **Deployment**: Deployed independently to Cloudflare Workers

Refer to that repository for Worker development, updates, and configuration.

## Development

```bash
npm install
npm run dev      # Start local dev server
npm run lint     # Run linter
npm run build    # Production build
```

## License

Proprietary — Grand Strand Construction