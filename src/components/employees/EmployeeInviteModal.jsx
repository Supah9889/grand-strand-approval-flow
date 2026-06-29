import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2, Mail, Clock, Copy, CheckCheck, Send, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { audit } from '@/lib/audit';
import { getInternalRole } from '@/lib/adminAuth';
import { buildInviteEmailBody, buildSafeInviteContext, parseInviteCompanyIds } from '@/lib/employeeInvite';

function latestInviteForEmployee(invites = [], employeeId) {
  return invites
    .filter(invite => invite.employee_id === employeeId)
    .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''))[0] || null;
}

function getMembershipCompanyIds(memberships = []) {
  return [...new Set(memberships.map(membership => membership.company_id).filter(Boolean))];
}

function applyInviteLinkToBody(message, link) {
  return message.includes('[secure invite link will be generated]')
    ? message.replace('[secure invite link will be generated]', link)
    : message;
}

/**
 * Determine the correct UI message from backend email result.
 * Never says "sent" unless provider returned delivered=true.
 */
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

export default function EmployeeInviteModal({
  employee,
  invite = null,
  inviteLink = '',
  onClose,
  onSent,
}) {
  const queryClient = useQueryClient();
  const actor = getInternalRole() || 'Admin';
  const [serverInvite, setServerInvite] = useState(invite);
  const [preparedLink, setPreparedLink] = useState(inviteLink);
  const [expiresAt, setExpiresAt] = useState(invite?.expires_at || '');
  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState(`Welcome to the Team - ${employee.name}`);
  const [body, setBody] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // { type, message }

  const { data: approvedEmails = [] } = useQuery({
    queryKey: ['approved-emails'],
    queryFn: () => base44.entities.ApprovedEmail.filter({ active: true }),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies-for-employee-invite'],
    queryFn: () => base44.entities.Company.list('name', 100),
  });

  const { data: memberships = [], isLoading: loadingMemberships } = useQuery({
    queryKey: ['employee-memberships-for-invite', employee.id],
    queryFn: () => base44.entities.CompanyMembership.filter({ employee_id: employee.id }),
    enabled: !!employee?.id,
  });

  const { data: employeeInvites = [] } = useQuery({
    queryKey: ['employee-invites'],
    queryFn: () => base44.entities.EmployeeInvite.list('-created_date', 500).catch(() => []),
  });

  const defaultSender = approvedEmails.find(e => e.is_default) || approvedEmails[0];
  const senderRecord = approvedEmails.find(e => e.email === fromEmail);
  const activeInvite = serverInvite || invite || latestInviteForEmployee(employeeInvites, employee.id);
  const companyIds = useMemo(() => {
    const inviteCompanyIds = parseInviteCompanyIds(activeInvite?.company_ids);
    if (inviteCompanyIds.length) return inviteCompanyIds;
    return getMembershipCompanyIds(memberships);
  }, [activeInvite, memberships]);

  const inviteContext = useMemo(() => buildSafeInviteContext({
    id: activeInvite?.id || '',
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    role: activeInvite?.role || employee.role || 'field',
    company_ids: JSON.stringify(companyIds),
    default_company_id: activeInvite?.default_company_id || companyIds[0] || '',
    permission_group: activeInvite?.permission_group || '',
    requires_pin_setup: activeInvite?.requires_pin_setup !== false,
    expires_at: expiresAt || activeInvite?.expires_at || '',
    status: activeInvite?.status || employee.invite_status || 'draft',
    invited_by: activeInvite?.invited_by || actor,
    invited_by_email: activeInvite?.invited_by_email || fromEmail,
  }, companies), [activeInvite, actor, companies, companyIds, employee, expiresAt, fromEmail]);

  useEffect(() => {
    if (defaultSender && !fromEmail) setFromEmail(defaultSender.email);
  }, [defaultSender, fromEmail]);

  useEffect(() => {
    setBody(buildInviteEmailBody(inviteContext, preparedLink || '[secure invite link will be generated]', actor));
  }, [actor, inviteContext, preparedLink]);

  async function prepareInviteLink() {
    if (preparedLink) return preparedLink;
    if (!employee.email) throw new Error('Employee has no email address on file');
    if (!activeInvite?.id && !companyIds.length) {
      throw new Error('Assign this employee to at least one company before sending an invite.');
    }

    setPreparing(true);
    try {
      const response = activeInvite?.id
        ? await base44.functions.invoke('resendEmployeeInvite', { invite_id: activeInvite.id })
        : await base44.functions.invoke('createEmployeeInvite', {
          name: employee.name,
          email: employee.email,
          phone: employee.phone,
          role: employee.role || 'field',
          company_ids: companyIds,
          default_company_id: companyIds[0],
          send_now: true,
          requires_pin_setup: true,
        });
      const data = response?.data || response;
      if (!data?.inviteLink) throw new Error(data?.error || 'Invite link was not generated.');
      setServerInvite(data.invite || activeInvite);
      setPreparedLink(data.inviteLink);
      setExpiresAt(data.expiresAt || data.invite?.expires_at || '');
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-invites'] });
      return data;
    } finally {
      setPreparing(false);
    }
  }

  const handleSend = async () => {
    if (!employee.email) { toast.error('Employee has no email address on file'); return; }
    setSending(true);
    setEmailStatus(null);
    try {
      const data = await prepareInviteLink();
      const link = data.inviteLink;
      // Backend already attempted email via Resend. Use backend result for status.
      const status = getEmailStatusMessage(data.email);
      setEmailStatus(status);
      if (status.type === 'success') {
        audit.employee.inviteSent(employee.id, actor, employee.name, employee.email);
        toast.success(status.message);
      } else if (status.type === 'warning') {
        toast.warning(status.message, { duration: 8000 });
      } else {
        toast.error(status.message);
      }
      // Invalidate so parent lists refresh, but do NOT auto-close so manual fallback is visible.
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-invites'] });
      onSent?.();
    } catch (error) {
      setEmailStatus({ type: 'error', message: 'Invite could not be created.' });
      toast.error(error.message || 'Invite could not be created.');
    } finally {
      setSending(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      const data = await prepareInviteLink();
      const link = data.inviteLink;
      await navigator.clipboard.writeText(applyInviteLinkToBody(body, link));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Message copied to clipboard');
    } catch (error) {
      toast.error(error.message || 'Could not prepare invite link.');
    }
  };

  const handleCopyLink = async () => {
    try {
      const data = await prepareInviteLink();
      await navigator.clipboard.writeText(data.inviteLink);
      toast.success('Invite link copied');
    } catch (error) {
      toast.error(error.message || 'Could not prepare invite link.');
    }
  };

  const handleMarkSent = async () => {
    try {
      await prepareInviteLink();
      audit.employee.inviteSent(employee.id, actor, employee.name, employee.email);
      toast.success('Invite ready for manual delivery');
      onSent?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Could not prepare invite link.');
    }
  };

  const isResend = !!activeInvite?.id || ['sent', 'pending_confirmation', 'resent'].includes(employee.invite_status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">{isResend ? 'Resend Invite' : 'Send Employee Invite'}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To</label>
            <div className="flex items-center gap-2 h-10 px-3 bg-muted/40 rounded-xl border border-border text-sm text-foreground">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{employee.name}</span>
              {employee.email
                ? <span className="text-muted-foreground">- {employee.email}</span>
                : <span className="text-destructive text-xs">(no email on file)</span>}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Companies</label>
            <div className="min-h-10 px-3 py-2 bg-muted/40 rounded-xl border border-border text-sm text-foreground">
              {inviteContext.companies.length
                ? inviteContext.companies.map(company => company.name).join(', ')
                : loadingMemberships ? 'Loading company assignments...' : 'No company assignment found'}
            </div>
          </div>

          {/* Email Delivery Status Banner */}
          {emailStatus && (
            <div className={`flex items-start gap-2 text-xs rounded-xl px-3 py-2.5 border ${
              emailStatus.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              emailStatus.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
              'bg-red-50 border-red-200 text-red-800'
            }`}>
              {emailStatus.type === 'success'
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                : emailStatus.type === 'warning'
                ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <p>{emailStatus.message}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From</label>
            {approvedEmails.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                No approved sender emails configured. Use the manual-copy fallback below.
              </div>
            ) : (
              <Select value={fromEmail} onValueChange={setFromEmail}>
                <SelectTrigger className="h-10 rounded-xl text-sm">
                  <SelectValue placeholder="Select sender email" />
                </SelectTrigger>
                <SelectContent>
                  {approvedEmails.map(ae => (
                    <SelectItem key={ae.id} value={ae.email}>
                      {ae.display_name ? `${ae.display_name} <${ae.email}>` : ae.email}
                      {ae.is_default ? ' (default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} className="rounded-xl text-sm min-h-48 font-mono text-xs" />
          </div>

          {/* Manual Link Fallback — ALWAYS visible after link is generated */}
          <div className="bg-muted/40 border border-border rounded-xl px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">Secure Invite Link</p>
              <button onClick={handleCopyLink} disabled={preparing || sending}
                className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-60">
                {preparing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />} Copy Link
              </button>
            </div>
            <p className="text-xs text-primary break-all">{preparedLink || 'Generated by the server when sending or copying.'}</p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                {expiresAt ? `Expires ${format(new Date(expiresAt), 'MMM d, yyyy')}` : 'Expires 7 days after generation'}
              </p>
            </div>
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              <p>
                If email delivery fails or is not configured, use Copy Link or Copy Message and send it to the employee manually.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-xs" onClick={handleCopyMessage} disabled={preparing || sending}>
                {copied ? <><CheckCheck className="w-3.5 h-3.5 mr-1" /> Copied</> : <><Copy className="w-3.5 h-3.5 mr-1" /> Copy Message</>}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-xs" onClick={handleMarkSent} disabled={preparing || sending}>
                {preparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Manual Send'}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 pb-5">
          <Button
            className="flex-1 h-10 rounded-xl gap-2"
            onClick={handleSend}
            disabled={sending || preparing || !employee.email || !companyIds.length}
          >
            {sending || preparing
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Send className="w-3.5 h-3.5" /> {isResend ? 'Resend Invite' : 'Send Invite'}</>}
          </Button>
          <Button variant="ghost" className="h-10 rounded-xl px-4 text-sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}