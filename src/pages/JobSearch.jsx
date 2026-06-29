import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import BottomSheetSelect from '@/components/BottomSheetSelect';
import PullToRefresh from '@/components/PullToRefresh';
import MobileStatusIndicator from '@/components/MobileStatusIndicator';
import { Search, Loader2, Trash2, Archive, CheckSquare, Square } from 'lucide-react';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import JobGroupBadge from '../components/jobs/JobGroupBadge';
import JobStatusBadge from '../components/jobs/JobStatusBadge';
import { useOfflineCache } from '@/hooks/useOfflineCache';
import { JOB_GROUP_CONFIG, OP_STATUS_FILTER_BUCKETS, isBuildertrendImportedJob } from '@/lib/jobHelpers';
import DocumentPreviewModal from '@/components/shared/DocumentPreviewModal';
import { isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { getCurrentCompany } from '@/lib/permissions';
import { fetchCompanyJobs } from '@/lib/companyScopedQueries';
import { JOB_PRIMARY_ACTIONS, buildSignedDocPreview, getJobPrimaryAction } from '@/lib/signedDocHelpers';
import JobRemovalModal from '@/components/jobs/JobRemovalModal';
import { toast } from 'sonner';

const VIEW_TABS = [
  { key: 'active',   label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'all',      label: 'All' },
];

const STATUS_BADGE = {
  pending:  { label: 'Pending',  class: 'bg-amber-50 text-amber-600' },
  approved: { label: 'Signed',   class: 'bg-secondary text-primary' },
  imported: { label: 'Imported', class: 'bg-slate-100 text-slate-600' },
  archived: { label: 'Archived', class: 'bg-muted text-muted-foreground' },
};

export default function JobSearch() {
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [filterOpStatus, setFilterOpStatus] = useState('all');
  const [viewTab, setViewTab] = useState('active');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [removalModal, setRemovalModal] = useState(null); // { jobs, mode }
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = getIsAdmin();
  const canUploadWorkOrder = isAdmin;
  const activeCompany = getCurrentCompany();
  const activeCompanyId = activeCompany?.id;

  const { data: liveJobs = [], isLoading } = useQuery({
    queryKey: ['jobs', activeCompanyId],
    queryFn: () => fetchCompanyJobs(activeCompanyId, '-created_date'),
    enabled: !!activeCompanyId,
  });

  const { data: jobs = [], isCached, isOnline } = useOfflineCache(['jobs', activeCompanyId], liveJobs, true);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['jobs'] });
    setIsRefreshing(false);
  };

  const filtered = jobs.filter(job => {
    const ls = job?.lifecycle_status || 'open';
    if (viewTab === 'active'   && ls === 'archived') return false;
    if (viewTab === 'archived' && ls !== 'archived') return false;
    if (filterGroup !== 'all' && job?.job_group !== filterGroup) return false;
    if (filterOpStatus !== 'all') {
      const bucket = OP_STATUS_FILTER_BUCKETS.find(b => b.key === filterOpStatus);
      const jobOpStatus = job?.op_status || 'new';
      if (bucket?.statuses && !bucket.statuses.includes(jobOpStatus)) return false;
    }
    const q = search.toLowerCase();
    return (
      !q ||
      job?.address?.toLowerCase().includes(q) ||
      job?.customer_name?.toLowerCase().includes(q) ||
      job?.title?.toLowerCase().includes(q)
    );
  });

  const resolveSignedDocPreview = async (job, doc) => {
    if (!doc?.isR2Backed) return doc;
    const response = await base44.functions.invoke('requestR2ReadUrl', {
      jobId: job.id,
      fileKey: doc.r2Key,
      category: 'signed_doc',
      purpose: 'preview_signed_document',
    });
    const data = response?.data || response;
    if (!data?.signedUrl) throw new Error('R2 read URL request failed.');
    return { ...doc, url: data.signedUrl };
  };

  const handlePrimaryAction = async (job) => {
    const action = getJobPrimaryAction(job, [], { canUploadWorkOrder });
    if (action.type === JOB_PRIMARY_ACTIONS.VIEW_SIGNED_DOCUMENT) {
      const doc = buildSignedDocPreview(job);
      if (doc) {
        try { setPreviewDoc(await resolveSignedDocPreview(job, doc)); } catch (e) { toast.error(e?.message || 'Could not open signed document.'); }
        return;
      }
    }
    if (action.type === JOB_PRIMARY_ACTIONS.UPLOAD_WORK_ORDER || action.type === JOB_PRIMARY_ACTIONS.SIGNED_DOCUMENT_MISSING) {
      navigate(`/job-hub?jobId=${job.id}`); return;
    }
    if (!action.disabled) navigate(`/approve?jobId=${job.id}`);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const openRemovalModal = (mode) => {
    const selected = filtered.filter(j => selectedIds.has(j.id));
    if (!selected.length) return;
    setRemovalModal({ jobs: selected, mode });
  };

  const handleRemovalSuccess = (report) => {
    const total = (report?.archived?.length || 0) + (report?.hardDeleted?.length || 0);
    toast.success(`${total} job${total !== 1 ? 's' : ''} processed`);
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    exitSelectionMode();
    setRemovalModal(null);
  };

  return (
    <AppLayout title="Job Search">
      <DocumentPreviewModal
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        url={previewDoc?.url}
        title={previewDoc?.title}
        docType={previewDoc?.docType}
      />
      {removalModal && (
        <JobRemovalModal
          jobs={removalModal.jobs}
          mode={removalModal.mode}
          onClose={() => setRemovalModal(null)}
          onSuccess={handleRemovalSuccess}
        />
      )}

      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">

          {!isOnline && <MobileStatusIndicator status="offline" isOnline={false} />}
          {isCached && isOnline && <MobileStatusIndicator status="idle" message="Cached data (syncing...)" autoHide={true} />}

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">Jobs</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Search by address or customer name</p>
            </div>
            {isAdmin && !selectionMode && (
              <button
                onClick={() => setSelectionMode(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Select
              </button>
            )}
            {isAdmin && selectionMode && (
              <button onClick={exitSelectionMode} className="text-xs text-primary px-2 py-1.5 rounded-lg hover:bg-muted">
                Cancel
              </button>
            )}
          </div>

          {/* View tabs: Active / Archived / All */}
          <div className="flex gap-1 border-b border-border pb-1">
            {VIEW_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setViewTab(t.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  viewTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Batch action bar */}
          {selectionMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-xl px-3 py-2">
              <span className="text-xs font-medium text-foreground flex-1">{selectedIds.size} selected</span>
              <button
                onClick={() => openRemovalModal('archive')}
                className="flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2.5 py-1.5 rounded-lg hover:bg-amber-200 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
              <button
                onClick={() => openRemovalModal('delete')}
                className="flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2.5 py-1.5 rounded-lg hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}

          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search address, customer, title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-12 rounded-xl bg-muted/40 border-border text-sm"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <BottomSheetSelect value={filterOpStatus} onChange={setFilterOpStatus} label="Status" options={OP_STATUS_FILTER_BUCKETS.map(b => ({ label: b.label, value: b.key }))} />
              <BottomSheetSelect value={filterGroup} onChange={setFilterGroup} label="Group" options={[
                { label: 'All Groups', value: 'all' },
                ...Object.entries(JOB_GROUP_CONFIG).map(([v, c]) => ({ label: c.label, value: v })),
              ]} />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">{search ? 'No jobs match your search.' : `No ${viewTab === 'archived' ? 'archived' : 'active'} jobs found.`}</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
              {filtered.map((job) => {
                const isBtImported = isBuildertrendImportedJob(job);
                const badge = isBtImported ? STATUS_BADGE.imported : (STATUS_BADGE[job?.status] || STATUS_BADGE.pending);
                const primaryAction = getJobPrimaryAction(job, [], { canUploadWorkOrder });
                const isSelected = selectedIds.has(job?.id);
                const isArchived = job?.lifecycle_status === 'archived';

                return (
                  <div
                    key={job.id}
                    className={`w-full text-left bg-card border rounded-xl p-4 transition-all duration-150 ${
                      isSelected ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/40 hover:shadow-sm'
                    } ${isArchived ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {selectionMode && (
                        <button onClick={() => toggleSelect(job.id)} className="mt-0.5 shrink-0">
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4 text-muted-foreground" />
                          }
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground leading-snug">{job?.address}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {isArchived && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Archived</span>}
                            {isBtImported && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Buildertrend</span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.class}`}>{badge.label}</span>
                          </div>
                        </div>
                        {job?.title && <p className="text-xs text-muted-foreground">{job.title}</p>}
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-xs text-muted-foreground">{job?.customer_name}</p>
                          <p className="text-xs font-semibold text-primary">${Number(job?.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <JobStatusBadge status={job?.op_status || 'new'} />
                          {job?.job_group && <JobGroupBadge group={job.job_group} />}
                        </div>
                        {job?.buildertrend_id && <p className="text-xs text-muted-foreground/60 mt-1">BT# {job.buildertrend_id}</p>}
                        {!selectionMode && (
                          <div className="flex gap-2 mt-2">
                            {!isBtImported && (
                              <button
                                onClick={() => handlePrimaryAction(job)}
                                disabled={primaryAction.disabled}
                                className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-lg hover:bg-primary/90 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {primaryAction.label}
                              </button>
                            )}
                            <button
                              onClick={() => navigate(`/job-hub?jobId=${job.id}`)}
                              className="text-xs bg-muted text-foreground px-2.5 py-1 rounded-lg hover:bg-muted/80 transition-colors"
                            >
                              Job Hub
                            </button>
                          </div>
                        )}
                        {selectionMode && (
                          <button
                            onClick={() => toggleSelect(job.id)}
                            className="mt-2 text-xs text-primary underline"
                          >
                            {isSelected ? 'Deselect' : 'Select this job'}
                          </button>
                        )}
                        {primaryAction.helperText && !selectionMode && !isBtImported && (
                          <p className="mt-1.5 text-xs text-muted-foreground">{primaryAction.helperText}</p>
                        )}
                      </div>
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
