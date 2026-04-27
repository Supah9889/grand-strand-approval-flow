import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, CheckSquare, CalendarDays, FileDiff, Lock, MessageSquare, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import CompanyLogo from '../components/CompanyLogo';

const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|gif)$/i;
const isImage = (f) => IMAGE_EXTS.test(f.file_name || '') || IMAGE_EXTS.test(f.file_url || '');

const CATEGORY_LABEL = {
  vendor_document: 'Vendor Document', change_order: 'Change Order',
  estimate: 'Estimate', permit: 'Permit', other: 'Other',
};

const STATUS_CFG = {
  open:        { label: 'Open',        color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  waiting:     { label: 'Waiting',     color: 'bg-slate-100 text-slate-600' },
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

export default function VendorPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const [activeJobId, setActiveJobId] = useState(null);

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
    queryKey: ['vendor-portal-jobs', linkedJobIds.join(',')],
    queryFn: () => base44.entities.Job.list('-created_date', 50),
    enabled: linkedJobIds.length > 0,
    select: data => data.filter(j => linkedJobIds.includes(j.id)),
  });

  const currentJobId = activeJobId || linkedJobIds[0];
  const currentJob = jobs.find(j => j.id === currentJobId);

  const { data: files = [] } = useQuery({
    queryKey: ['vportal-files', currentJobId],
    queryFn: () => base44.entities.JobFile.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
    select: data => data.filter(f => (f.visibility === 'vendor' || f.visibility === 'both') && !f.archived),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['vportal-comments', currentJobId],
    queryFn: () => base44.entities.JobComment.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
    select: data => data.filter(c => c.visibility === 'vendor' || c.visibility === 'both'),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['vportal-tasks', currentJobId],
    queryFn: () => base44.entities.Task.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
    select: data => data.filter(t => !['completed','closed','canceled'].includes(t.status)),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['vportal-events', currentJobId],
    queryFn: () => base44.entities.CalendarEvent.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['vportal-cos', currentJobId],
    queryFn: () => base44.entities.ChangeOrder.filter({ job_id: currentJobId }),
    enabled: !!currentJobId,
    select: data => data.filter(co => co.status === 'approved'),
  });

  if (!token) return <PortalError message="No access token provided." />;
  if (loadingUser) return <PortalLoading />;
  if (!portalUser) return <PortalError message="This portal link is not valid or has expired." />;
  if (portalUser.access_status === 'revoked') return <PortalError message="Your portal access has been revoked." />;
  if (portalUser.access_status === 'disabled') return <PortalError message="Your portal access is temporarily disabled." />;
  if (portalUser.access_status === 'invited') return <PortalError message="Your portal access is pending activation." />;

  const typeLabel = portalUser.portal_type === 'subcontractor' ? 'Subcontractor Portal' : 'Vendor Portal';

  return (
    <div className="min-h-screen bg-slate-50 font-inter">
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <CompanyLogo className="h-8 w-auto" />
          <div className="text-right">
            <p className="text-xs font-medium text-foreground">{portalUser.name}</p>
            <p className="text-xs text-muted-foreground">{typeLabel}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

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
            {/* Project */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs text-muted-foreground mb-0.5">Project</p>
              <h1 className="text-lg font-bold text-foreground">{currentJob.address}</h1>
              {currentJob.description && <p className="text-sm text-muted-foreground mt-2">{currentJob.description}</p>}
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
                        {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <Section title={`Open Tasks / To-Dos (${tasks.length})`} icon={CheckSquare}>
                <div className="space-y-2">
                  {tasks.map(t => {
                    const sc = STATUS_CFG[t.status] || { label: t.status, color: 'bg-muted text-muted-foreground' };
                    return (
                      <div key={t.id} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{t.title}</p>
                          {t.due_date && <p className="text-xs text-muted-foreground">Due {format(parseISO(t.due_date), 'MMM d, yyyy')}</p>}
                          {t.notes && <p className="text-xs text-muted-foreground">{t.notes}</p>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${sc.color}`}>{sc.label}</span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Documents */}
            {files.length > 0 && (
              <Section title={`Documents (${files.length})`} icon={FileText}>
                <div className="space-y-2">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                      {isImage(f) ? (
                        <img src={f.file_url} alt={f.file_name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{f.file_name}</p>
                        {f.description && <p className="text-xs text-muted-foreground">{f.description}</p>}
                      </div>
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-slate-100 shrink-0">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Change Orders */}
            {changeOrders.length > 0 && (
              <Section title="Approved Change Orders" icon={FileDiff}>
                <div className="space-y-3">
                  {changeOrders.map(co => (
                    <div key={co.id} className="border border-slate-100 rounded-xl p-3">
                      <p className="text-xs font-mono text-muted-foreground">{co.co_number}</p>
                      <p className="text-sm font-medium text-foreground">{co.title}</p>
                      {co.description && <p className="text-xs text-muted-foreground mt-1">{co.description}</p>}
                      {co.total_financial_impact !== 0 && (
                        <p className={`text-xs font-bold mt-1 ${Number(co.total_financial_impact) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          Impact: {Number(co.total_financial_impact) > 0 ? '+' : ''}${Math.abs(Number(co.total_financial_impact)).toFixed(2)}
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

            {files.length === 0 && comments.length === 0 && events.length === 0 && tasks.length === 0 && changeOrders.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No shared information available yet.</p>
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