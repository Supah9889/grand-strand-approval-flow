import React, { useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Lock, CheckCircle2, UserCheck } from 'lucide-react';
import CompanyLogo from '../components/CompanyLogo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loginAsEmployee } from '@/lib/adminAuth';

function InviteShell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <CompanyLogo className="h-14 w-auto mx-auto" />
        <div className="bg-white border border-border rounded-2xl shadow-lg p-7 space-y-5">
          {children}
        </div>
        <p className="text-xs text-muted-foreground">Grand Strand Approval Flow - Employee Invite</p>
      </div>
    </div>
  );
}

function InviteError({ message }) {
  return (
    <InviteShell>
      <Lock className="w-10 h-10 text-muted-foreground/40 mx-auto" />
      <div>
        <p className="text-base font-semibold text-foreground">Invite Unavailable</p>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </div>
    </InviteShell>
  );
}

export default function AcceptInvite() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get('token') || '', []);
  const [email, setEmail] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [error, setError] = useState('');

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ['employee-invite-resolve', token],
    queryFn: async () => {
      const response = await base44.functions.invoke('resolveEmployeeInvite', { token });
      const data = response?.data || response;
      return data.invite;
    },
    enabled: !!token,
    retry: false,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('acceptEmployeeInvite', {
        token,
        email,
        employee_code: employeeCode,
      });
      return response?.data || response;
    },
    onSuccess: (data) => {
      if (data?.employee) loginAsEmployee(data.employee);
      if (data?.defaultCompany) {
        sessionStorage.setItem('active_company', JSON.stringify(data.defaultCompany));
      }
      window.location.href = '/dashboard';
    },
    onError: () => setError('This invite could not be accepted. Check the email and PIN, or ask the office for a new invite.'),
  });

  if (!token) return <InviteError message="No invite token was provided." />;
  if (isLoading) {
    return (
      <InviteShell>
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-muted-foreground">Checking invite...</p>
      </InviteShell>
    );
  }
  if (isError || !invite) return <InviteError message="This invite is invalid, expired, revoked, or already accepted." />;

  const canSubmit = email.trim().toLowerCase() === invite.email?.toLowerCase()
    && (!invite.requires_pin_setup || employeeCode.trim().length >= 4);

  return (
    <InviteShell>
      {acceptMutation.isSuccess ? (
        <>
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-base font-semibold text-foreground">Invite accepted</p>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <UserCheck className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-semibold text-foreground">Welcome, {invite.name}</h1>
            <p className="text-sm text-muted-foreground">Confirm your email to finish employee setup.</p>
          </div>

          <div className="text-left rounded-xl bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
            <p><span className="font-semibold text-foreground">Email:</span> {invite.email}</p>
            <p><span className="font-semibold text-foreground">Role:</span> {invite.role}</p>
            <p><span className="font-semibold text-foreground">Companies:</span> {invite.companies?.map(company => company.name).join(', ') || 'Assigned workspace'}</p>
            {invite.expires_at && <p><span className="font-semibold text-foreground">Expires:</span> {new Date(invite.expires_at).toLocaleString()}</p>}
          </div>

          <div className="space-y-3 text-left">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Confirm Email</label>
              <Input value={email} onChange={event => { setEmail(event.target.value); setError(''); }} placeholder={invite.email} className="h-10 rounded-xl text-sm" />
            </div>
            {invite.requires_pin_setup && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Create Employee PIN</label>
                <Input value={employeeCode} onChange={event => { setEmployeeCode(event.target.value); setError(''); }} placeholder="4-20 letters or numbers" className="h-10 rounded-xl text-sm" />
                <p className="text-[11px] text-muted-foreground mt-1">Use this PIN at the internal access gate.</p>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button className="w-full h-11 rounded-xl" disabled={!canSubmit || acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
            {acceptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept Invite'}
          </Button>
        </>
      )}
    </InviteShell>
  );
}
