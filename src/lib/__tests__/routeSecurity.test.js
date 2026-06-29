import { describe, expect, test } from 'vitest';
import {
  canBypassUnlock,
  getPublicGrantToken,
  hasSelectedCompany,
  shouldRequireUnlock,
} from '../routeSecurity';

describe('public route unlock policy', () => {
  test('allows signing and approval routes only when a grant token is present', () => {
    expect(canBypassUnlock('/signature', '?token=abc')).toBe(true);
    expect(canBypassUnlock('/approval', '?approval_token=abc')).toBe(true);
    expect(canBypassUnlock('/approve', '?signatureToken=abc')).toBe(true);
    expect(shouldRequireUnlock('/signature', '')).toBe(true);
  });

  test('allows portal routes only when their access token is present', () => {
    expect(canBypassUnlock('/portal/client', '?token=portal-1')).toBe(true);
    expect(canBypassUnlock('/portal/vendor', '?token=portal-2')).toBe(true);
    expect(shouldRequireUnlock('/portal/client', '')).toBe(true);
  });

  test('does not let token query strings bypass unrelated private routes', () => {
    expect(shouldRequireUnlock('/dashboard', '?token=abc')).toBe(true);
    expect(shouldRequireUnlock('/admin', '?approval_token=abc')).toBe(true);
  });

  test('normalizes public grant token names', () => {
    expect(getPublicGrantToken('?signature_token=sig')).toBe('sig');
    expect(getPublicGrantToken('?approvalToken=app')).toBe('app');
  });
});

describe('company guard selection policy', () => {
  test('requires a concrete active company id', () => {
    expect(hasSelectedCompany({ id: 'co-a' })).toBe(true);
    expect(hasSelectedCompany('co-a')).toBe(true);
    expect(hasSelectedCompany({})).toBe(false);
    expect(hasSelectedCompany(null)).toBe(false);
  });
});
