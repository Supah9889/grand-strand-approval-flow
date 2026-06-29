import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Droplets, Wind, FlaskConical, Cpu, AlertTriangle,
  ChevronRight, Loader2, Clock, XCircle
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useCompanyGuard, NoAccessState } from '@/components/CompanyGuard';
import usePermissions from '@/hooks/usePermissions';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

function MetricCard({ label, value, sub, icon: Icon, colorClass, onClick }) {
  return (
    <button onClick={onClick} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 text-left hover:bg-muted/30 transition-colors w-full">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs font-medium text-foreground">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </button>
  );
}

function JobDocCard({ job, readings, dryingLogs, airSamples, navigate }) {
  const jobReadings = readings.filter(r => r.job_id === job.id);
  const jobLogs = dryingLogs.filter(d => d.job_id === job.id);
  const jobSamples = airSamples.filter(a => a.job_id === job.id);
  const failedSamples = jobSamples.filter(s => s.result_status === 'failed');
  const pendingSamples = jobSamples.filter(s => s.result_status === 'pending');
  const hasAlert = failedSamples.length > 0;

  return (
    <div className={`bg-card border rounded-xl p-3 ${hasAlert ? 'border-red-300' : 'border-border'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{job.address}</p>
          <p className="text-xs text-muted-foreground">{job.customer_name}</p>
        </div>
        {hasAlert && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{jobReadings.length} rdgs</span>
        <span className="flex items-center gap-1"><Wind className="w-3 h-3" />{jobLogs.length} logs</span>
        <span className="flex items-center gap-1"><FlaskConical className="w-3 h-3" />{jobSamples.length} samples</span>
      </div>
      {failedSamples.length > 0 && (
        <p className="text-xs text-red-600 font-medium mb-2">{failedSamples.length} failed air sample{failedSamples.length > 1 ? 's' : ''}</p>
      )}
      {pendingSamples.length > 0 && (
        <p className="text-xs text-amber-600 font-medium mb-2">{pendingSamples.length} pending result{pendingSamples.length > 1 ? 's' : ''}</p>
      )}
      <button
        onClick={() => navigate(`/jobs/${job.id}/documentation`)}
        className="w-full h-8 rounded-lg bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/20 transition-colors"
      >
        View Documentation <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function RestorationHub() {
  const navigate = useNavigate();
  const company = getActiveCompany();
  const { canManageRestoration } = usePermissions();
  const companyGuard = useCompanyGuard('Select a company to access Restoration documentation.');

  const cid = company?.id;

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['resto-jobs', cid],
    queryFn: () => cid
      ? base44.entities.Job.filter({ company_id: cid }, '-created_date', 100)
      : Promise.resolve([]),
    enabled: !!cid,
  });

  const { data: readings = [] } = useQuery({
    queryKey: ['resto-readings', cid],
    queryFn: () => cid
      ? base44.entities.MoistureReading.filter({ company_id: cid }, '-taken_at', 200)
      : Promise.resolve([]),
    enabled: !!cid,
  });

  const { data: dryingLogs = [] } = useQuery({
    queryKey: ['resto-drying', cid],
    queryFn: () => cid
      ? base44.entities.DryingLog.filter({ company_id: cid }, '-log_date', 200)
      : Promise.resolve([]),
    enabled: !!cid,
  });

  const { data: airSamples = [] } = useQuery({
    queryKey: ['resto-samples', cid],
    queryFn: () => cid
      ? base44.entities.AirSampleTest.filter({ company_id: cid }, '-sample_date', 200)
      : Promise.resolve([]),
    enabled: !!cid,
  });

  const { data: equipment = [] } = useQuery({
    queryKey: ['resto-equipment', cid],
    queryFn: () => cid
      ? base44.entities.RestorationEquipment.filter({ company_id: cid })
      : Promise.resolve([]),
    enabled: !!cid,
  });

  const activeJobs = useMemo(() => jobs.filter(j => ['in_progress', 'scheduled', 'open', 'new'].includes(j.lifecycle_status)), [jobs]);
  const deployedEquipment = useMemo(() => equipment.filter(e => e.status === 'deployed'), [equipment]);
  const failedSamples = useMemo(() => airSamples.filter(s => s.result_status === 'failed'), [airSamples]);
  const pendingSamples = useMemo(() => airSamples.filter(s => s.result_status === 'pending'), [airSamples]);

  // Jobs missing drying logs today
  const todayISO = new Date().toISOString().split('T')[0];
  const jobsWithLogsToday = new Set(dryingLogs.filter(d => d.log_date === todayISO).map(d => d.job_id));
  const jobsMissingLogs = activeJobs.filter(j => !jobsWithLogsToday.has(j.id));

  if (companyGuard) return <AppLayout title="Restoration Hub">{companyGuard}</AppLayout>;
  if (!canManageRestoration) return (
    <AppLayout title="Restoration Hub">
      <NoAccessState message="You do not have permission to access restoration documentation." />
    </AppLayout>
  );

  if (isLoading) return (
    <AppLayout title="Restoration Hub">
      <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
    </AppLayout>
  );

  return (
    <AppLayout title="Restoration Hub">
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24 space-y-5">

        <div>
          <h1 className="text-base font-semibold">Restoration Hub</h1>
          {company && <p className="text-xs text-muted-foreground">{company.name}</p>}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Active Jobs" value={activeJobs.length} icon={Droplets} colorClass="bg-blue-100 text-blue-600" onClick={() => navigate('/search')} />
          <MetricCard label="Deployed Equipment" value={deployedEquipment.length} icon={Cpu} colorClass="bg-indigo-100 text-indigo-600" onClick={() => navigate('/equipment')} />
          <MetricCard label="Failed Samples" value={failedSamples.length} icon={XCircle} colorClass="bg-red-100 text-red-600" onClick={() => navigate('/air-samples')} sub={failedSamples.length > 0 ? 'Needs attention' : 'All clear'} />
          <MetricCard label="Pending Results" value={pendingSamples.length} icon={Clock} colorClass="bg-amber-100 text-amber-600" onClick={() => navigate('/air-samples')} />
        </div>

        {/* Alerts */}
        {(failedSamples.length > 0 || jobsMissingLogs.length > 0) && (
          <div className="space-y-2">
            {failedSamples.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 font-medium">{failedSamples.length} failed air sample{failedSamples.length > 1 ? 's' : ''} need review</p>
                <button onClick={() => navigate('/air-samples')} className="ml-auto text-xs text-red-600 hover:underline shrink-0">View</button>
              </div>
            )}
            {jobsMissingLogs.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-sm text-amber-700 font-medium">{jobsMissingLogs.length} active job{jobsMissingLogs.length > 1 ? 's' : ''} missing today's drying log</p>
              </div>
            )}
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Moisture Readings', path: '/moisture-readings', icon: Droplets, color: 'text-blue-600' },
            { label: 'Drying Logs', path: '/drying-logs', icon: Wind, color: 'text-cyan-600' },
            { label: 'Air Samples', path: '/air-samples', icon: FlaskConical, color: 'text-purple-600' },
            { label: 'Equipment', path: '/equipment', icon: Cpu, color: 'text-indigo-600' },
          ].map(({ label, path, icon: Icon, color }) => (
            <button key={path} onClick={() => navigate(path)}
              className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5 hover:bg-muted/30 transition-colors text-left">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-sm font-medium text-foreground">{label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
            </button>
          ))}
        </div>

        {/* Active job documentation */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Jobs — Documentation</h2>
          </div>
          {activeJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No active jobs</p>
          ) : (
            <div className="space-y-2">
              {activeJobs.map(job => (
                <JobDocCard
                  key={job.id}
                  job={job}
                  readings={readings}
                  dryingLogs={dryingLogs}
                  airSamples={airSamples}
                  navigate={navigate}
                />
              ))}
            </div>
          )}
        </section>

      </div>
    </AppLayout>
  );
}
