import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, UserCheck, Clock } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';
import { audit } from '@/lib/audit';

// Token states: loading | pending | confirmed | already_confirmed | expired | revoked | invalid
export default function VerifyInvite() {
  const [status, setStatus] = useState('loading');
  const [employee, setEmployee] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('verify_token');

    if (!token) {
      setStatus('invalid');
      return;
    }

    (async () => {
      // Look up by token
      const employees = await base44.entities.Employee.filter({ invite_token: token });

      if (!employees || employees.length === 0) {
        // Token not found — could be already consumed (confirmed) or never existed
        // Try to find by a recently confirmed employee — but we can't look up by old token since it's nulled.
        // Show a friendly already-confirmed message as it's the most common case.
        setStatus('already_confirmed');
        return;
      }

      const emp = employees[0];

      // Token exists — check its state
      if (emp.invite_status === 'confirmed' || emp.verification_status === 'verified') {
        setEmployee(emp);
        setStatus('already_confirmed');
        return;
      }

      // Check expiry
      if (emp.invite_token_expires && new Date(emp.invite_token_expires) < new Date()) {
        // Mark as expired in DB
        await base44.entities.Employee.update(emp.id, { invite_status: 'expired' });
        setEmployee(emp);
        setStatus('expired');
        return;
      }

      // Token is valid and active — show confirmation screen (DO NOT consume yet)
      setEmployee(emp);
      setStatus('pending');
    })();
  }, []);

  const handleConfirm = async () => {
    if (!employee) return;
    setConfirming(true);
    try {
      // Only NOW mark as confirmed and consume the token
      await base44.entities.Employee.update(employee.id, {
        invite_status: 'confirmed',
        verification_status: 'verified',
        verification_date: new Date().toISOString(),
        invite_token: null, // consume token
      });

      audit.employee.inviteConfirmed(employee.id, 'system', employee.name);

      setStatus('confirmed');
    } catch (err) {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        <div className="flex justify-center">
          <CompanyLogo className="h-14 w-auto" />
        </div>

        <div className="bg-white border border-border rounded-2xl shadow-lg p-8 space-y-5">

          {/* Loading */}
          {status === 'loading' && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Checking your invite link…</p>
            </>
          )}

          {/* Pending — show confirm button */}
          {status === 'pending' && (
            <>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <UserCheck className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-foreground">You're invited!</h1>
                {employee?.name && (
                  <p className="text-sm text-muted-foreground">Hi {employee.name}, welcome to Grand Strand Custom Painting.</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Click the button below to confirm your account and activate your employee code.
                </p>
                {employee?.employee_code && (
                  <div className="mt-3 bg-muted/40 rounded-xl px-3 py-2 text-left">
                    <p className="text-xs text-muted-foreground">Your employee code:</p>
                    <p className="text-base font-mono font-bold text-foreground">{employee.employee_code}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full h-11 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                {confirming ? 'Confirming…' : 'Confirm & Join Team'}
              </button>
            </>
          )}

          {/* Successfully confirmed just now */}
          {status === 'confirmed' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-foreground">You're all set!</h1>
                {employee?.name && <p className="text-sm text-muted-foreground">Welcome, {employee.name}.</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  Your account is confirmed. Use your employee code at the time clock to clock in.
                </p>
                {employee?.employee_code && (
                  <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <p className="text-xs text-muted-foreground">Your employee code:</p>
                    <p className="text-base font-mono font-bold text-emerald-700">{employee.employee_code}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Already confirmed previously */}
          {status === 'already_confirmed' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-foreground">Already Confirmed</h1>
                {employee?.name && <p className="text-sm text-muted-foreground">Hi {employee.name}.</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  Your invite has already been confirmed. You're good to go — use your employee code to access the time clock.
                </p>
              </div>
            </>
          )}

          {/* Expired */}
          {status === 'expired' && (
            <>
              <Clock className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-foreground">Link Expired</h1>
                <p className="text-xs text-muted-foreground mt-2">
                  This invite link has expired. Please contact your manager to request a new invite.
                </p>
              </div>
            </>
          )}

          {/* Revoked */}
          {status === 'revoked' && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-foreground">Invite Revoked</h1>
                <p className="text-xs text-muted-foreground mt-2">
                  This invite has been revoked. Please contact your manager if you believe this is a mistake.
                </p>
              </div>
            </>
          )}

          {/* Truly invalid / not found */}
          {status === 'invalid' && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-foreground">Link Not Found</h1>
                <p className="text-xs text-muted-foreground mt-2">
                  This link appears to be incomplete or incorrect. Please use the link directly from your invite email.
                </p>
              </div>
            </>
          )}

        </div>

        <p className="text-xs text-muted-foreground">Grand Strand Custom Painting · Employee Portal</p>
      </motion.div>
    </div>
  );
}