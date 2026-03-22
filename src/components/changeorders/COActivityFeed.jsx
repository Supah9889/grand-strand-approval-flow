import React from 'react';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, XCircle, Send, FileText, Upload, Edit3, Plus, Lock } from 'lucide-react';

const ACTION_CONFIG = {
  co_created:          { label: 'Change order created',       icon: Plus,         color: 'text-primary' },
  co_edited:           { label: 'Change order edited',        icon: Edit3,        color: 'text-muted-foreground' },
  status_changed:      { label: 'Status changed',             icon: CheckCircle2, color: 'text-blue-600' },
  document_generated:  { label: 'Document generated',         icon: FileText,     color: 'text-violet-600' },
  file_uploaded:       { label: 'File uploaded',              icon: Upload,       color: 'text-slate-600' },
  sent_for_approval:   { label: 'Sent for approval',          icon: Send,         color: 'text-blue-600' },
  approved:            { label: 'Change order approved',      icon: CheckCircle2, color: 'text-green-600' },
  rejected:            { label: 'Change order rejected',      icon: XCircle,      color: 'text-red-600' },
  closed:              { label: 'Change order closed',        icon: Lock,         color: 'text-gray-500' },
  visibility_changed:  { label: 'Visibility changed',         icon: Edit3,        color: 'text-muted-foreground' },
};

export default function COActivityFeed({ activities }) {
  if (!activities.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <div className="space-y-3">
      {activities.map(a => {
        const cfg = ACTION_CONFIG[a.action] || { label: a.action, icon: Edit3, color: 'text-muted-foreground' };
        const Icon = cfg.icon;
        return (
          <div key={a.id} className="flex gap-3 items-start">
            <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 ${cfg.color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm text-foreground">{cfg.label}</p>
              {a.detail && <p className="text-xs text-muted-foreground mt-0.5">{a.detail}</p>}
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {a.actor && `${a.actor} · `}{a.timestamp ? format(parseISO(a.timestamp), 'MMM d, yyyy · h:mm a') : ''}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}