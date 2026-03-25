import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';

export default function VerifyInvite() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | expired | invalid
  const [employeeName, setEmployeeName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('verify_token');

    if (!token) {
      setStatus('invalid');
      return;
    }

    (async () => {
      // Find employee with matching token
      const employees = await base44.entities.Employee.filter({ invite_token: token });

      if (!employees || employees.length === 0) {
        setStatus('invalid');
        return;
      }

      const employee = employees[0];

      // Check expiry
      if (employee.invite_token_expires && new Date(employee.invite_token_expires) < new Date()) {
        // Mark as expired
        await base44.entities.Employee.update(employee.id, { invite_status: 'expired' });
        setStatus('expired');
        return;
      }

      // Mark as confirmed/verified
      await base44.entities.Employee.update(employee.id, {
        invite_status: 'confirmed',
        verification_status: 'verified',
        verification_date: new Date().toISOString(),
        invite_token: null, // consume the token
      });

      setEmployeeName(employee.name);
      setStatus('success');
    })();
  }, []);

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

        <div className="bg-white border border-border rounded-2xl shadow-lg p-8 space-y-4">
          {status === 'loading' && (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Verifying your invite link…</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div>
                <h1 className="text-base font-semibold text-foreground">You're verified!</h1>
                {employeeName && <p className="text-sm text-muted-foreground mt-1">Welcome, {employeeName}.</p>}
                <p className="text-xs text-muted-foreground mt-2">
                  Your account has been confirmed. You can now use the time clock with your employee code.
                </p>
              </div>
              <button
                onClick={() => navigate('/time-clock')}
                className="w-full h-10 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors"
              >
                Go to Time Clock
              </button>
            </>
          )}

          {status === 'expired' && (
            <>
              <XCircle className="w-12 h-12 text-amber-500 mx-auto" />
              <div>
                <h1 className="text-base font-semibold text-foreground">Link Expired</h1>
                <p className="text-xs text-muted-foreground mt-2">
                  This invite link has expired. Please contact your manager to request a new one.
                </p>
              </div>
            </>
          )}

          {status === 'invalid' && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <div>
                <h1 className="text-base font-semibold text-foreground">Invalid Link</h1>
                <p className="text-xs text-muted-foreground mt-2">
                  This verification link is not valid or has already been used.
                </p>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">Grand Strand Custom Painting · Internal Portal</p>
      </motion.div>
    </div>
  );
}