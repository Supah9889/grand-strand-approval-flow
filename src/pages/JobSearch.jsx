import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import CompanyLogo from '../components/CompanyLogo';
import JobCard from '../components/JobCard';

export default function JobSearch() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date'),
  });

  const filtered = jobs.filter(job => {
    const q = search.toLowerCase();
    return (
      job.address?.toLowerCase().includes(q) ||
      job.customer_name?.toLowerCase().includes(q)
    );
  });

  const handleSelect = (job) => {
    navigate(`/approve?jobId=${job.id}`);
  };

  return (
    <div className="min-h-screen bg-background font-inter">
      <div className="max-w-lg mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8"
        >
          <CompanyLogo className="h-14 w-auto mb-6" />
          <h1 className="text-2xl font-semibold text-foreground">Find Your Job</h1>
          <p className="text-muted-foreground text-sm mt-1">Search by address or customer name</p>
        </motion.div>

        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search address or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 rounded-xl bg-muted/50 border-border text-sm"
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
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            {filtered.map((job) => (
              <JobCard key={job.id} job={job} onSelect={handleSelect} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}