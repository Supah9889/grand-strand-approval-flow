import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Search, Loader2, FolderOpen, Plus, X, Paperclip, MessageSquare, Filter } from 'lucide-react';
import { format, parseISO, isToday, startOfWeek, isAfter } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import FileUploadArea from '../components/jobcomms/FileUploadArea';
import FileGrid from '../components/jobcomms/FileGrid';
import CommentThread from '../components/jobcomms/CommentThread';
import { getInternalRole } from '@/lib/adminAuth';

const CATEGORY_LABEL = {
  before_photo: 'Before', progress_photo: 'Progress', after_photo: 'After',
  jobsite_photo: 'Jobsite', punch_list_photo: 'Punch List', warranty_photo: 'Warranty',
  estimate: 'Estimate', contract: 'Contract', signed_doc: 'Signed', proposal: 'Proposal',
  change_order: 'Change Order', invoice_support: 'Invoice', receipt: 'Receipt',
  permit: 'Permit', vendor_document: 'Vendor Doc', internal: 'Internal', other: 'Other',
};

const STAT_GROUPS = [
  { key: 'total_files',    label: 'Total Files',    color: 'text-slate-700',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  { key: 'today_files',    label: 'Uploaded Today', color: 'text-primary',    bg: 'bg-secondary', border: 'border-primary/20' },
  { key: 'total_comments', label: 'Comments',       color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: 'shared_files',   label: 'Shared Items',   color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
];

export default function JobComms() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [activeTab, setActiveTab] = useState('files');
  const [showUpload, setShowUpload] = useState(false);
  const [selectedJob, setSelectedJob] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterVisibility, setFilterVisibility] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');

  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['job-files-all'],
    queryFn: () => base44.entities.JobFile.filter({ archived: false }),
  });

  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['job-comments-all'],
    queryFn: () => base44.entities.JobComment.list('-created_date'),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const stats = useMemo(() => ({
    total_files: files.length,
    today_files: files.filter(f => f.created_date && isToday(parseISO(f.created_date))).length,
    total_comments: comments.length,
    shared_files: files.filter(f => f.visibility !== 'internal').length,
  }), [files, comments]);

  const filteredFiles = useMemo(() => {
    let list = files;
    if (selectedJob !== 'all') list = list.filter(f => f.job_id === selectedJob);
    if (filterCategory !== 'all') list = list.filter(f => f.category === filterCategory);
    if (filterVisibility !== 'all') list = list.filter(f => f.visibility === filterVisibility);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(f => f.file_name?.toLowerCase().includes(q) || f.description?.toLowerCase().includes(q) || f.job_address?.toLowerCase().includes(q));
    }
    if (sort === 'newest') list = [...list].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
    if (sort === 'oldest') list = [...list].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
    if (sort === 'alpha') list = [...list].sort((a, b) => (a.file_name || '').localeCompare(b.file_name || ''));
    return list;
  }, [files, selectedJob, filterCategory, filterVisibility, search, sort]);

  const filteredComments = useMemo(() => {
    let list = comments;
    if (selectedJob !== 'all') list = list.filter(c => c.job_id === selectedJob);
    if (filterVisibility !== 'all') list = list.filter(c => c.visibility === filterVisibility);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.body?.toLowerCase().includes(q) || c.author_name?.toLowerCase().includes(q) || c.job_address?.toLowerCase().includes(q));
    }
    return list;
  }, [comments, selectedJob, filterVisibility, search]);

  const selectedJobObj = jobs.find(j => j.id === selectedJob);

  return (
    <AppLayout title="Job Files & Comms">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Files & Communication</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Job documents, photos, comments & notes</p>
          </div>
          <Button className="h-9 rounded-xl text-sm gap-1.5" onClick={() => setShowUpload(v => !v)}>
            <Plus className="w-3.5 h-3.5" /> Upload
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {STAT_GROUPS.map(g => (
            <div key={g.key} className={`text-left p-3 rounded-xl border-2 ${g.bg} ${g.border}`}>
              <p className={`text-lg font-bold leading-none ${g.color}`}>{stats[g.key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{g.label}</p>
            </div>
          ))}
        </div>

        {/* Upload panel */}
        <AnimatePresence>
          {showUpload && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <FileUploadArea
                jobId={selectedJob !== 'all' ? selectedJob : ''}
                jobAddress={selectedJobObj?.address || ''}
                onUploaded={() => { queryClient.invalidateQueries({ queryKey: ['job-files-all'] }); setShowUpload(false); }}
                onClose={() => setShowUpload(false)}
              />
              {selectedJob === 'all' && (
                <div className="mt-2 px-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Select Job</label>
                  <Select value={selectedJob} onValueChange={setSelectedJob}>
                    <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="All jobs" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">— No specific job —</SelectItem>
                      {jobs.filter(j => j.status !== 'archived').map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted/60 rounded-xl p-1">
          {[['files', <Paperclip className="w-3.5 h-3.5" />, 'Files'], ['comments', <MessageSquare className="w-3.5 h-3.5" />, 'Comments']].map(([tab, icon, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={activeTab === 'files' ? 'Search files...' : 'Search comments...'} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 rounded-xl text-sm" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedJob} onValueChange={setSelectedJob}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {jobs.filter(j => j.status !== 'archived').map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {activeTab === 'files' && (
              <>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {Object.entries(CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="alpha">A–Z</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visibility</SelectItem>
                <SelectItem value="internal">Internal Only</SelectItem>
                <SelectItem value="client">Client Shared</SelectItem>
                <SelectItem value="vendor">Vendor Shared</SelectItem>
                <SelectItem value="both">Shared Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'files' ? (
          loadingFiles ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          : <FileGrid files={filteredFiles} />
        ) : (
          loadingComments ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          : (
            <div className="space-y-3">
              {filteredComments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No comments found.</p>
              ) : (
                [...filteredComments].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || '')).map(c => (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">{c.author_name}</p>
                      <p className="text-xs text-muted-foreground">{c.job_address || ''}</p>
                    </div>
                    <p className="text-sm text-foreground">{c.body}</p>
                    <p className="text-xs text-muted-foreground/60">{c.created_date ? format(parseISO(c.created_date), 'MMM d, yyyy · h:mm a') : ''}</p>
                  </div>
                ))
              )}
            </div>
          )
        )}
      </div>
    </AppLayout>
  );
}