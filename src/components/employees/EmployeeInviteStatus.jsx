import React from 'react';
import { CheckCircle2, Clock, XCircle, RotateCcw, MinusCircle } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  draft:                { label: 'Draft',               color: 'text-slate-500',   bg: 'bg-slate-100',   icon: MinusCircle },
  sent:                 { label: 'Sent',                color: 'text-amber-600',   bg: 'bg-amber-50',    icon: Clock },
  accepted:             { label: 'Accepted',            color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: CheckCircle2 },
  revoked:              { label: 'Revoked',             color: 'text-red-500',     bg: 'bg-red-50',      icon: XCircle },
  not_sent:             { label: 'Not Sent',            color: 'text-slate-500',   bg: 'bg-slate-100',   icon: MinusCircle },
  pending_confirmation: { label: 'Pending Confirmation', color: 'text-amber-600',   bg: 'bg-amber-50',    icon: Clock },
  confirmed:            { label: 'Confirmed',            color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: CheckCircle2 },
  expired:              { label: 'Expired',              color: 'text-red-500',     bg: 'bg-red-50',      icon: XCircle },
  resent:               { label: 'Resent',               color: 'text-blue-600',    bg: 'bg-blue-50',     icon: RotateCcw },
};

export default function EmployeeInviteStatus({ employee, invite = null, compact = false }) {
  const status = invite?.status || employee.invite_status || 'not_sent';
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_sent;
  const Icon = cfg.icon;
  const sentAt = invite?.last_sent_at || employee.invite_sent_date;
  const sentFrom = invite?.invited_by_email || employee.invite_sent_from;
  const acceptedAt = invite?.accepted_at || employee.verification_date;
  const expiresAt = invite?.expires_at || employee.invite_token_expires;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
      <div className="text-xs text-muted-foreground space-y-0.5">
        {sentAt && (
          <p>Invite sent: {format(new Date(sentAt), 'MMM d, yyyy h:mm a')}</p>
        )}
        {sentFrom && (
          <p>Sent from: {sentFrom}</p>
        )}
        {employee.last_invite_resent_date && (
          <p>Last resent: {format(new Date(employee.last_invite_resent_date), 'MMM d, yyyy h:mm a')}</p>
        )}
        {acceptedAt && (
          <p>Accepted: {format(new Date(acceptedAt), 'MMM d, yyyy h:mm a')}</p>
        )}
        {expiresAt && ['sent', 'pending_confirmation', 'resent'].includes(status) && (
          <p>Link expires: {format(new Date(expiresAt), 'MMM d, yyyy')}</p>
        )}
      </div>
    </div>
  );
}
