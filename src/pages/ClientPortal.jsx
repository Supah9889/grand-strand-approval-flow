import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, MessageSquare, CalendarDays, FileDiff, Lock, CheckCircle2, Image, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import CompanyLogo from '../components/CompanyLogo';

const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|gif)$/i;
const isImage = (f) => IMAGE_EXTS.test(f.file_name || '') || IMAGE_EXTS.test(f.file_url || '');

const CATEGORY_LABEL = {
  before_photo: 'Before', progress_photo: 'Progress', after_photo: 'After',
  jobsite_photo: 'Jobsite', estimate: 'Estimate', contract: 'Contract',
  signed_doc: 'Signed Document', proposal: 'Proposal', change_order: 'Change Order',
  invoice_support: 'Invoice', permit: 'Permit', other: 'Other',
};

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <Icon className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function ClientPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const [activeJobId, setActiveJobId] = useState(null);

  // Look up portal user by token
  const { data: portalUsers = [], isLoading: loadingUser } = useQuery({
    queryKey: ['portal-user', token],
    queryFn: () => base44.entities.PortalUser.filter({ access_token: token }),
    enabled: !!token,
  });

  const portalUser = portalUsers[0];
  const linkedJobIds = useMemo(() => {
    try { return JSON.parse(portalUser?.linked_job_ids || '[]'); } catch { return []; }
  }, [portalUser]);

  const { data: jobs = [] } = useQuery({
    queryKey: ['portal-jobs', linkedJobIds.join(',')],
    queryFn: () => base44.entities.Job.list('-created_date', 50),
    enabled: linkedJobIds.length > 0,
    select: data => data.filter(j => linkedJobIds.includes(j.id)),
  });

  const currentJobId = activeJobId || linkedJobIds[0];
  const currentJob = jobs.find(j => j.id === currentJobId);

  const { data: files = [] } = useQuery({
    queryKey: ['portal-files', currentJobId],
    queryFn: () => base44.entities.JobFile.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
    select: data => data.filter(f => (f.visibility === 'client' || f.visibility === 'both') && !f.archived),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['portal-comments', currentJobId],
    queryFn: () => base44.entities.JobComment.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
    select: data => data.filter(c => c.visibility === 'client' || c.visibility === 'both'),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['portal-events', currentJobId],
    queryFn: () => base44.entities.CalendarEvent.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['portal-cos', currentJobId],
    queryFn: () => base44.entities.ChangeOrder.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
    select: data => data.filter(co => co.status === 'approved'),
  });

  if (!token) return <PortalError message="No access token provided." />;
  if (loadingUser) return <PortalLoading />;
  if (!portalUser) return <PortalError message="This portal link is not valid or has expired." />;
  if (portalUser.access_status === 'revoked') return <PortalError message="Your portal access has been revoked. Please contact the company." />;
  if (portalUser.access_status === 'disabled') return <PortalError message="Your portal access is temporarily disabled." />;
  if (portalUser.access_status === 'invited') return <PortalError message="Your portal access is pending activation. Please wait for confirmation." />;

  return (
    <div className="min-h-screen bg-slate-50 font-inter">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <CompanyLogo className="h-8 w-auto" />
          <div className="text-right">
            <p className="text-xs font-medium text-foreground">{portalUser.name}</p>
            <p className="text-xs text-muted-foreground">Client Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Job selector if multiple */}
        {jobs.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {jobs.map(j => (
              <button key={j.id} onClick={() => setActiveJobId(j.id)}
                className={`text-xs px-3 py-1.5 rounded-xl border-2 font-medium transition-colors ${j.id === currentJobId ? 'bg-primary text-white border-primary' : 'bg-white border-slate-200 text-slate-600 hover:border-primary/30'}`}>
                {j.address || j.title}
              </button>
            ))}
          </div>
        )}

        {!currentJob ? (
          <div className="text-center py-14">
            <Lock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No project information available.</p>
          </div>
        ) : (
          <>
            {/* Project overview */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-muted-foreground mb-0.5">Your Project</p>
              <h1 className="text-lg font-bold text-foreground">{currentJob.address}</h1>
              {currentJob.customer_name && <p className="text-sm text-muted-foreground">{currentJob.customer_name}</p>}
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentJob.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {currentJob.status === 'approved' ? 'Approved' : 'In Progress'}
                </span>
                {currentJob.approval_timestamp && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle2 className="w-3 h-3" />Signed {format(parseISO(currentJob.approval_timestamp), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
              {currentJob.description && <p className="text-sm text-muted-foreground mt-3">{currentJob.description}</p>}
            </div>

            {/* Schedule */}
            {events.length > 0 && (
              <Section title="Schedule" icon={CalendarDays}>
                <div className="space-y-2">
                  {events.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || '')).map(e => (
                    <div key={e.id} className="flex items-start gap-3 py-1.5 border-b border-slate-100 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.start_date ? format(parseISO(e.start_date.split('T')[0]), 'EEEE, MMM d, yyyy') : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Documents & Photos */}
            {files.length > 0 && (
              <Section title={`Documents & Photos (${files.length})`} icon={FileText}>
                <div className="space-y-2">
                  {files.map(f => {
                    const img = isImage(f);
                    return (
                      <div key={f.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                        {img ? (
                          <img src={f.file_url} alt={f.file_name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{f.file_name}</p>
                          {f.category && <p className="text-xs text-muted-foreground">{CATEGORY_LABEL[f.category] || f.category}</p>}
                          {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                        </div>
                        <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-slate-100 hover:text-foreground transition-colors shrink-0">
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Change Orders */}
            {changeOrders.length > 0 && (
              <Section title="Approved Change Orders" icon={FileDiff}>
                <div className="space-y-3">
                  {changeOrders.map(co => (
                    <div key={co.id} className="border border-slate-100 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono text-muted-foreground">{co.co_number}</p>
                          <p className="text-sm font-medium text-foreground">{co.title}</p>
                          {co.client_facing_notes && <p className="text-xs text-muted-foreground mt-1">{co.client_facing_notes}</p>}
                        </div>
                        {co.total_financial_impact !== 0 && (
                          <span className={`text-sm font-bold shrink-0 ${Number(co.total_financial_impact) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Number(co.total_financial_impact) > 0 ? '+' : ''}${Math.abs(Number(co.total_financial_impact)).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {co.approval_date && (
                        <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />Approved {format(parseISO(co.approval_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Messages */}
            {comments.length > 0 && (
              <Section title="Messages" icon={MessageSquare}>
                <div className="space-y-3">
                  {[...comments].sort((a, b) => (a.created_date || '').localeCompare(b.created_date || '')).map(c => (
                    <div key={c.id} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-foreground">{c.author_name || 'Team'}</p>
                        <p className="text-xs text-muted-foreground">{c.created_date ? format(parseISO(c.created_date), 'MMM d') : ''}</p>
                      </div>
                      <p className="text-sm text-foreground">{c.body}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {files.length === 0 && comments.length === 0 && events.length === 0 && changeOrders.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No shared information available yet. Check back soon.</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="text-center py-6">
        <p className="text-xs text-muted-foreground">Secure project portal — internal information not shown</p>
      </div>
    </div>
  );
}

function PortalLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );
}

function PortalError({ message }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
      <CompanyLogo className="h-12 w-auto" />
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full text-center space-y-3">
        <Lock className="w-8 h-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm font-semibold text-foreground">Access Unavailable</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}