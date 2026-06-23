import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle2, XCircle, AlertTriangle, MessageSquare,
  Send, Eye, Loader2, ChevronRight, Filter, Building2, X
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { format } from 'date-fns';
import { getSession } from '@/lib/adminAuth';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

const REVIEW_STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  correction_needed: 'bg-orange-100 text-orange-700',
};

function ReviewActionSheet({ note, reviewer, onClose, onSaved }) {
  const [action, setAction] = useState('approved');
  const [reviewNote, setReviewNote] = useState('');
  const [toNexus, setToNexus] = useState(false);
  const [nexusCategory, setNexusCategory] = useState('job_procedure');
  const [saving, setSaving] = useState(false);
  const company = getActiveCompany();

  const submit = async () => {
    setSaving(true);
    const visibleToOrigin = action === 'approved';
    await base44.entities.SubcontractNote.update(note.id, {
      review_status: action,
      reviewed_by: reviewer || 'Reviewer',
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
      visible_to_origin: visibleToOrigin,
    });

    if (action === 'approved' && note.work_order_id) {
      const wo = await base44.entities.WorkOrder.get(note.work_order_id).catch(() => null);
      if (wo && wo.subcontract_status === 'needs_review') {
        await base44.entities.WorkOrder.update(wo.id, { subcontract_status: 'complete' });
      }
    }

    if (toNexus) {
      const nexus = await base44.entities.NexusItem.create({
        company_id: note.performing_company_id || company?.id,
        company_slug: company?.slug,
        source_type: 'job_note',
        source_id: note.id,
        title: `Subcontract Note: ${note.work_order_title}`,
        summary: reviewNote || note.content?.slice(0, 200),
        raw_content: note.content,
        category: nexusCategory,
        priority: 'normal',
        status: 'pending_review',
        submitted_by_name: reviewer || 'Reviewer',
        linked_job_id: note.job_id,
      });
      await base44.entities.SubcontractNote.update(note.id, { nexus_submitted: true, nexus_item_id: nexus.id });
    }

    setSaving(false);
    onSaved();
  };

  const ACTIONS = [
    { value: 'approved', label: 'Approve', desc: 'Mark as reviewed and visible to Destination Home' },
    { value: 'rejected', label: 'Reject', desc: 'Reject this update — not visible to DH' },
    { value: 'correction_needed', label: 'Request Correction', desc: 'Ask GSCP to revise and resubmit' },
  ];

  const NEXUS_CATS = ['job_procedure','safety','compliance','process_improvement','vendor_performance','other'];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Review Update</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{note.note_type?.replace('_', ' ')} by {note.author_name}</p>
          <p className="text-sm text-foreground">{note.content}</p>
          {note.job_address && <p className="text-xs text-muted-foreground mt-1">{note.job_address}</p>}
        </div>

        <div className="space-y-2">
          {ACTIONS.map(a => (
            <button key={a.value} onClick={() => setAction(a.value)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${action === a.value ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.desc}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Review Note (optional)</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-20"
            placeholder="Add a comment for GSCP or internal record..."
            value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={toNexus} onChange={e => setToNexus(e.target.checked)} />
            <Send className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-purple-700 font-medium">Also submit to Nexus for review</span>
          </label>
          {toNexus && (
            <select className="w-full border border-input rounded-xl px-3 h-9 text-sm bg-card"
              value={nexusCategory} onChange={e => setNexusCategory(e.target.value)}>
              {NEXUS_CATS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
            </select>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubcontractReview() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const company = getActiveCompany();
  const session = getSession();
  const reviewer = session?.employee?.name || 'Reviewer';
  const [tab, setTab] = useState('pending');
  const [reviewTarget, setReviewTarget] = useState(null);

  // Load ALL subcontract notes where this company is the performing company
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['subcontract-notes', company?.id, tab],
    queryFn: async () => {
      const all = await base44.entities.SubcontractNote.filter(
        { performing_company_id: company?.id },
        '-created_date', 200
      );
      return all;
    },
    enabled: !!company,
  });

  // Also load pending for badge
  const pending = notes.filter(n => n.review_status === 'pending');
  const approved = notes.filter(n => n.review_status === 'approved');
  const rejected = notes.filter(n => ['rejected','correction_needed'].includes(n.review_status));
  const tabNotes = tab === 'pending' ? pending : tab === 'approved' ? approved : rejected;

  // Load subcontract work orders needing review
  const { data: needsReviewWOs = [] } = useQuery({
    queryKey: ['wo-needs-review', company?.id],
    queryFn: () => company
      ? base44.entities.WorkOrder.filter({ performing_company_id: company.id, subcontract_status: 'needs_review' })
      : Promise.resolve([]),
    enabled: !!company,
  });

  return (
    <AppLayout title="Subcontract Review">
      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-4">

        <div>
          <h1 className="text-base font-semibold">Subcontract Review Queue</h1>
          <p className="text-xs text-muted-foreground">{company?.name} · Notes awaiting your review before DH can see them</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Pending', count: pending.length, color: 'text-amber-700 bg-amber-50', tab: 'pending' },
            { label: 'Approved', count: approved.length, color: 'text-emerald-700 bg-emerald-50', tab: 'approved' },
            { label: 'Rejected', count: rejected.length, color: 'text-red-700 bg-red-50', tab: 'rejected' },
          ].map(s => (
            <button key={s.tab} onClick={() => setTab(s.tab)}
              className={`rounded-xl p-3 text-center border transition-all ${tab === s.tab ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border'} ${s.color}`}>
              <p className="text-xl font-bold">{s.count}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </button>
          ))}
        </div>

        {/* WOs needing review */}
        {needsReviewWOs.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> {needsReviewWOs.length} Work Order{needsReviewWOs.length > 1 ? 's' : ''} Marked Complete — Needs Review
            </p>
            {needsReviewWOs.map(wo => (
              <button key={wo.id} onClick={() => navigate(`/work-orders/${wo.id}`)}
                className="w-full flex items-center justify-between text-left py-1.5 border-t border-amber-200 first:border-t-0">
                <div>
                  <p className="text-sm font-medium text-amber-900">{wo.title}</p>
                  <p className="text-xs text-amber-700">{wo.job_address}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-amber-600" />
              </button>
            ))}
          </div>
        )}

        {/* Notes list */}
        <div className="flex gap-1 mb-1">
          {['pending','approved','rejected'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${tab === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : tabNotes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-10">No {tab} updates</p>
        ) : tabNotes.map(note => (
          <div key={note.id} className={`bg-card border rounded-xl p-3 space-y-2 ${note.review_status === 'pending' ? 'border-amber-200' : 'border-border'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{note.note_type?.replace('_', ' ')}</p>
                <p className="text-sm text-foreground mt-0.5 line-clamp-3">{note.content}</p>
              </div>
              <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${REVIEW_STATUS_STYLES[note.review_status] || 'bg-muted text-muted-foreground'}`}>
                {note.review_status?.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>by {note.author_name}</span>
              <span>·</span>
              <span className="truncate">{note.job_address}</span>
              {note.created_date && <span>· {format(new Date(note.created_date), 'MMM d')}</span>}
            </div>
            {note.review_note && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-2 py-1.5">{note.review_note}</p>
            )}
            {note.visible_to_origin && (
              <p className="text-xs text-blue-600 flex items-center gap-1"><Eye className="w-3 h-3" />Visible to Destination Home</p>
            )}
            {note.nexus_submitted && (
              <p className="text-xs text-purple-600 flex items-center gap-1"><Send className="w-3 h-3" />Submitted to Nexus</p>
            )}
            {tab === 'pending' && (
              <button onClick={() => setReviewTarget(note)}
                className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">
                Review
              </button>
            )}
          </div>
        ))}
      </div>

      {reviewTarget && (
        <ReviewActionSheet
          note={reviewTarget}
          reviewer={reviewer}
          onClose={() => setReviewTarget(null)}
          onSaved={() => {
            setReviewTarget(null);
            qc.invalidateQueries({ queryKey: ['subcontract-notes'] });
            qc.invalidateQueries({ queryKey: ['wo-needs-review'] });
          }}
        />
      )}
    </AppLayout>
  );
}