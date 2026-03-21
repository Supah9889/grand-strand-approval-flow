import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Clock, Search, User, MapPin } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import AppLayout from '../components/AppLayout';
import { isAdminAuthed } from '@/lib/adminAuth';

function formatDuration(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function TimeEntries() {
  const [search, setSearch] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['time-entries'],
    queryFn: () => base44.entities.TimeEntry.list('-clock_in', 200),
  });

  const filtered = entries.filter(e => {
    const q = search.toLowerCase();
    return !q ||
      e.employee_name?.toLowerCase().includes(q) ||
      e.job_address?.toLowerCase().includes(q) ||
      e.cost_code?.toLowerCase().includes(q);
  });

  const todayStr = new Date().toDateString();
  const todayEntries = entries.filter(e => e.clock_in && new Date(e.clock_in).toDateString() === todayStr);
  const clockedIn = todayEntries.filter(e => e.status === 'clocked_in').length;

  return (
    <AppLayout title="Time Entries">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Time Entries</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{clockedIn} employee{clockedIn !== 1 ? 's' : ''} currently clocked in</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee, job, or cost code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl text-sm"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No time entries found.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => (
              <div key={entry.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-primary shrink-0" />
                    <p className="text-sm font-medium text-foreground">{entry.employee_name}</p>
                    <span className="text-xs text-muted-foreground">#{entry.employee_code}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    entry.status === 'clocked_in'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {entry.status === 'clocked_in' ? 'In' : formatDuration(entry.duration_minutes)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{entry.job_address}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{entry.cost_code}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {entry.clock_in ? format(new Date(entry.clock_in), 'MMM d · h:mm a') : '—'}
                    {entry.clock_out ? ` → ${format(new Date(entry.clock_out), 'h:mm a')}` : ' → now'}
                  </span>
                </div>
                {entry.note && (
                  <p className="text-xs text-muted-foreground italic border-t border-border pt-2">{entry.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}