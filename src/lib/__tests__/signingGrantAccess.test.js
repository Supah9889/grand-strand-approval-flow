import { describe, expect, test } from 'vitest';
import { validateSigningGrantPayload } from '../signingGrantAccess';

describe('public signing grant access', () => {
  const now = 1000;
  const job = {
    id: 'job-1',
    company_id: 'co-a',
    customer_name: 'Jane Customer',
    customer_email: 'jane@example.test',
    status: 'pending',
    locked: false,
  };

  test('resolves valid signing context', () => {
    const result = validateSigningGrantPayload({
      scope: 'job-signature',
      jobId: 'job-1',
      companyId: 'co-a',
      exp: now + 60,
    }, job, now);

    expect(result.ok).toBe(true);
    expect(result.context.companyId).toBe('co-a');
    expect(result.context.customer.email).toBe('jane@example.test');
    expect(result.context.canSign).toBe(true);
  });

  test('fails closed for expired, wrong job, wrong company, and wrong scope', () => {
    expect(validateSigningGrantPayload({ jobId: 'job-1', exp: now - 1 }, job, now).reason).toBe('expired');
    expect(validateSigningGrantPayload({ jobId: 'job-x', exp: now + 60 }, job, now).reason).toBe('job_mismatch');
    expect(validateSigningGrantPayload({ jobId: 'job-1', companyId: 'co-b', exp: now + 60 }, job, now).reason).toBe('company_mismatch');
    expect(validateSigningGrantPayload({ jobId: 'job-1', scope: 'other', exp: now + 60 }, job, now).reason).toBe('invalid_scope');
  });

  test('locked jobs resolve context but cannot be signed again', () => {
    const result = validateSigningGrantPayload({ jobId: 'job-1', companyId: 'co-a', exp: now + 60 }, {
      ...job,
      locked: true,
      status: 'approved',
    }, now);

    expect(result.ok).toBe(true);
    expect(result.context.canSign).toBe(false);
  });
});
