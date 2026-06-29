import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Loader2, MapPin, Plus, Search, Archive } from 'lucide-react';
import { getInternalRole } from '@/lib/adminAuth';
import { getCurrentCompany } from '@/lib/permissions';
import { fetchCompanyJobs } from '@/lib/companyScopedQueries';
import { isActiveJob } from '@/lib/jobHelpers';
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
    const aArchived = isJobArchived(a);
    const bArchived = isJobArchived(b);
    if (aArchived !== bArchived) return aArchived ? 1 : -1;
    return String(b.updated_date || b.created_date || '').localeCompare(String(a.updated_date || a.created_date || ''));
  });
}

function useWorkspaceJobs() {
  const activeCompany = getCurrentCompany();
  const activeCompanyId = activeCompany?.id;
  return useQuery({
    queryKey: ['workspace-jobs', activeCompanyId],
    queryFn: () => fetchCompanyJobs(activeCompanyId, '-updated_date'),
    enabled: !!activeCompanyId,
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

function isJobArchived(job) {
  return job?.lifecycle_status === 'archived' || job?.status === 'archived' || job?.archived === true;
}

function matchesJobSearch(job, query) {
  if (!query) return true;
  const fields = [
    job.title,
    job.address,
    job.customer_name,
    job.job_number,
    job.buildertrend_id,
    job.buildertrendId,
    job.city,
    job.state,
    job.zip,
    job.customer_phone,
    job.customer_email,
    job.phone,
    job.email,
    job.description,
    job.op_status,
    job.lifecycle_status,
    job.status,
  ];
  return fields.some(v => String(v || '').toLowerCase().includes(query));
}

function matchesViewTab(job, viewTab) {
  if (viewTab === 'all') return true;
  if (viewTab === 'archived') return isJobArchived(job);
  return isActiveJob(job);
}

function JobListItem({ job, active, onClick }) {
  const archived = isJobArchived(job);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        active
          ? 'border-primary bg-secondary text-primary shadow-sm'
          : archived
            ? 'border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted/40 opacity-70'
            : 'border-transparent bg-transparent text-foreground hover:border-border hover:bg-muted/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{getJobTitle(job)}</p>
          {getJobSubtitle(job) && (
            <p className={`mt-1 line-clamp-2 text-xs ${active ? 'text-primary/80' : 'text-muted-foreground'}`}>
              {getJobSubtitle(job)}
            </p>
          )}
          {archived && (
            <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              <Archive className="w-2.5 h-2.5" /> Archived
            </span>
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

// Filter tab options
const VIEW_TABS = [
  { key: 'active',    label: 'Active' },
  { key: 'archived',  label: 'Archived' },
  { key: 'all',       label: 'All' },
];

export default function JobContextSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = getInternalRole();
  const currentJobId = getCurrentJobId(location);
  const [searchText, setSearchText] = useState('');
  const [viewTab, setViewTab] = useState('active');
  const jobListRef = useRef(null);
  const { data: jobs = [], isLoading, isError } = useWorkspaceJobs();

  const sortedJobs = useMemo(() => sortJobs(jobs), [jobs]);

  const query = searchText.trim().toLowerCase();

  const filteredJobs = useMemo(() => {
    return sortedJobs.filter(job => {
      // Always show the currently active job regardless of filter
      if (job.id === currentJobId) {
        return matchesJobSearch(job, query);
      }

      return matchesViewTab(job, viewTab) && matchesJobSearch(job, query);
    });
  }, [query, sortedJobs, viewTab, currentJobId]);

  const searchMatches = useMemo(() => {
    if (!query) return [];
    return sortedJobs.filter(job => matchesJobSearch(job, query));
  }, [query, sortedJobs]);

  const excludedByCurrentFilter = useMemo(() => {
    if (!query) return [];
    return searchMatches.filter(job => !matchesViewTab(job, viewTab) && job.id !== currentJobId);
  }, [query, searchMatches, viewTab, currentJobId]);

  const currentJob = jobs.find(job => job.id === currentJobId);
  const canCreateJob = role === 'admin' || role === 'owner';

  useEffect(() => {
    if (jobListRef.current) {
      jobListRef.current.scrollTop = 0;
    }
  }, [searchText, viewTab]);

  const handleSearchChange = (event) => {
    setSearchText(event.target.value);
  };

  return (
    <aside className="hidden h-full min-h-0 w-80 shrink-0 overflow-hidden border-r border-border bg-card lg:flex lg:flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-4">
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

      <div className="shrink-0 border-b border-border bg-card px-4 py-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchText}
            onChange={handleSearchChange}
            placeholder="Search jobs..."
            className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </div>

      <div className="shrink-0 space-y-2 border-b border-border bg-card px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {VIEW_TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setViewTab(tab.key)}
                className={`min-h-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  viewTab === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="min-h-0 text-xs font-semibold text-primary hover:text-primary/80"
          >
            Search
          </button>
        </div>
      </div>

      <div ref={jobListRef} className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-3 pb-4 pt-3">
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
            {excludedByCurrentFilter.length > 0 ? (
              <>
                <p>No matching jobs in {viewTab}.</p>
                <button
                  type="button"
                  onClick={() => setViewTab('all')}
                  className="mt-2 text-xs font-semibold text-primary hover:text-primary/80"
                >
                  Show {excludedByCurrentFilter.length} result{excludedByCurrentFilter.length !== 1 ? 's' : ''} in All
                </button>
              </>
            ) : (
              <p>No matching jobs.</p>
            )}
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
