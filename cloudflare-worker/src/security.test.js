import { describe, expect, test } from 'vitest';
import {
  buildCorsHeaders,
  fileKeyMatchesJob,
  isCorsAllowed,
  isSafeJobId,
  isSafeR2Key,
  sanitizeFileName,
} from './security.js';

function requestWithOrigin(origin) {
  return new Request('https://worker.example.test/files/read-url', {
    headers: origin ? { Origin: origin } : {},
  });
}

describe('R2 key validation', () => {
  test('accepts job-scoped keys', () => {
    expect(isSafeR2Key('jobs/job_123/file.pdf')).toBe(true);
    expect(isSafeR2Key('jobs/job-123/public-signing/session_1/signature.png', { publicSigning: true })).toBe(true);
  });

  test('rejects traversal and arbitrary keys', () => {
    expect(isSafeR2Key('../secret.pdf')).toBe(false);
    expect(isSafeR2Key('jobs/job-1/../secret.pdf')).toBe(false);
    expect(isSafeR2Key('/jobs/job-1/file.pdf')).toBe(false);
    expect(isSafeR2Key('jobs/job-1//file.pdf')).toBe(false);
    expect(isSafeR2Key('jobs/job-1/%2e%2e/file.pdf')).toBe(false);
    expect(isSafeR2Key('company/co-a/file.pdf')).toBe(false);
  });

  test('matches keys to expected job id', () => {
    expect(fileKeyMatchesJob('jobs/job-1/file.pdf', 'job-1')).toBe(true);
    expect(fileKeyMatchesJob('jobs/job-2/file.pdf', 'job-1')).toBe(false);
  });

  test('sanitizes filenames before key construction', () => {
    expect(sanitizeFileName('../invoice.pdf')).toBe('invoice.pdf');
    expect(sanitizeFileName('bad/name\\receipt?.pdf')).toBe('receipt_.pdf');
    expect(sanitizeFileName('..')).toBe('file');
  });

  test('rejects unsafe job ids', () => {
    expect(isSafeJobId('job_123-abc')).toBe(true);
    expect(isSafeJobId('../job')).toBe(false);
    expect(isSafeJobId('')).toBe(false);
  });
});

describe('Worker CORS policy', () => {
  test('allows configured origins only', () => {
    const env = { ALLOWED_ORIGINS: 'https://app.example.com,https://admin.example.com' };
    expect(isCorsAllowed(requestWithOrigin('https://app.example.com'), env)).toBe(true);
    expect(isCorsAllowed(requestWithOrigin('https://evil.example.com'), env)).toBe(false);
  });

  test('buildCorsHeaders echoes only allowed origin', () => {
    const env = { ALLOWED_ORIGINS: 'https://app.example.com' };
    expect(buildCorsHeaders(requestWithOrigin('https://app.example.com'), env)['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(buildCorsHeaders(requestWithOrigin('https://evil.example.com'), env)['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
