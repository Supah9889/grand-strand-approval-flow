import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import BottomSheetSelect from '@/components/BottomSheetSelect';
import PullToRefresh from '@/components/PullToRefresh';
import MobileStatusIndicator from '@/components/MobileStatusIndicator';
import { Search, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import JobLifecycleBadge from '../components/jobs/JobLifecycleBadge';
import JobGroupBadge from '../components/jobs/JobGroupBadge';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { JOB_GROUP_CONFIG, JOB_LIFECYCLE_CONFIG } from '@/lib/jobHelpers';

const STATUS_BADGE = {
  pending:  { label: 'Pending', class: 'bg-amber-50 text-amber-600' },
  approved: { label: 'Signed',  class: 'bg-secondary text-primary' },
  archived: { label: 'Archived',class: 'bg-muted text-muted-foreground' },
};

export default function JobSearch() {
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterLifecycle, setFilterLifecycle] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: liveJobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const { data: jobs = [], isCached, isOnline } = useOfflineCache(['jobs'], liveJobs, true);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['jobs'] });
    setIsRefreshing(false);
  };

  const filtered = jobs.filter(job => {
    if (job.status === 'archived' && filterLifecycle !== 'archived') return false;
    if (filterGroup !== 'all' && job.job_group !== filterGroup) return false;
    if (filterLifecycle !== 'all' && (job.lifecycle_status || 'open') !== filterLifecycle) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      job.address?.toLowerCase().includes(q) ||
      job.customer_name?.toLowerCase().includes(q) ||
      job.title?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout title="Job Search">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-5">

        {!isOnline && (
          <MobileStatusIndicator status="offline" isOnline={false} />
        )}
        {isCached && isOnline && (
          <MobileStatusIndicator status="idle" message="Cached data (syncing...)" autoHide={true} />
        )}

        <div>
          <h1 className="text-lg font-semibold text-foreground">Find a Job</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Search by address or customer name</p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search address, customer, title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search jobs by address or customer name"
              className="pl-10 h-12 rounded-xl bg-muted/40 border-border text-sm"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <BottomSheetSelect value={filterLifecycle} onChange={setFilterLifecycle} label="Status" options={[
              { label: 'All Statuses', value: 'all' },
              ...Object.entries(JOB_LIFECYCLE_CONFIG).map(([v, c]) => ({ label: c.label, value: v })),
            ]} />
            <BottomSheetSelect value={filterGroup} onChange={setFilterGroup} label="Group" options={[
              { label: 'All Groups', value: 'all' },
              ...Object.entries(JOB_GROUP_CONFIG).map(([v, c]) => ({ label: c.label, value: v })),
            ]} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">
              {search ? 'No jobs match your search.' : 'No pending jobs found.'}
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {filtered.map((job) => {
              const badge = STATUS_BADGE[job.status] || STATUS_BADGE.pending;
              return (
                <div
                  key={job.id}
                  className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all duration-150"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">{job.address}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>
                  {job.title && <p className="text-xs text-muted-foreground">{job.title}</p>}
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-muted-foreground">{job.customer_name}</p>
                    <p className="text-xs font-semibold text-primary">
                      ${Number(job.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {job.lifecycle_status && <JobLifecycleBadge status={job.lifecycle_status} />}
                    {job.job_group && <JobGroupBadge group={job.job_group} />}
                  </div>
                  {job.buildertrend_id && (
                    <p className="text-xs text-muted-foreground/60 mt-1">BT# {job.buildertrend_id}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => navigate(`/approve?jobId=${job.id}`)} 
                      aria-label={`Sign or view job at ${job.address}`}
                      className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Sign / View
                    </button>
                    <button 
                      onClick={() => navigate(`/job-hub?jobId=${job.id}`)} 
                      aria-label={`View hub for job at ${job.address}`}
                      className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      Job Hub
                    </button>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </div>
    </PullToRefresh>
    </AppLayout>
  );
}