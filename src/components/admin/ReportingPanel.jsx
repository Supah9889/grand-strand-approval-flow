import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, FileUp, PenLine, CheckCircle2, Star, MessageSquare, MousePointerClick } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color = 'text-primary', bg = 'bg-secondary' }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`${bg} w-10 h-10 rounded-lg flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function ReportingPanel() {
  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['report-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ['report-audit'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp'),
  });

  if (loadingJobs || loadingAudit) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const totalImported = auditLogs.filter(l => l.action === 'imported_from_csv').length;
  const pending = jobs.filter(j => j.status === 'pending').length;
  const signed = jobs.filter(j => j.status === 'approved').length;
  const reviewPromptShown = jobs.filter(j => j.review_prompt_shown).length;
  const googleClicked = jobs.filter(j => j.google_review_clicked).length;
  const internalFeedback = jobs.filter(j => j.internal_feedback_submitted).length;

  const stats = [
    { icon: FileUp,          label: 'Total CSV Imports',          value: totalImported,    color: 'text-primary',              bg: 'bg-secondary' },
    { icon: PenLine,         label: 'Pending Signatures',         value: pending,          color: 'text-amber-600',            bg: 'bg-amber-50' },
    { icon: CheckCircle2,    label: 'Signed Jobs',                value: signed,           color: 'text-green-600',            bg: 'bg-green-50' },
    { icon: Star,            label: 'Review Prompt Shown',        value: reviewPromptShown,color: 'text-primary',              bg: 'bg-secondary' },
    { icon: MousePointerClick,label: 'Google Review Clicks',      value: googleClicked,    color: 'text-blue-600',             bg: 'bg-blue-50' },
    { icon: MessageSquare,   label: 'Internal Feedback Submitted',value: internalFeedback, color: 'text-muted-foreground',     bg: 'bg-muted' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Live counts across all job records.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>
    </div>
  );
}