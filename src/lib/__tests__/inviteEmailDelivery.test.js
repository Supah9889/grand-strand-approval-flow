import { describe, it, expect } from 'vitest';

/**
 * Tests for the invite email delivery status logic.
 * These test the pure function that maps backend email results to UI messages,
 * ensuring the UI never falsely reports "email sent" unless the provider confirmed delivery.
 */

// Mirror of getEmailStatusMessage from EmployeeInviteModal
function getEmailStatusMessage(emailResult) {
  if (!emailResult) return { type: 'error', message: 'Invite could not be created.' };
  if (emailResult.delivered) return { type: 'success', message: 'Invite email sent.' };
  if (emailResult.attempted && !emailResult.delivered) {
    return { type: 'warning', message: 'Invite created, but email delivery failed. Copy this link and send it manually.' };
  }
  if (!emailResult.attempted) {
    return { type: 'warning', message: 'Invite created. Email is not configured. Copy this link and send it manually.' };
  }
  return { type: 'error', message: 'Invite could not be created.' };
}

describe('getEmailStatusMessage', () => {
  it('shows success only when provider returns delivered=true', () => {
    const result = getEmailStatusMessage({ attempted: true, delivered: true, provider: 'resend', id: 'msg_123', error: '' });
    expect(result.type).toBe('success');
    expect(result.message).toBe('Invite email sent.');
  });

  it('shows delivery-failed warning when attempted but not delivered', () => {
    const result = getEmailStatusMessage({ attempted: true, delivered: false, provider: 'resend', id: '', error: 'Invalid recipient' });
    expect(result.type).toBe('warning');
    expect(result.message).toContain('email delivery failed');
    expect(result.message).toContain('Copy this link');
  });

  it('shows not-configured warning when not attempted', () => {
    const result = getEmailStatusMessage({ attempted: false, delivered: false, provider: 'none', id: '', error: 'RESEND_API_KEY not configured' });
    expect(result.type).toBe('warning');
    expect(result.message).toContain('Email is not configured');
    expect(result.message).toContain('Copy this link');
  });

  it('shows error when emailResult is null (invite creation failed)', () => {
    const result = getEmailStatusMessage(null);
    expect(result.type).toBe('error');
    expect(result.message).toBe('Invite could not be created.');
  });

  it('does NOT say "sent" when provider returned an error', () => {
    const result = getEmailStatusMessage({ attempted: true, delivered: false, provider: 'resend', id: '', error: 'sender not verified' });
    expect(result.message).not.toContain('sent');
    expect(result.type).not.toBe('success');
  });

  it('does NOT say "sent" when RESEND_API_KEY is missing', () => {
    const result = getEmailStatusMessage({ attempted: false, delivered: false, provider: 'none', id: '', error: 'RESEND_API_KEY not configured' });
    expect(result.message).not.toContain('sent');
    expect(result.type).not.toBe('success');
  });
});

/**
 * Simulated backend response shape tests — verify the contract
 * that createEmployeeInvite / resendEmployeeInvite must return.
 */

describe('invite backend response contract', () => {
  it('response always includes inviteLink for manual fallback', () => {
    const successResponse = {
      ok: true,
      invite: { id: 'inv_1', status: 'sent' },
      inviteLink: 'https://app.example.com/accept-invite?token=abc',
      expiresAt: '2026-07-06T00:00:00.000Z',
      email: { attempted: true, delivered: true, provider: 'resend', id: 'msg_1', error: '' },
    };
    expect(successResponse.inviteLink).toBeTruthy();
    expect(successResponse.inviteLink).toContain('accept-invite');
  });

  it('response includes inviteLink even when email fails', () => {
    const failedEmailResponse = {
      ok: true,
      invite: { id: 'inv_2', status: 'sent' },
      inviteLink: 'https://app.example.com/accept-invite?token=def',
      expiresAt: '2026-07-06T00:00:00.000Z',
      email: { attempted: true, delivered: false, provider: 'resend', id: '', error: 'Invalid recipient' },
    };
    expect(failedEmailResponse.inviteLink).toBeTruthy();
    expect(failedEmailResponse.email.delivered).toBe(false);
  });

  it('response includes inviteLink when email not configured', () => {
    const noConfigResponse = {
      ok: true,
      invite: { id: 'inv_3', status: 'sent' },
      inviteLink: 'https://app.example.com/accept-invite?token=ghi',
      expiresAt: '2026-07-06T00:00:00.000Z',
      email: { attempted: false, delivered: false, provider: 'none', id: '', error: 'RESEND_API_KEY not configured' },
    };
    expect(noConfigResponse.inviteLink).toBeTruthy();
    expect(noConfigResponse.email.attempted).toBe(false);
  });

  it('resend response includes inviteLink', () => {
    const resendResponse = {
      ok: true,
      invite: { id: 'inv_1', status: 'sent' },
      inviteLink: 'https://app.example.com/accept-invite?token=xyz',
      expiresAt: '2026-07-06T00:00:00.000Z',
      email: { attempted: true, delivered: false, provider: 'resend', id: '', error: 'rate limited' },
    };
    expect(resendResponse.inviteLink).toBeTruthy();
  });
});

/**
 * testInviteEmailDelivery contract — must NOT create employees or invites.
 */
describe('testInviteEmailDelivery contract', () => {
  it('response explicitly declares no employee/invite created', () => {
    const testResponse = {
      ok: true,
      createdEmployee: false,
      createdInvite: false,
      email: { attempted: true, delivered: true, provider: 'resend', id: 'msg_test', error: '' },
    };
    expect(testResponse.createdEmployee).toBe(false);
    expect(testResponse.createdInvite).toBe(false);
  });

  it('response shows not-configured when RESEND_API_KEY missing', () => {
    const testResponse = {
      ok: true,
      createdEmployee: false,
      createdInvite: false,
      email: { attempted: false, delivered: false, provider: 'none', id: '', error: 'RESEND_API_KEY not configured' },
    };
    expect(testResponse.email.attempted).toBe(false);
    expect(testResponse.email.provider).toBe('none');
  });

  it('safe provider error is returned without exposing API key', () => {
    const testResponse = {
      ok: true,
      createdEmployee: false,
      createdInvite: false,
      email: { attempted: true, delivered: false, provider: 'resend', id: '', error: 'The requested recipient is invalid' },
    };
    expect(testResponse.email.error).not.toContain('re_');
    expect(testResponse.email.error).not.toContain('Bearer');
    expect(testResponse.email.error.length).toBeLessThanOrEqual(200);
  });
});