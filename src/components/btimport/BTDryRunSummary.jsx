import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, BookOpen, CalendarDays, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function BTDryRunSummary({ stats }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
        <p className="text-sm text-green-800 font-medium">
          Dry-run complete — no live records have been created yet.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Building2 className="w-4 h-4 text-primary" />}
          label="Jobsites"
          total={stats.totalJobs}
          items={[
            stats.duplicateJobs > 0 && { label: `${stats.duplicateJobs} possible duplicates`, warn: true },
            stats.flaggedJobs > 0   && { label: `${stats.flaggedJobs} needs review`, warn: true },
          ].filter(Boolean)}
        />
        <StatCard
          icon={<BookOpen className="w-4 h-4 text-primary" />}
          label="Daily Logs"
          total={stats.totalLogs}
          items={[
            stats.unmatchedLogs > 0  && { label: `${stats.unmatchedLogs} unmatched to job`, warn: true },
            stats.attachmentLogs > 0 && { label: `${stats.attachmentLogs} have attachments`, warn: false },
          ].filter(Boolean)}
        />
        <StatCard
          icon={<CalendarDays className="w-4 h-4 text-primary" />}
          label="Calendar Events"
          total={stats.totalEvents}
          items={[
            stats.unmatchedEvents > 0 && { label: `${stats.unmatchedEvents} unmatched`, warn: true },
            stats.officeEvents > 0    && { label: `${stats.officeEvents} office/internal`, warn: false },
          ].filter(Boolean)}
        />
      </div>

      {stats.totalErrors > 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {stats.totalErrors} parse warning{stats.totalErrors !== 1 ? 's' : ''} — review below
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, total, items }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{total}</p>
      {items.map((item, i) => (
        <Badge
          key={i}
          variant={item.warn ? 'outline' : 'secondary'}
          className={`text-[10px] ${item.warn ? 'border-amber-300 text-amber-700 bg-amber-50' : ''}`}
        >
          {item.label}
        </Badge>
      ))}
    </div>
  );
}