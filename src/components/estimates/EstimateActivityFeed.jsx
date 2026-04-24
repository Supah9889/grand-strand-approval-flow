import React from 'react';
import { format, parseISO } from 'date-fns';
import { Clock, FileText, Send, CheckCircle2, X, RefreshCw, Eye, Tag, Pencil } from 'lucide-react';

const ACTION_CONFIG = {
  estimate_created:    { icon: Clock,        color: 'text-primary',    label: 'Estimate created' },
  estimate_edited:     { icon: Pencil,       color: 'text-slate-500',  label: 'Estimate edited' },
  line_items_changed:  { icon: Pencil,       color: 'text-amber-600',  label: 'Line items updated' },
  status_changed:      { icon: Tag,          color: 'text-violet-600', label: 'Status changed' },
  document_generated:  { icon: FileText,     color: 'text-blue-600',   label: 'Document generated' },
  email_sent:          { icon: Send,         color: 'text-sky-600',    label: 'Email sent' },
  estimate_approved:   { icon: CheckCircle2, color: 'text-green-600',  label: 'Approved' },
  estimate_rejected:   { icon: X,            color: 'text-red-500',    label: 'Rejected' },
  revision_created:    { icon: RefreshCw,    color: 'text-amber-600',  label: 'Revision created' },
  linked_job_updated:  { icon: RefreshCw,    color: 'text-teal-600',   label: 'Linked job updated' },
  viewed:              { icon: Eye,          color: 'text-violet-500', label: 'Viewed' },
};

export default function EstimateActivityFeed({ activities = [] }) {
  if (!activities.length) return <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>;

  return (
    <div className="space-y-0">
      {activities.map((act, i) => {
        const cfg = ACTION_CONFIG[act.action] || { icon: Clock, color: 'text-muted-foreground', label: act.action };
        const Icon = cfg.icon;
        const isLast = i === activities.length - 1;
        return (
          <div key={act.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border mt-1 mb-1" />}
            </div>
            <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-4'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-foreground">{cfg.label}</p>
                <p className="text-xs text-muted-foreground shrink-0">
                  {act.timestamp ? format(parseISO(act.timestamp), 'MMM d, h:mm a') : ''}
                </p>
              </div>
              {act.detail && <p className="text-xs text-muted-foreground mt-0.5">{act.detail}</p>}
              {act.actor && <p className="text-xs text-muted-foreground/60 mt-0.5">by {act.actor}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}