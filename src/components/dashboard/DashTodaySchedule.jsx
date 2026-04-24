import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, ArrowRight, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function formatTime(isoStr) {
  if (!isoStr) return null;
  try {
    return format(parseISO(isoStr), 'h:mm a');
  } catch {
    return null;
  }
}

const STATUS_STYLES = {
  scheduled:   'bg-blue-50 text-blue-700',
  confirmed:   'bg-primary/10 text-primary',
  in_progress: 'bg-amber-50 text-amber-700',
  completed:   'bg-green-50 text-green-700',
  canceled:    'bg-muted text-muted-foreground line-through',
  rescheduled: 'bg-orange-50 text-orange-700',
  waiting:     'bg-yellow-50 text-yellow-700',
};

export default function DashTodaySchedule({ events = [], jobs = [] }) {
  const navigate = useNavigate();
  const jobMap = Object.fromEntries(jobs.map(j => [j.id, j]));

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-3 py-4 text-center justify-center">
        <Calendar className="w-5 h-5 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">Nothing scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map(ev => {
        const job = ev.job_id ? jobMap[ev.job_id] : null;
        const startTime = formatTime(ev.start_date);
        const endTime = formatTime(ev.end_date);
        const timeLabel = startTime
          ? (endTime ? `${startTime} – ${endTime}` : startTime)
          : (ev.all_day ? 'All day' : 'Unscheduled');
        const statusStyle = STATUS_STYLES[ev.status] || 'bg-muted text-muted-foreground';

        return (
          <button
            key={ev.id}
            onClick={() => ev.job_id ? navigate(`/job-hub?jobId=${ev.job_id}`) : navigate('/calendar')}
            className="w-full text-left bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-colors flex items-start gap-3"
          >
            <div className="flex flex-col items-center shrink-0 w-14 pt-0.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
              <p className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{timeLabel}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground leading-snug truncate">{ev.title}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusStyle}`}>
                  {ev.status?.replace(/_/g, ' ') || 'scheduled'}
                </span>
              </div>
              {(ev.job_address || job?.address) && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {ev.job_address || job?.address}
                </p>
              )}
              {ev.assigned_to && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{ev.assigned_to}</p>
              )}
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
          </button>
        );
      })}
    </div>
  );
}