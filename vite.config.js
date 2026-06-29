import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isTest = mode === 'test' || process.env.VITEST === 'true';

  return {
    logLevel: 'error', // Suppress warnings, only show errors
    plugins: [
      !isTest && base44({
        // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
        // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
        hmrNotifier: true,
        navigationNotifier: true,
        analyticsTracker: true,
        visualEditAgent: true
      }),
      react(),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'node',
      globals: true,
      include: [
        'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
        'cloudflare-worker/src/**/*.{test,spec}.{js,ts}',
      ],
    },
  };
});
