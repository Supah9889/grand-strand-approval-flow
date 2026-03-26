import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, Loader2, Paperclip, MessageSquare, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import FileUploadArea from '../components/jobcomms/FileUploadArea';
import FileGrid from '../components/jobcomms/FileGrid';
import CommentThread from '../components/jobcomms/CommentThread';

const CATEGORY_LABEL = {
  before_photo: 'Before', progress_photo: 'Progress', after_photo: 'After',
  jobsite_photo: 'Jobsite', punch_list_photo: 'Punch List', warranty_photo: 'Warranty',
  estimate: 'Estimate', contract: 'Contract', signed_doc: 'Signed', proposal: 'Proposal',
  change_order: 'Change Order', invoice_support: 'Invoice', receipt: 'Receipt',
  permit: 'Permit', vendor_document: 'Vendor Doc', internal: 'Internal', other: 'Other',
};

export default function JobCommsDetail() {
  const jobId = new URLSearchParams(window.location.search).get('jobId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('files');
  const [showUpload, setShowUpload] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterVisibility, setFilterVisibility] = useState('all');

  const { data: job, isLoading: loadingJob } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => { const r = await base44.entities.Job.filter({ id: jobId }); return r[0]; },
    enabled: !!jobId,
  });

  const { data: files = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['job-files', jobId],
    queryFn: () => base44.entities.JobFile.filter({ job_id: jobId, archived: false }),
    enabled: !!jobId,
  });

  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['job-comments', jobId],
    queryFn: () => base44.entities.JobComment.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const filteredFiles = files
    .filter(f => filterCategory === 'all' || f.category === filterCategory)
    .filter(f => filterVisibility === 'all' || f.visibility === filterVisibility)
    .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));

  if (!jobId) return <AppLayout title="Job Files"><div className="flex-1 flex items-center justify-center"><p className="text-sm text-muted-foreground">No job selected.</p></div></AppLayout>;

  return (
    <AppLayout title="Job Files & Comms">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">

        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Header */}
        {loadingJob ? <div className="h-16 bg-muted rounded-2xl animate-pulse" /> : (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-0.5">Job Files & Communication</p>
            <p className="text-base font-bold text-foreground">{job?.address || job?.title || jobId}</p>
            {job?.customer_name && <p className="text-sm text-muted-foreground">{job.customer_name}</p>}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
              <span>{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Upload */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-muted/60 rounded-xl p-1 flex-1 mr-2">
            {[['files', <Paperclip className="w-3.5 h-3.5" />, 'Files'], ['comments', <MessageSquare className="w-3.5 h-3.5" />, 'Comments']].map(([tab, icon, label]) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${activeTab === tab ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                {icon}{label}
              </button>
            ))}
          </div>
          {activeTab === 'files' && (
            <Button size="sm" className="h-9 rounded-xl gap-1 text-xs shrink-0" onClick={() => setShowUpload(v => !v)}>
              <Plus className="w-3.5 h-3.5" /> Upload
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showUpload && activeTab === 'files' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <FileUploadArea
                jobId={jobId}
                jobAddress={job?.address || ''}
                onUploaded={() => { queryClient.invalidateQueries({ queryKey: ['job-files', jobId] }); queryClient.invalidateQueries({ queryKey: ['job-files-all'] }); setShowUpload(false); }}
                onClose={() => setShowUpload(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* File filters */}
        {activeTab === 'files' && (
          <div className="flex gap-2 flex-wrap">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger className="h-8 text-xs rounded-lg w-auto min-w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visibility</SelectItem>
                <SelectItem value="internal">Internal Only</SelectItem>
                <SelectItem value="client">Client Shared</SelectItem>
                <SelectItem value="vendor">Vendor Shared</SelectItem>
                <SelectItem value="both">Shared Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Content */}
        {activeTab === 'files' ? (
          loadingFiles ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          : <FileGrid files={filteredFiles} />
        ) : (
          loadingComments ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          : <CommentThread jobId={jobId} jobAddress={job?.address || ''} comments={comments} queryKey="job-comments" />
        )}
      </div>
    </AppLayout>
  );
}