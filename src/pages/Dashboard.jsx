import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { PenLine, CheckCircle2, Archive, FileUp, Clock, ArrowRight, Loader2 } from 'lucide-react';
import AppLayout from '../components/AppLayout';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  pending:  { label: 'Pending', color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-100' },
  approved: { label: 'Signed',  color: 'text-primary',    bg: 'bg-secondary',  border: 'border-secondary' },
  archived: { label: 'Archived',color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' },
};

function StatCard({ icon: Icon, label, value, color, bg, border, onClick, active }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-150 ${
        active ? `${bg} ${border}` : 'bg-card border-border hover:border-primary/30'
      }`}
    >
      <div className={`w-9 h-9 rounded-xl ${active ? 'bg-white/70' : bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </motion.button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const section = urlParams.get('section') || null;

  const { data: jobs = [], isLoading: loadingJobs } = useQuery({
    queryKey: ['dashboard-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['dashboard-audit'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 20),
  });

  const pending  = jobs.filter(j => j.status === 'pending');
  const approved = jobs.filter(j => j.status === 'approved');
  const archived = jobs.filter(j => j.status === 'archived');

  const sectionJobs = section === 'pending' ? pending
    : section === 'approved' ? approved
    : section === 'archived' ? archived
    : null;

  const sectionLabel = section === 'pending' ? 'Pending Signatures'
    : section === 'approved' ? 'Signed Jobs'
    : section === 'archived' ? 'Archived Jobs'
    : null;

  const handleSection = (s) => {
    if (section === s) {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard?section=${s}`);
    }
  };

  const stats = [
    { icon: PenLine,      label: 'Pending Signatures', value: pending.length,  color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-200', key: 'pending'  },
    { icon: CheckCircle2, label: 'Signed Jobs',         value: approved.length, color: 'text-primary',   bg: 'bg-secondary', border: 'border-primary/30', key: 'approved' },
    { icon: Archive,      label: 'Archived',            value: archived.length, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border', key: 'archived' },
    { icon: FileUp,       label: 'Total Jobs',          value: jobs.length,     color: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-blue-100', key: null },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-6">

        {/* Welcome */}
        <div>
          <h1 className="text-lg font-semibold text-foreground">Operations Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Grand Strand Custom Painting · Internal</p>
        </div>

        {/* Stat cards */}
        {loadingJobs ? (
          <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {stats.map(s => (
              <StatCard
                key={s.label}
                icon={s.icon}
                label={s.label}
                value={s.value}
                color={s.color}
                bg={s.bg}
                border={s.border}
                active={section === s.key}
                onClick={s.key ? () => handleSection(s.key) : undefined}
              />
            ))}
          </div>
        )}

        {/* Section job list */}
        {sectionJobs && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">{sectionLabel}</p>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Clear
              </button>
            </div>
            {sectionJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No jobs in this category.</p>
            ) : (
              <div className="space-y-2">
                {sectionJobs.map(job => {
                  const sc = STATUS_CONFIG[job.status] || STATUS_CONFIG.pending;
                  return (
                    <button
                      key={job.id}
                      onClick={() => section === 'pending' && navigate(`/approve?jobId=${job.id}`)}
                      className={`w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors ${section !== 'pending' ? 'cursor-default' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{job.address}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${sc.bg} ${sc.color} font-medium`}>
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-muted-foreground">{job.customer_name}</p>
                        <p className="text-xs font-semibold text-primary">
                          ${Number(job.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      {job.approval_timestamp && (
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          Signed {format(new Date(job.approval_timestamp), 'MMM d, yyyy')}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick action */}
        {!sectionJobs && (
          <button
            onClick={() => navigate('/search')}
            className="w-full flex items-center justify-between bg-primary text-primary-foreground rounded-2xl px-5 py-4 hover:bg-primary/90 transition-colors"
          >
            <div>
              <p className="text-sm font-semibold">Start Signing Flow</p>
              <p className="text-xs text-primary-foreground/80 mt-0.5">Search for a job to begin</p>
            </div>
            <ArrowRight className="w-5 h-5 shrink-0" />
          </button>
        )}

        {/* Recent activity */}
        {auditLogs.length > 0 && !sectionJobs && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Recent Activity</p>
            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
              {auditLogs.slice(0, 6).map(log => (
                <div key={log.id} className="px-4 py-3 flex items-start gap-3">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{log.detail || log.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.actor} · {log.timestamp ? format(new Date(log.timestamp), 'MMM d, h:mm a') : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}