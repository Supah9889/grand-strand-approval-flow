import React from 'react';
import { format, parseISO } from 'date-fns';
import { Clock, UserCheck, Tag, StickyNote, Calendar, Send, ArrowRight, Trophy, X, RefreshCw } from 'lucide-react';

const ACTION_CONFIG = {
  record_created:    { icon: Clock,       color: 'text-primary',  label: 'Record created' },
  status_changed:    { icon: Tag,         color: 'text-violet-600', label: 'Status changed' },
  assigned_changed:  { icon: UserCheck,   color: 'text-sky-600',  label: 'Assignment changed' },
  note_added:        { icon: StickyNote,  color: 'text-amber-600', label: 'Note added' },
  estimate_scheduled:{ icon: Calendar,    color: 'text-orange-600', label: 'Estimate scheduled' },
  estimate_sent:     { icon: Send,        color: 'text-blue-600', label: 'Estimate sent' },
  follow_up_changed: { icon: RefreshCw,   color: 'text-teal-600', label: 'Follow-up updated' },
  converted_to_job:  { icon: ArrowRight,  color: 'text-primary',  label: 'Converted to job' },
  marked_won:        { icon: Trophy,      color: 'text-green-600', label: 'Marked won' },
  marked_lost:       { icon: X,           color: 'text-red-500',  label: 'Marked lost' },
  field_updated:     { icon: RefreshCw,   color: 'text-slate-500', label: 'Field updated' },
};

export default function LeadActivityFeed({ activities = [] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>;
  }

  return (
    <div className="space-y-0">
      {activities.map((act, i) => {
        const cfg = ACTION_CONFIG[act.action] || { icon: Clock, color: 'text-muted-foreground', label: act.action };
        const Icon = cfg.icon;
        const isLast = i === activities.length - 1;
        return (
          <div key={act.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 z-10`}>
                <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border mt-1 mb-1" />}
            </div>
            <div className={`flex-1 min-w-0 ${isLast ? 'pb-0' : 'pb-4'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-foreground">{cfg.label}</p>
                <p className="text-xs text-muted-foreground shrink-0">
                  {act.timestamp ? format(parseISO(act.timestamp), 'MMM d, h:mm a') : ''}
                </p>
              </div>
              {act.detail && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{act.detail}</p>}
              {act.actor && <p className="text-xs text-muted-foreground/70 mt-0.5">by {act.actor}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}