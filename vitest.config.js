import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
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
});
