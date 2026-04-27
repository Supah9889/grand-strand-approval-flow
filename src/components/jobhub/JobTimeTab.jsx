import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Clock, User, AlertTriangle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function timeStr(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function JobTimeTab({ job }) {
  const navigate = useNavigate();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['hub-time-tab', job.id],
    queryFn: () => base44.entities.TimeEntry.filter({ job_id: job.id }, '-clock_in'),
    enabled: !!job.id,
  });

  const totalMinutes = entries.reduce((s, e) => s + (Number(e.duration_minutes) || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const flaggedCount = entries.filter(e => e.geo_flagged).length;

  if (isLoading) return (
    <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
  );

  if (entries.length === 0) return (
    <div className="text-center py-12">
      <Clock className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">No time entries for this job</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-foreground">{totalHours}h</p>
          <p className="text-xs text-muted-foreground">Total Hours</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-foreground">{entries.length}</p>
          <p className="text-xs text-muted-foreground">Entries</p>
        </div>
        <div className={`rounded-xl p-3 text-center border ${flaggedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-card border-border'}`}>
          <p className={`text-lg font-bold ${flaggedCount > 0 ? 'text-amber-700' : 'text-foreground'}`}>{flaggedCount}</p>
          <p className="text-xs text-muted-foreground">Flagged</p>
        </div>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        {entries.map(e => {
          const clockIn = e.clock_in ? (() => { try { return format(parseISO(e.clock_in), 'MMM d, h:mm a'); } catch { return e.clock_in; } })() : '—';
          const clockOut = e.clock_out ? (() => { try { return format(parseISO(e.clock_out), 'h:mm a'); } catch { return e.clock_out; } })() : 'Active';
          const isActive = e.status === 'clocked_in';

          return (
            <button
              key={e.id}
              onClick={() => navigate(`/time-entries/${e.id}`)}
              className={`w-full text-left bg-card border rounded-xl p-3 hover:border-primary/30 transition-colors
                ${e.geo_flagged ? 'border-amber-300 bg-amber-50/30' : 'border-border'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium text-foreground truncate">{e.employee_name}</p>
                  {e.geo_flagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                </div>
                <span className={`text-xs font-semibold shrink-0 ${isActive ? 'text-green-600' : 'text-foreground'}`}>
                  {isActive ? '● Active' : timeStr(e.duration_minutes)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                <span><Clock className="w-3 h-3 inline mr-0.5" />{clockIn} {!isActive ? `→ ${clockOut}` : ''}</span>
                {e.cost_code && <span className="bg-muted px-1.5 py-0.5 rounded-full">{e.cost_code}</span>}
                {e.approval_status && (
                  <span className={`px-1.5 py-0.5 rounded-full ${e.approval_status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {e.approval_status}
                  </span>
                )}
              </div>
              {e.employee_note && <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">{e.employee_note}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}