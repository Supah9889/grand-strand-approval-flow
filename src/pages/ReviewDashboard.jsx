import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import {
  CheckCircle2, AlertTriangle, XCircle, ArrowRight, Clock,
  Hammer, ShieldCheck, FileText, BarChart3, Users, Brain,
  Database, MessageSquare, Loader2, ChevronDown, ChevronRight,
  Zap, ExternalLink, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const STATUS_READY     = 'ready';
const STATUS_PARTIAL   = 'partial';
const STATUS_NOT_READY = 'not_ready';

const statusIcon = {
  [STATUS_READY]:     <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />,
  [STATUS_PARTIAL]:   <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />,
  [STATUS_NOT_READY]: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
};
const statusLabel = {
  [STATUS_READY]:     { label: 'Ready',     color: 'bg-green-100 text-green-700' },
  [STATUS_PARTIAL]:   { label: 'Partial',   color: 'bg-orange-100 text-orange-700' },
  [STATUS_NOT_READY]: { label: 'Not Ready', color: 'bg-red-100 text-red-700' },
};

const SECTIONS = [
  {
    key: 'daily_field',
    title: 'Daily Field Use',
    icon: Hammer,
    color: 'bg-blue-100 text-blue-700',
    status: STATUS_READY,
    summary: 'Field technicians can clock in/out, view assigned jobs, log daily progress, submit work orders, and add notes from mobile.',
    items: [
      { label: 'Time clock (clock in/out)', status: STATUS_READY },
      { label: 'Assigned job view', status: STATUS_READY },
      { label: 'Work order checklist completion', status: STATUS_READY },
      { label: 'Field notes and daily logs', status: STATUS_READY },
      { label: 'Photo upload from field', status: STATUS_PARTIAL, note: 'Upload works; direct camera capture in docs tab in progress' },
      { label: 'GPS punch location verification', status: STATUS_READY },
      { label: 'Field schedule view', status: STATUS_READY },
    ],
    link: '/field',
  },
  {
    key: 'restoration',
    title: 'Destination Home Restoration',
    icon: Zap,
    color: 'bg-cyan-100 text-cyan-700',
    status: STATUS_READY,
    summary: 'Full water/mold mitigation workflow: rooms, equipment, moisture readings, drying logs, air samples, and Nexus approval chain.',
    items: [
      { label: 'Job creation with service line', status: STATUS_READY },
      { label: 'Room tracking', status: STATUS_READY },
      { label: 'Moisture readings per room', status: STATUS_READY },
      { label: 'Drying logs (temp/RH/GPP)', status: STATUS_READY },
      { label: 'Air sample tests', status: STATUS_READY },
      { label: 'Equipment assignment', status: STATUS_READY },
      { label: 'Job documentation checklist', status: STATUS_PARTIAL, note: 'Template-driven; photo upload from docs not yet wired' },
      { label: 'Insurance field capture', status: STATUS_READY },
      { label: 'Xactimate import (ESX files)', status: STATUS_READY },
    ],
    link: '/restoration',
  },
  {
    key: 'gscp',
    title: 'GSCP Subcontract Workflow',
    icon: Users,
    color: 'bg-purple-100 text-purple-700',
    status: STATUS_READY,
    summary: 'DH creates work orders for GSCP, Jesus reviews/approves field updates before DH sees them, full subcontract lifecycle tracked.',
    items: [
      { label: 'DH creates subcontract work order', status: STATUS_READY },
      { label: 'GSCP field updates via field dashboard', status: STATUS_READY },
      { label: 'Jesus review queue', status: STATUS_READY },
      { label: 'DH visibility after approval', status: STATUS_READY },
      { label: 'Subcontract note/photo approval', status: STATUS_READY },
      { label: 'Cross-company audit log', status: STATUS_READY },
    ],
    link: '/subcontracts',
  },
  {
    key: 'migration',
    title: 'Proven Jobs Migration',
    icon: Database,
    color: 'bg-amber-100 text-amber-700',
    status: STATUS_PARTIAL,
    summary: 'Import tools, record linking, cutover workflow, and export checklist built. Actual export from Proven Jobs pending.',
    items: [
      { label: 'CSV import pipeline', status: STATUS_READY },
      { label: 'Legacy record review UI', status: STATUS_READY },
      { label: 'Convert to platform job', status: STATUS_READY },
      { label: 'Cutover checklist with auto-verify', status: STATUS_READY },
      { label: 'Live duplicate detection', status: STATUS_READY },
      { label: 'Export checklist (DB-persisted)', status: STATUS_READY },
      { label: 'Proven Jobs actual data export', status: STATUS_NOT_READY, note: 'Depends on extracting from Proven Jobs first' },
      { label: 'Bulk CSV field mapping', status: STATUS_PARTIAL, note: 'Manual mapping; AI-assisted parsing not yet built' },
    ],
    link: '/migration-dashboard',
  },
  {
    key: 'nexus',
    title: 'Nexus Approval Inbox',
    icon: Brain,
    color: 'bg-indigo-100 text-indigo-700',
    status: STATUS_READY,
    summary: 'Field staff submit observations and flagged items. Reviewers approve/reject from the Nexus Inbox with audit trail.',
    items: [
      { label: 'Nexus item submission from field', status: STATUS_READY },
      { label: 'Reviewer inbox with priority/category', status: STATUS_READY },
      { label: 'Approve/reject with notes', status: STATUS_READY },
      { label: 'Linked to job/work order context', status: STATUS_READY },
      { label: 'Audit log on every decision', status: STATUS_READY },
    ],
    link: '/nexus',
  },
  {
    key: 'permissions',
    title: 'Permissions & Audit Logs',
    icon: ShieldCheck,
    color: 'bg-green-100 text-green-700',
    status: STATUS_PARTIAL,
    summary: 'Role-based access in place for admin/field/vendor. Granular permission groups built. Backend enforcement still frontend-only for some routes.',
    items: [
      { label: 'Role-based sidebar filtering', status: STATUS_READY },
      { label: 'Admin-only route guards', status: STATUS_READY },
      { label: 'Financial visibility flag per employee', status: STATUS_READY },
      { label: 'Company membership scoping', status: STATUS_READY },
      { label: 'Full audit log trail', status: STATUS_READY },
      { label: 'Backend API enforcement', status: STATUS_PARTIAL, note: 'Frontend guards are solid; server-side entity rules are platform defaults' },
    ],
    link: '/access-management',
  },
  {
    key: 'financials',
    title: 'Financial Visibility',
    icon: BarChart3,
    color: 'bg-emerald-100 text-emerald-700',
    status: STATUS_PARTIAL,
    summary: 'Invoices, estimates, bills, payments, expenses available to admins. QuickBooks integration pending. Financial pages gated by permission flag.',
    items: [
      { label: 'Invoices (admin)', status: STATUS_READY },
      { label: 'Estimates + change orders', status: STATUS_READY },
      { label: 'Bills + purchase orders', status: STATUS_READY },
      { label: 'Expense tracking', status: STATUS_READY },
      { label: 'QuickBooks sync', status: STATUS_NOT_READY, note: 'QB integration is planned, not yet built' },
      { label: 'Financial visibility gating per employee', status: STATUS_READY },
    ],
    link: '/financials',
  },
];

const PRIORITY_COLORS = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

function SectionCard({ section }) {
  const [open, setOpen] = useState(false);
  const cfg = statusLabel[section.status];

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${section.color}`}>
          <section.icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{section.title}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{section.summary}</p>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">{section.summary}</p>
          <div className="space-y-1.5">
            {section.items.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                {statusIcon[item.status]}
                <div>
                  <span className="text-xs text-foreground">{item.label}</span>
                  {item.note && <p className="text-[11px] text-muted-foreground mt-0.5">{item.note}</p>}
                </div>
              </div>
            ))}
          </div>
          {section.link && (
            <Link to={section.link}
              className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline">
              Open module <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

const LIMITATIONS = [
  'Backend API enforcement relies on platform defaults — no custom server-side entity rules yet',
  'Proven Jobs CSV parsing not yet tested against real Proven Jobs exports',
  'QuickBooks integration is not built — financial sync is manual or future',
  'Financial pages (invoices, bills, estimates) are admin-only — no read-only view for managers',
  'Edge cases in permission logic (vendor scoping, cross-company subcontracts) not fully stress-tested',
  'Mobile offline mode not built — requires internet connection for all field actions',
  'Photo upload from Job Documentation tab is not yet wired to the camera/gallery',
  'Real employee accounts not yet created — all testing done with admin session',
  'Bulk AI-assisted CSV field mapping not built — manual column selection only',
];

const QUICK_LINKS = [
  { label: 'Field Dashboard', to: '/field', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { label: 'Work Orders', to: '/work-orders', color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { label: 'Restoration Hub', to: '/restoration', color: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
  { label: 'Nexus Inbox', to: '/nexus', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { label: 'Migration Dashboard', to: '/migration-dashboard', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { label: 'Access Management', to: '/access-management', color: 'bg-green-50 border-green-200 text-green-700' },
  { label: 'Rollout Checklist', to: '/rollout-checklist', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  { label: 'Replacement Map', to: '/replacement-map', color: 'bg-rose-50 border-rose-200 text-rose-700' },
  { label: 'Known Limitations', to: '/known-limitations', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { label: 'Audit Log', to: '/audit-log', color: 'bg-slate-50 border-slate-200 text-slate-700' },
];

export default function ReviewDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [fb, setFb] = useState({ reviewer_name: user?.full_name || '', reviewer_role: '', section: '', feedback_text: '', priority: 'medium' });
  const [fbSent, setFbSent] = useState(false);

  const { data: feedbacks = [] } = useQuery({
    queryKey: ['review-feedback', company?.id],
    queryFn: () => base44.entities.ReviewFeedback.filter({ company_id: company?.id }, '-created_date', 100),
    enabled: !!company?.id,
  });

  const submitFb = useMutation({
    mutationFn: () => base44.entities.ReviewFeedback.create({
      ...fb,
      company_id: company?.id,
      status: 'new',
      created_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      setFbSent(true);
      setFb(prev => ({ ...prev, section: '', feedback_text: '', priority: 'medium' }));
      setTimeout(() => setFbSent(false), 3000);
      qc.invalidateQueries(['review-feedback', company?.id]);
    },
  });

  const readyCnt = SECTIONS.filter(s => s.status === STATUS_READY).length;
  const partialCnt = SECTIONS.filter(s => s.status === STATUS_PARTIAL).length;
  const notReadyCnt = SECTIONS.filter(s => s.status === STATUS_NOT_READY).length;

  return (
    <AppLayout title="Review Dashboard">
      <div className="app-page max-w-4xl space-y-6">

        {/* Header */}
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Platform Review — Destination Home</h1>
            <p className="app-page-subtitle">Executive overview for Nick & managers · {format(new Date(), 'MMMM d, yyyy')}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/rollout-checklist"
              className="flex items-center gap-1.5 h-9 px-3 bg-muted border border-border rounded-lg text-xs font-semibold hover:bg-accent transition-colors">
              Rollout Checklist
            </Link>
            <button
              onClick={() => setFeedbackOpen(v => !v)}
              className="flex items-center gap-1.5 h-9 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
              <MessageSquare className="w-4 h-4" /> Leave Feedback
            </button>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5 space-y-3">
          <p className="text-sm font-bold text-foreground">Executive Summary</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The platform is <strong>operationally ready</strong> for daily field use, restoration documentation,
            the GSCP subcontract review workflow, and the Nexus approval inbox.
            The Proven Jobs migration tooling is built and ready to receive exported data.
            Financials and QuickBooks integration are the main remaining gaps before full production rollout.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <div className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-foreground">{readyCnt} sections ready</span>
            </div>
            <div className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-semibold text-foreground">{partialCnt} partially ready</span>
            </div>
            <div className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 py-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs font-semibold text-foreground">{notReadyCnt} not yet ready</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Quick Links</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {QUICK_LINKS.map(l => (
              <Link key={l.to} to={l.to}
                className={`flex items-center justify-center text-center px-2 py-2.5 rounded-xl border text-[11px] font-semibold transition-colors hover:opacity-80 ${l.color}`}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Section cards */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Platform Sections</p>
          <div className="space-y-2">
            {SECTIONS.map(s => <SectionCard key={s.key} section={s} />)}
          </div>
        </div>

        {/* Remaining Limitations */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <p className="text-xs font-semibold text-orange-800">Known Limitations (Summary)</p>
          </div>
          <ul className="space-y-1">
            {LIMITATIONS.slice(0, 4).map((l, i) => (
              <li key={i} className="text-xs text-orange-700 flex gap-1.5"><span>•</span><span>{l}</span></li>
            ))}
          </ul>
          <Link to="/known-limitations" className="text-xs text-orange-700 font-medium underline">
            View all {LIMITATIONS.length} limitations →
          </Link>
        </div>

        {/* Feedback form */}
        {feedbackOpen && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Leave Review Feedback
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Your Name</label>
                <input className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={fb.reviewer_name} onChange={e => setFb(p => ({ ...p, reviewer_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Your Role</label>
                <input className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  placeholder="e.g. Owner, Operations Manager"
                  value={fb.reviewer_role} onChange={e => setFb(p => ({ ...p, reviewer_role: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Section</label>
                <select className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={fb.section} onChange={e => setFb(p => ({ ...p, section: e.target.value }))}>
                  <option value="">Select section...</option>
                  {SECTIONS.map(s => <option key={s.key} value={s.key}>{s.title}</option>)}
                  <option value="general">General / Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                <select className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={fb.priority} onChange={e => setFb(p => ({ ...p, priority: e.target.value }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Feedback</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm resize-none" rows={3}
                placeholder="What works well? What's missing? What needs to change before go-live?"
                value={fb.feedback_text} onChange={e => setFb(p => ({ ...p, feedback_text: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => submitFb.mutate()}
                disabled={submitFb.isPending || !fb.reviewer_name || !fb.feedback_text || !fb.section}>
                {submitFb.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {fbSent ? 'Sent!' : 'Submit Feedback'}
              </Button>
            </div>
          </div>
        )}

        {/* Feedback list */}
        {feedbacks.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Submitted Feedback ({feedbacks.length})
              </p>
            </div>
            <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
              {feedbacks.map(f => (
                <div key={f.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold text-foreground">{f.reviewer_name}</span>
                    {f.reviewer_role && <span className="text-[11px] text-muted-foreground">· {f.reviewer_role}</span>}
                    <span className="text-[11px] text-muted-foreground">· {f.section}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLORS[f.priority] || 'bg-muted text-muted-foreground'}`}>{f.priority}</span>
                    <span className="text-[10px] font-medium text-muted-foreground capitalize ml-auto">{f.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.feedback_text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}