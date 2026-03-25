import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Loader2, FileText, MessageSquare, CalendarDays, FileDiff,
  Lock, CheckCircle2, Download, Image, DollarSign, ClipboardList, ShieldCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import CompanyLogo from '../components/CompanyLogo';
import { parseSections, SECTION_LABELS } from '@/lib/portalSections';

const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|gif)$/i;
const isImage = (f) => IMAGE_EXTS.test(f.file_name || '') || IMAGE_EXTS.test(f.file_url || '');

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50">
        <Icon className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-slate-800">{title}</p>
      </div>
      <div className="p-5">{children}</div>
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
        <Lock className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="text-sm font-semibold text-slate-800">Access Unavailable</p>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}

export default function ClientPortal() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Resolve portal user by token
  const { data: portalUsers = [], isLoading: loadingUser } = useQuery({
    queryKey: ['portal-user', token],
    queryFn: () => base44.entities.PortalUser.filter({ access_token: token }),
    enabled: !!token,
  });

  const portalUser = portalUsers[0];
  const sections = useMemo(() => parseSections(portalUser?.section_permissions), [portalUser]);

  // Resolve job_id — support both new single-job and legacy multi-job
  const jobId = useMemo(() => {
    if (portalUser?.job_id) return portalUser.job_id;
    try {
      const ids = JSON.parse(portalUser?.linked_job_ids || '[]');
      return ids[0] || null;
    } catch { return null; }
  }, [portalUser]);

  const { data: jobArr = [] } = useQuery({
    queryKey: ['portal-job', jobId],
    queryFn: () => base44.entities.Job.filter({ id: jobId }),
    enabled: !!jobId,
  });
  const job = jobArr[0];

  const { data: files = [] } = useQuery({
    queryKey: ['portal-files', jobId],
    queryFn: () => base44.entities.JobFile.filter({ job_id: jobId }),
    enabled: !!jobId,
    select: d => d.filter(f => (f.visibility === 'client' || f.visibility === 'both') && !f.archived),
  });

  const photos = files.filter(f => isImage(f));
  const docs   = files.filter(f => !isImage(f));

  const { data: events = [] } = useQuery({
    queryKey: ['portal-events', jobId],
    queryFn: () => base44.entities.CalendarEvent.filter({ job_id: jobId }),
    enabled: !!jobId && sections.schedule,
    select: d => d.filter(e => e.visibility === 'client' || e.visibility === 'both' || e.visibility === 'internal'),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['portal-invoices', jobId],
    queryFn: () => base44.entities.Invoice.filter({ job_id: jobId }),
    enabled: !!jobId && sections.invoices,
    select: d => d.filter(i => i.status !== 'draft'),
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ['portal-estimates', jobId],
    queryFn: () => base44.entities.Estimate.filter({ job_id: jobId }),
    enabled: !!jobId && sections.estimates,
    select: d => d.filter(e => e.status === 'sent' || e.status === 'approved'),
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ['portal-cos', jobId],
    queryFn: () => base44.entities.ChangeOrder.filter({ job_id: jobId }),
    enabled: !!jobId && sections.change_orders,
    select: d => d.filter(co => co.status === 'approved' || co.status === 'pending_client'),
  });

  const { data: warranty = [] } = useQuery({
    queryKey: ['portal-warranty', jobId],
    queryFn: () => base44.entities.WarrantyItem.filter({ job_id: jobId }),
    enabled: !!jobId && sections.warranty,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['portal-comments', jobId],
    queryFn: () => base44.entities.JobComment.filter({ job_id: jobId }),
    enabled: !!jobId && sections.messages,
    select: d => d.filter(c => c.visibility === 'client' || c.visibility === 'both'),
  });

  // ── Guard checks ──────────────────────────────────────────────
  if (!token) return <PortalError message="No access token provided." />;
  if (loadingUser) return <PortalLoading />;
  if (!portalUser) return <PortalError message="This portal link is not valid or has expired." />;
  if (portalUser.access_status === 'revoked') return <PortalError message="Your portal access has been revoked. Please contact us." />;
  if (portalUser.access_status === 'disabled') return <PortalError message="Your portal access is temporarily disabled." />;

  const statusColor = {
    in_progress: 'bg-blue-100 text-blue-700',
    completed:   'bg-green-100 text-green-700',
    open:        'bg-amber-100 text-amber-700',
    closed:      'bg-slate-100 text-slate-600',
  };

  return (
    <div className="min-h-screen bg-slate-50 font-inter">
      {/* Minimal header — no internal nav */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <CompanyLogo className="h-8 w-auto" />
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-800">{portalUser.name}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Client Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Job Summary */}
        {sections.job_summary && (
          job ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Your Project</p>
                <h1 className="text-lg font-bold text-slate-800">{job.address}</h1>
                {job.customer_name && <p className="text-sm text-slate-500">{job.customer_name}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[job.lifecycle_status] || 'bg-slate-100 text-slate-600'}`}>
                  {(job.lifecycle_status || 'open').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </span>
                {job.approval_timestamp && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Signed {format(parseISO(job.approval_timestamp), 'MMM d, yyyy')}
                  </span>
                )}
              </div>
              {job.description && <p className="text-sm text-slate-600 border-t border-slate-100 pt-3">{job.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {job.start_date && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 mb-0.5">Start Date</p>
                    <p className="font-semibold text-slate-700">{format(parseISO(job.start_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
                {job.end_date && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 mb-0.5">Est. Completion</p>
                    <p className="font-semibold text-slate-700">{format(parseISO(job.end_date), 'MMM d, yyyy')}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
            </div>
          )
        )}

        {/* Schedule */}
        {sections.schedule && events.length > 0 && (
          <Section title="Schedule" icon={CalendarDays}>
            <div className="space-y-2">
              {[...events].sort((a,b) => (a.start_date||'').localeCompare(b.start_date||'')).map(e => (
                <div key={e.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{e.title}</p>
                    <p className="text-xs text-slate-500">
                      {e.start_date ? format(parseISO(e.start_date.split('T')[0]), 'EEEE, MMM d, yyyy') : ''}
                      {e.all_day === false && e.start_date?.includes('T') ? ` · ${format(parseISO(e.start_date), 'h:mm a')}` : ''}
                    </p>
                    {e.notes && <p className="text-xs text-slate-400 mt-0.5">{e.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Documents */}
        {sections.documents && docs.length > 0 && (
          <Section title={`Documents (${docs.length})`} icon={FileText}>
            <div className="space-y-2">
              {docs.map(f => (
                <div key={f.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{f.file_name}</p>
                    {f.description && <p className="text-xs text-slate-400">{f.description}</p>}
                  </div>
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0">
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Photos */}
        {sections.photos && photos.length > 0 && (
          <Section title={`Photos (${photos.length})`} icon={Image}>
            <div className="grid grid-cols-3 gap-2">
              {photos.map(f => (
                <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer">
                  <img src={f.file_url} alt={f.file_name} className="w-full aspect-square object-cover rounded-xl hover:opacity-90 transition-opacity" />
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Invoices */}
        {sections.invoices && invoices.length > 0 && (
          <Section title="Invoices" icon={DollarSign}>
            <div className="space-y-3">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Invoice #{inv.invoice_number || inv.id.slice(-6)}</p>
                    <p className="text-xs text-slate-400">{inv.invoice_date ? format(parseISO(inv.invoice_date), 'MMM d, yyyy') : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">${Number(inv.amount || 0).toLocaleString()}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                      inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Estimates */}
        {sections.estimates && estimates.length > 0 && (
          <Section title="Estimates" icon={ClipboardList}>
            <div className="space-y-3">
              {estimates.map(est => (
                <div key={est.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-slate-400">{est.estimate_number}</p>
                      <p className="text-sm font-medium text-slate-800">{est.title || 'Estimate'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-800">${Number(est.total || 0).toLocaleString()}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        est.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>{est.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Change Orders */}
        {sections.change_orders && changeOrders.length > 0 && (
          <Section title="Change Requests" icon={FileDiff}>
            <div className="space-y-3">
              {changeOrders.map(co => (
                <div key={co.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono text-slate-400">{co.co_number}</p>
                      <p className="text-sm font-medium text-slate-800">{co.title}</p>
                      {co.client_facing_notes && <p className="text-xs text-slate-400 mt-1">{co.client_facing_notes}</p>}
                    </div>
                    {co.total_financial_impact !== 0 && (
                      <span className={`text-sm font-bold shrink-0 ${Number(co.total_financial_impact) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(co.total_financial_impact) > 0 ? '+' : ''}${Math.abs(Number(co.total_financial_impact)).toFixed(2)}
                      </span>
                    )}
                  </div>
                  {co.approval_date && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />Approved {format(parseISO(co.approval_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Warranty */}
        {sections.warranty && warranty.length > 0 && (
          <Section title="Warranty Claims" icon={ShieldCheck}>
            <div className="space-y-3">
              {warranty.map(w => (
                <div key={w.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{w.title}</p>
                      {w.issue_description && <p className="text-xs text-slate-400 mt-0.5">{w.issue_description}</p>}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      w.status === 'completed' ? 'bg-green-100 text-green-700' :
                      w.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{w.status?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Messages */}
        {sections.messages && comments.length > 0 && (
          <Section title="Messages from Our Team" icon={MessageSquare}>
            <div className="space-y-3">
              {[...comments].sort((a,b) => (a.created_date||'').localeCompare(b.created_date||'')).map(c => (
                <div key={c.id} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-slate-700">{c.author_name || 'Team'}</p>
                    <p className="text-xs text-slate-400">{c.created_date ? format(parseISO(c.created_date), 'MMM d') : ''}</p>
                  </div>
                  <p className="text-sm text-slate-700">{c.body}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Empty state */}
        {job && !events.length && !files.length && !invoices.length && !estimates.length && !changeOrders.length && !warranty.length && !comments.length && (
          <div className="text-center py-10 text-slate-400">
            <p className="text-sm">No shared information available yet. Check back soon.</p>
          </div>
        )}
      </div>

      <div className="text-center pb-8 pt-4">
        <p className="text-[10px] text-slate-300 uppercase tracking-widest">Secure project portal · internal data not shown</p>
      </div>
    </div>
  );
}