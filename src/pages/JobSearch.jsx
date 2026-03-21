import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';

const STATUS_BADGE = {
  pending:  { label: 'Pending', class: 'bg-amber-50 text-amber-600' },
  approved: { label: 'Signed',  class: 'bg-secondary text-primary' },
  archived: { label: 'Archived',class: 'bg-muted text-muted-foreground' },
};

export default function JobSearch() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const filtered = jobs.filter(job => {
    if (job.status === 'archived') return false;
    const q = search.toLowerCase();
    return (
      !q ||
      job.address?.toLowerCase().includes(q) ||
      job.customer_name?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout title="Job Search">
      <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-5">

        <div>
          <h1 className="text-lg font-semibold text-foreground">Find a Job</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Search by address or customer name</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search address or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-muted/40 border-border text-sm"
            autoFocus
          />
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
                <button
                  key={job.id}
                  onClick={() => navigate(`/approve?jobId=${job.id}`)}
                  className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all duration-150"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground leading-snug">{job.address}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-muted-foreground">{job.customer_name}</p>
                    <p className="text-xs font-semibold text-primary">
                      ${Number(job.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {job.buildertrend_id && (
                    <p className="text-xs text-muted-foreground/60 mt-1">BT# {job.buildertrend_id}</p>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}