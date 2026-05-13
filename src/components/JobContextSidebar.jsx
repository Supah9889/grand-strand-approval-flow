import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Loader2, MapPin, Plus, Search, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getInternalRole } from '@/lib/adminAuth';
import JobStatusBadge from '@/components/jobs/JobStatusBadge';

function getCurrentJobId(location) {
  const params = new URLSearchParams(location.search);
  return params.get('jobId') || params.get('job_id') || '';
}

function getJobTitle(job) {
  return job?.title || job?.customer_name || job?.address || 'Untitled Job';
}

function getJobSubtitle(job) {
  if (!job) return '';
  if (job.title && job.address) return job.address;
  if (job.customer_name && job.address) return `${job.customer_name} - ${job.address}`;
  return job.job_number || job.description || '';
}

function sortJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const aArchived = a.status === 'archived' || a.lifecycle_status === 'archived';
    const bArchived = b.status === 'archived' || b.lifecycle_status === 'archived';
    if (aArchived !== bArchived) return aArchived ? 1 : -1;
    return String(b.created_date || '').localeCompare(String(a.created_date || ''));
  });
}

function useWorkspaceJobs() {
  return useQuery({
    queryKey: ['workspace-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
    staleTime: 60_000,
  });
}

function JobContextSummary({ job }) {
  if (!job) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
        <p className="text-sm font-semibold text-foreground">No job selected</p>
        <p className="mt-1 text-xs text-muted-foreground">Choose a job to set the workspace context.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-secondary/70 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{getJobTitle(job)}</p>
          {job.address && (
            <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2">{job.address}</span>
            </p>
          )}
        </div>
        <JobStatusBadge status={job.op_status || 'new'} size="sm" />
      </div>
    </div>
  );
}

function JobListItem({ job, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        active
          ? 'border-primary bg-secondary text-primary shadow-sm'
          : 'border-transparent bg-transparent text-foreground hover:border-border hover:bg-muted/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{getJobTitle(job)}</p>
          {getJobSubtitle(job) && (
            <p className={`mt-1 line-clamp-2 text-xs ${active ? 'text-primary/80' : 'text-muted-foreground'}`}>
              {getJobSubtitle(job)}
            </p>
          )}
        </div>
        <JobStatusBadge status={job.op_status || 'new'} size="sm" />
      </div>
    </button>
  );
}

export function MobileJobContextBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentJobId = getCurrentJobId(location);
  const { data: jobs = [] } = useWorkspaceJobs();
  const currentJob = jobs.find(job => job.id === currentJobId);

  if (!currentJobId) return null;

  return (
    <button
      type="button"
      onClick={() => currentJob && navigate(`/job-hub?jobId=${currentJob.id}`)}
      className="flex min-h-0 w-full items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 text-left lg:hidden"
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Job</p>
        <p className="truncate text-sm font-semibold text-foreground">{getJobTitle(currentJob)}</p>
        {currentJob?.address && <p className="truncate text-xs text-muted-foreground">{currentJob.address}</p>}
      </div>
      {currentJob && <JobStatusBadge status={currentJob.op_status || 'new'} size="sm" />}
    </button>
  );
}

export default function JobContextSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = getInternalRole();
  const currentJobId = getCurrentJobId(location);
  const [searchText, setSearchText] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const { data: jobs = [], isLoading, isError } = useWorkspaceJobs();

  const INACTIVE_STATUSES = new Set(['archived', 'canceled', 'closed']);

  const sortedJobs = useMemo(() => sortJobs(jobs), [jobs]);
  const filteredJobs = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return sortedJobs.filter(job => {
      const ls = job?.lifecycle_status || '';
      if (!showInactive && INACTIVE_STATUSES.has(ls)) return false;
      if (!query) return true;
      return [
        job.title,
        job.address,
        job.customer_name,
        job.job_number,
        job.op_status,
        job.lifecycle_status,
      ].some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [searchText, sortedJobs, showInactive]);

  const currentJob = jobs.find(job => job.id === currentJobId);
  const canCreateJob = role === 'admin' || role === 'owner';

  return (
    <aside className="hidden w-80 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
      <div className="border-b border-border px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job Workspace</p>
            <p className="text-sm font-semibold text-foreground">Current context</p>
          </div>
          {canCreateJob && (
            <button
              type="button"
              onClick={() => navigate('/new-job')}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
              aria-label="Create new job"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
        <JobContextSummary job={currentJob} />
      </div>

      <div className="border-b border-border px-4 py-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Search jobs..."
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jobs</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInactive(v => !v)}
            title={showInactive ? 'Hide archived/closed' : 'Show archived/closed'}
            className={`flex items-center gap-1 min-h-0 text-xs rounded-lg px-2 py-1 transition-colors ${
              showInactive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Filter className="h-3 w-3" />
            {showInactive ? 'All' : 'Active'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="min-h-0 text-xs font-semibold text-primary hover:text-primary/80"
          >
            Search
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {isLoading && (
          <div className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading jobs...
          </div>
        )}
        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Could not load jobs.
          </div>
        )}
        {!isLoading && !isError && filteredJobs.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            <Briefcase className="mx-auto mb-2 h-5 w-5" />
            No matching jobs.
          </div>
        )}
        <div className="space-y-1">
          {filteredJobs.map(job => (
            <JobListItem
              key={job.id}
              job={job}
              active={job.id === currentJobId}
              onClick={() => navigate(`/job-hub?jobId=${job.id}`)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}