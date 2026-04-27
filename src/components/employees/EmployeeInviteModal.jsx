import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2, Mail, Clock, RotateCcw, Copy, CheckCheck, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { audit } from '@/lib/audit';
import { getInternalRole } from '@/lib/adminAuth';

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function buildVerifyLink(token) {
  return `${window.location.origin}/verify-invite?verify_token=${token}`;
}

function buildDefaultMessage(employee, verifyLink) {
  return `Hi ${employee.name},

Welcome to Grand Strand Custom Painting!

You've been added to our team management system. Please click the link below to verify your account and confirm your information:

${verifyLink}

Your employee code is: ${employee.employee_code}

This link will expire in 7 days. If you need a new link, contact your manager.

Thank you,
Grand Strand Custom Painting Management`;
}

async function recordInviteSent({ employee, token, fromEmail, isResend }) {
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const updateFields = {
    invite_status: isResend ? 'resent' : 'pending_confirmation',
    invite_sent_from: fromEmail,
    invite_token: token,
    invite_token_expires: expires,
    verification_status: 'unverified',
  };
  if (!isResend) {
    updateFields.invite_sent_date = now;
  } else {
    updateFields.last_invite_resent_date = now;
  }
  await base44.entities.Employee.update(employee.id, updateFields);
}

export default function EmployeeInviteModal({ employee, onClose, onSent }) {
  const queryClient = useQueryClient();

  const { data: approvedEmails = [] } = useQuery({
    queryKey: ['approved-emails'],
    queryFn: () => base44.entities.ApprovedEmail.filter({ active: true }),
  });

  const defaultSender = approvedEmails.find(e => e.is_default) || approvedEmails[0];

  const [token] = useState(generateToken);
  const verifyLink = buildVerifyLink(token);

  const [fromEmail, setFromEmail] = useState('');
  const [subject, setSubject] = useState(`Welcome to the Team — ${employee.name}`);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (defaultSender && !fromEmail) setFromEmail(defaultSender.email);
  }, [defaultSender]);

  useEffect(() => {
    setBody(buildDefaultMessage(employee, verifyLink));
  }, [employee.id]);

  const isResend = employee.invite_status && employee.invite_status !== 'not_sent';
  const senderRecord = approvedEmails.find(e => e.email === fromEmail);

  const actor = getInternalRole() || 'Admin';

  const handleSend = async () => {
    if (!employee.email) { toast.error('Employee has no email address on file'); return; }
    if (!fromEmail) { toast.error('Please select a sender email'); return; }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        from_name: senderRecord?.display_name || 'Grand Strand Custom Painting',
        to: employee.email,
        subject,
        body,
      });
      await recordInviteSent({ employee, token, fromEmail, isResend });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (isResend) {
        audit.employee.inviteResent(employee.id, actor, employee.name, employee.email);
      } else {
        audit.employee.inviteSent(employee.id, actor, employee.name, employee.email);
      }
      toast.success(isResend ? 'Invite resent!' : 'Invite sent!');
      onSent?.();
      onClose();
    } catch (err) {
      // SendEmail may fail for external addresses on current plan.
      // Fall through so user can use the manual fallback below.
      toast.error(
        'Email could not be sent automatically. Use "Copy Message" below to send manually, then click "Mark as Sent".',
        { duration: 6000 }
      );
    } finally {
      setSending(false);
    }
  };

  const handleMarkSent = async () => {
    if (!fromEmail) { toast.error('Select a sender email first'); return; }
    setSending(true);
    await recordInviteSent({ employee, token, fromEmail, isResend });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    if (isResend) {
      audit.employee.inviteResent(employee.id, actor, employee.name, employee.email);
    } else {
      audit.employee.inviteSent(employee.id, actor, employee.name, employee.email);
    }
    setSending(false);
    toast.success('Invite marked as sent');
    onSent?.();
    onClose();
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Message copied to clipboard');
  };

  const handleSaveLater = () => {
    toast.success('Invite saved — you can send from the employee file later');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
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

          {/* Recipient */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">To (Recipient)</label>
            <div className="flex items-center gap-2 h-10 px-3 bg-muted/40 rounded-xl border border-border text-sm text-foreground">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{employee.name}</span>
              {employee.email
                ? <span className="text-muted-foreground">— {employee.email}</span>
                : <span className="text-destructive text-xs">(no email on file)</span>}
            </div>
          </div>

          {/* Sender */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">From (Sender)</label>
            {approvedEmails.length === 0 ? (
              <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                No approved sender emails configured. Add them in Employee Settings → Approved Emails.
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

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject</label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Message</label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} className="rounded-xl text-sm min-h-48 font-mono text-xs" />
          </div>

          {/* Invite link preview */}
          <div className="bg-muted/40 border border-border rounded-xl px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">Verification Link (included in message)</p>
              <button onClick={() => { navigator.clipboard.writeText(verifyLink); toast.success('Link copied'); }}
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <Copy className="w-3 h-3" /> Copy Link
              </button>
            </div>
            <p className="text-xs text-primary break-all">{verifyLink}</p>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Expires in 7 days · {format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          {/* Previous invite info */}
          {isResend && employee.invite_sent_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2">
              <RotateCcw className="w-3 h-3 shrink-0" />
              <span>Previously sent {format(new Date(employee.invite_sent_date), 'MMM d, yyyy')} from {employee.invite_sent_from || '—'}</span>
            </div>
          )}

          {/* Manual fallback notice — clearly separated */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              <p>
                If automatic sending fails (e.g. plan limitation), copy the message and send it manually via your email client, then click <strong>Mark as Sent</strong> to record the invite.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-xs" onClick={handleCopyMessage}>
                {copied ? <><CheckCheck className="w-3.5 h-3.5 mr-1" /> Copied!</> : <><Copy className="w-3.5 h-3.5 mr-1" /> Copy Message</>}
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-xs" onClick={handleMarkSent} disabled={sending}>
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Mark as Sent'}
              </Button>
            </div>
          </div>

        </div>

        {/* Primary Actions */}
        <div className="flex items-center gap-2 px-5 pb-5">
          <Button
            className="flex-1 h-10 rounded-xl gap-2"
            onClick={handleSend}
            disabled={sending || !employee.email || approvedEmails.length === 0}
          >
            {sending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Send className="w-3.5 h-3.5" /> {isResend ? 'Resend Invite' : 'Send Invite'}</>}
          </Button>
          <Button variant="ghost" className="h-10 rounded-xl px-4 text-sm" onClick={handleSaveLater}>
            Save for Later
          </Button>
        </div>

      </div>
    </div>
  );
}