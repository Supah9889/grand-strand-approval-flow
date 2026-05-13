/**
 * JobSearchSelect — searchable, filterable job selector
 *
 * Props:
 *   value        — selected job id (string)
 *   onChange     — (jobId: string) => void
 *   jobs         — full list of Job records (caller supplies from React Query)
 *   filterActive — if true (default), only show active jobs
 *   placeholder  — optional placeholder string
 *   className    — optional wrapper class
 *
 * Future hooks already wired: filterActive, placeholder
 * Future extension points: pinnedIds, recentIds, assignedToEmployeeId (not yet implemented)
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Briefcase, X } from 'lucide-react';
import { isActiveJob } from '@/lib/jobHelpers';

function matchesSearch(job, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    job.address,
    job.customer_name,
    job.title,
    job.job_number,
    job.city,
    job.zip,
    job.description,
  ].some(v => String(v || '').toLowerCase().includes(q));
}

function JobOption({ job, selected, onSelect }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onSelect(job); }}
      className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:bg-muted/70
        ${selected ? 'bg-secondary text-primary font-medium' : 'text-foreground'}`}
    >
      <p className="text-sm truncate font-medium">{job.address || job.title || 'Untitled Job'}</p>
      {(job.customer_name || job.job_number) && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {[job.customer_name, job.job_number].filter(Boolean).join(' · ')}
        </p>
      )}
    </button>
  );
}

export default function JobSearchSelect({
  value,
  onChange,
  jobs = [],
  filterActive = true,
  placeholder = 'Search and select a job…',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Selected job record
  const selectedJob = useMemo(() => jobs.find(j => j.id === value) || null, [jobs, value]);

  // Filtered job list
  const displayJobs = useMemo(() => {
    const base = filterActive ? jobs.filter(isActiveJob) : jobs;
    return base.filter(j => matchesSearch(j, query));
  }, [jobs, filterActive, query]);

  // Close on outside click
  useEffect(() => {
    function handle(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function openDropdown() {
    setOpen(true);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSelect(job) {
    onChange(job.id);
    setOpen(false);
    setQuery('');
  }

  function handleClear(e) {
    e.stopPropagation();
    onChange('');
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button — shows selected job or placeholder */}
      <button
        type="button"
        onClick={openDropdown}
        className="w-full h-11 flex items-center gap-2 rounded-xl border border-input bg-card px-3 text-left transition-colors hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      >
        <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className={`flex-1 truncate text-sm ${selectedJob ? 'text-foreground' : 'text-muted-foreground'}`}>
          {selectedJob ? (selectedJob.address || selectedJob.title || 'Untitled Job') : placeholder}
        </span>
        {selectedJob
          ? <X className="w-4 h-4 text-muted-foreground hover:text-foreground shrink-0" onClick={handleClear} />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        }
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type address, customer, job #…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')}>
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-60 overflow-y-auto p-1.5">
            {displayJobs.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Briefcase className="w-5 h-5 mx-auto mb-2 opacity-40" />
                {query ? 'No jobs match your search.' : 'No active jobs available.'}
              </div>
            ) : (
              displayJobs.map(job => (
                <JobOption
                  key={job.id}
                  job={job}
                  selected={job.id === value}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}