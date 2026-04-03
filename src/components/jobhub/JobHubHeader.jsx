import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Lock, StickyNote, Calendar,
  FileUp, FileText, DollarSign, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import JobGroupBadge from '../jobs/JobGroupBadge';
import JobStatusPicker from '../jobs/JobStatusPicker';

export default function JobHubHeader({ job, isAdmin, onAddNote, onAddSchedule, onUploadFile }) {
  const navigate = useNavigate();

  const quickActions = [
    { icon: StickyNote, label: 'Add Note', color: 'text-amber-600', action: onAddNote },
    { icon: Calendar, label: 'Schedule', color: 'text-blue-600', action: onAddSchedule },
    { icon: FileUp, label: 'Upload', color: 'text-violet-600', action: onUploadFile },
    { icon: FileText, label: 'Sign', color: 'text-primary', action: () => navigate(`/approve?jobId=${job.id}`) },
    ...(isAdmin ? [
      { icon: DollarSign, label: 'Invoices', color: 'text-green-600', action: () => navigate('/invoices') },
      { icon: ShieldCheck, label: 'Warranty', color: 'text-indigo-600', action: () => navigate('/warranty') },
    ] : []),
  ];

  return (
    <div className="space-y-2">
      {/* Back nav */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      {/* Main header card */}
      <div
        className="bg-card border border-border rounded-2xl overflow-hidden"
        style={job.color ? { borderLeftColor: job.color, borderLeftWidth: 4 } : {}}
      >
        {/* Top section */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-base font-bold text-foreground leading-snug">{job.address}</p>
                  {job.title && job.title !== job.address && (
                    <p className="text-xs text-muted-foreground mt-0.5">{job.title}</p>
                  )}
                </div>
              </div>

              {/* Status + meta badges */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap pl-6">
                {/* Primary operational status — tappable for admin */}
                <JobStatusPicker job={job} queryKey={['job-hub', job.id]} />

                {job.job_group && <JobGroupBadge group={job.job_group} />}
                {job.locked && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                    <Lock className="w-2.5 h-2.5" /> Locked
                  </span>
                )}
                {job.job_number && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    #{job.job_number}
                  </span>
                )}
              </div>
            </div>

            {/* Price + updated */}
            <div className="text-right shrink-0">
              <p className="text-xl font-black text-primary">${Number(job.price || 0).toLocaleString()}</p>
              {job.updated_date && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Updated {format(new Date(job.updated_date), 'MMM d')}
                </p>
              )}
            </div>
          </div>

          {/* Customer */}
          {job.customer_name && (
            <p className="text-xs text-muted-foreground mt-2 pl-6">
              {job.customer_name}
              {(job.customer_phone || job.phone) && (
                <span className="ml-2 text-primary">· {job.customer_phone || job.phone}</span>
              )}
            </p>
          )}

          {/* Status note if set */}
          {job.op_status_note && (
            <p className="text-xs text-muted-foreground/80 italic mt-1.5 pl-6 border-l-2 border-border ml-6">
              {job.op_status_note}
            </p>
          )}
        </div>

        {/* Quick action strip */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {quickActions.map(({ icon: Icon, label, color, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex items-center gap-1 shrink-0 text-[11px] font-medium bg-muted hover:bg-accent rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-foreground/80">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}