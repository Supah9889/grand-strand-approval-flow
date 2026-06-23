import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/audit';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2, Send, ExternalLink, Search, Filter } from 'lucide-react';

const STATUS_OPTIONS = ['all', 'new', 'reviewed', 'accepted', 'deferred', 'rejected'];
const PRIORITY_OPTIONS = ['all', 'low', 'medium', 'high', 'critical'];

const STATUS_COLORS = {
  new:      'bg-blue-100 text-blue-700',
  reviewed: 'bg-muted text-muted-foreground',
  accepted: 'bg-green-100 text-green-700',
  deferred: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
};
const PRIORITY_COLORS = {
  low:      'bg-muted text-muted-foreground',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function ReviewFeedbackAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();

  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [responseNotes, setResponseNotes] = useState({});
  const [sendingNexus, setSendingNexus] = useState(null);

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ['review-feedback', company?.id],
    queryFn: () => base44.entities.ReviewFeedback.filter({ company_id: company?.id }, '-created_date', 200),
    enabled: !!company?.id,
  });

  const sections = useMemo(() => {
    const s = new Set(feedbacks.map(f => f.section).filter(Boolean));
    return ['all', ...Array.from(s)];
  }, [feedbacks]);

  const filtered = useMemo(() => {
    let r = feedbacks;
    if (statusFilter !== 'all') r = r.filter(f => f.status === statusFilter);
    if (priorityFilter !== 'all') r = r.filter(f => f.priority === priorityFilter);
    if (sectionFilter !== 'all') r = r.filter(f => f.section === sectionFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(f =>
        (f.reviewer_name || '').toLowerCase().includes(q) ||
        (f.feedback_text || '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [feedbacks, statusFilter, priorityFilter, sectionFilter, search]);

  const updateStatus = useMutation({
    mutationFn: ({ id, status, response_note }) =>
      base44.entities.ReviewFeedback.update(id, { status, ...(response_note ? { response_note } : {}) }),
    onSuccess: (rec, { status, response_note }) => {
      logAudit('review_feedback_status_changed', 'ReviewFeedback', rec.id, {
        new_status: status,
        reviewer_name: rec.reviewer_name,
        section: rec.section,
      });
      // Also stamp reviewed_by / reviewed_at
      base44.entities.ReviewFeedback.update(rec.id, {
        reviewed_by: user?.full_name || 'Admin',
        reviewed_at: new Date().toISOString(),
      }).catch(() => {});
      qc.invalidateQueries(['review-feedback', company?.id]);
    },
  });

  const sendToNexus = async (feedback) => {
    setSendingNexus(feedback.id);
    try {
      const nexusItem = await base44.entities.NexusItem.create({
        company_id: company?.id,
        title: `[Review Feedback] ${feedback.section} — ${feedback.reviewer_name}`,
        description: feedback.feedback_text,
        category: 'review_feedback',
        priority: feedback.priority || 'medium',
        status: 'pending',
        source_type: 'manual',
      });
      await base44.entities.ReviewFeedback.update(feedback.id, {
        status: 'reviewed',
        nexus_item_id: nexusItem.id,
      });
      logAudit('review_feedback_sent_to_nexus', 'ReviewFeedback', feedback.id, {
        nexus_item_id: nexusItem.id,
        reviewer_name: feedback.reviewer_name,
        section: feedback.section,
      });
      qc.invalidateQueries(['review-feedback', company?.id]);
    } finally {
      setSendingNexus(null);
    }
  };

  const newCount = feedbacks.filter(f => f.status === 'new').length;

  return (
    <AppLayout title="Review Feedback">
      <div className="app-page space-y-5">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Review Feedback</h1>
            <p className="app-page-subtitle">
              {feedbacks.length} total · <span className="text-blue-600 font-medium">{newCount} new</span>
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="text-xs text-muted-foreground mb-1 block">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <input className="w-full h-8 pl-8 pr-3 rounded-lg border border-input bg-card text-xs"
                placeholder="Reviewer or feedback text..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {[
            { label: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
            { label: 'Priority', value: priorityFilter, onChange: setPriorityFilter, options: PRIORITY_OPTIONS },
            { label: 'Section', value: sectionFilter, onChange: setSectionFilter, options: sections },
          ].map(({ label, value, onChange, options }) => (
            <div key={label}>
              <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
              <select className="h-8 px-2 rounded-lg border border-input bg-card text-xs"
                value={value} onChange={e => onChange(e.target.value)}>
                {options.map(o => <option key={o} value={o}>{o === 'all' ? `All ${label}s` : o.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">No feedback matches these filters</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(f => {
              const isExpanded = expandedId === f.id;
              return (
                <div key={f.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : f.id)}>
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{f.reviewer_name}</span>
                        {f.reviewer_role && <span className="text-[11px] text-muted-foreground">· {f.reviewer_role}</span>}
                        <span className="text-[11px] text-muted-foreground">· {f.section?.replace(/_/g, ' ')}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ml-auto ${STATUS_COLORS[f.status] || 'bg-muted text-muted-foreground'}`}>{f.status}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PRIORITY_COLORS[f.priority] || 'bg-muted text-muted-foreground'}`}>{f.priority}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.feedback_text}</p>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/10">
                      <p className="text-sm text-foreground leading-relaxed">{f.feedback_text}</p>

                      {f.response_note && (
                        <div className="bg-card border border-border rounded-lg p-3">
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Internal Response</p>
                          <p className="text-xs text-foreground">{f.response_note}</p>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Internal Response Note</label>
                        <textarea className="w-full px-3 py-2 rounded-lg border border-input bg-card text-xs resize-none" rows={2}
                          placeholder="Add internal notes (not visible to reviewer)..."
                          value={responseNotes[f.id] || f.response_note || ''}
                          onChange={e => setResponseNotes(prev => ({ ...prev, [f.id]: e.target.value }))} />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {['reviewed', 'accepted', 'deferred', 'rejected'].map(s => (
                          <button key={s}
                            onClick={() => updateStatus.mutate({ id: f.id, status: s, response_note: responseNotes[f.id] })}
                            disabled={updateStatus.isPending || f.status === s}
                            className={`h-7 px-3 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 capitalize
                              ${s === 'accepted' ? 'border-green-300 text-green-700 hover:bg-green-50'
                              : s === 'rejected' ? 'border-red-300 text-red-700 hover:bg-red-50'
                              : s === 'deferred' ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                              : 'border-border text-muted-foreground hover:bg-muted'}`}>
                            {s}
                          </button>
                        ))}
                        <button
                          onClick={() => sendToNexus(f)}
                          disabled={sendingNexus === f.id || !!f.nexus_item_id}
                          className="h-7 px-3 rounded-lg text-xs font-semibold border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-40 flex items-center gap-1.5">
                          {sendingNexus === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          {f.nexus_item_id ? 'Sent to Nexus' : 'Send to Nexus'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}