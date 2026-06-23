import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/audit';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const DECISION_TYPES = [
  { value: 'continue_development',     label: 'Continue Development',      color: 'bg-blue-100 text-blue-700',    desc: 'More work needed before any rollout begins.' },
  { value: 'begin_parallel_run',       label: 'Begin Parallel Run',        color: 'bg-purple-100 text-purple-700', desc: 'Run platform alongside Proven Jobs for a defined period.' },
  { value: 'begin_limited_pilot',      label: 'Begin Limited Pilot',       color: 'bg-cyan-100 text-cyan-700',    desc: 'Onboard a small group of users for real-world testing.' },
  { value: 'approve_cutover_planning', label: 'Approve Cutover Planning',  color: 'bg-green-100 text-green-700',  desc: 'Platform is ready; begin planning full cutover from Proven Jobs.' },
  { value: 'blocked',                  label: 'Blocked',                   color: 'bg-red-100 text-red-700',      desc: 'Critical blocker identified — rollout paused until resolved.' },
];

const STATUS_COLORS = {
  draft:      'bg-muted text-muted-foreground',
  finalized:  'bg-green-100 text-green-700',
  superseded: 'bg-muted text-muted-foreground line-through',
};

const EMPTY_FORM = { reviewer_name: '', decision_type: '', decision: '', rationale: '', target_date: '', status: 'draft' };

export default function ReviewDecisions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, reviewer_name: user?.full_name || '' });
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: decisions = [], isLoading } = useQuery({
    queryKey: ['review-decisions', company?.id],
    queryFn: () => base44.entities.ReviewDecision.filter({ company_id: company?.id }, '-created_date', 50),
    enabled: !!company?.id,
  });

  const { data: rolloutChecklists = [] } = useQuery({
    queryKey: ['rollout-checklists', company?.id],
    queryFn: () => base44.entities.RolloutChecklist.filter({ company_id: company?.id }, '-created_date', 5),
    enabled: !!company?.id,
  });

  const createDecision = useMutation({
    mutationFn: () => base44.entities.ReviewDecision.create({
      ...form,
      company_id: company?.id,
      created_at: new Date().toISOString(),
      rollout_checklist_id: rolloutChecklists[0]?.id || '',
    }),
    onSuccess: (rec) => {
      logAudit('review_decision_created', 'ReviewDecision', rec.id, {
        decision_type: rec.decision_type,
        reviewer_name: rec.reviewer_name,
        decision: rec.decision,
      });
      setShowForm(false);
      setForm({ ...EMPTY_FORM, reviewer_name: user?.full_name || '' });
      qc.invalidateQueries(['review-decisions', company?.id]);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.ReviewDecision.update(id, { status }),
    onSuccess: (rec) => {
      logAudit('review_decision_updated', 'ReviewDecision', rec.id, {
        new_status: rec.status,
        reviewer_name: rec.reviewer_name,
      });
      qc.invalidateQueries(['review-decisions', company?.id]);
    },
  });

  const filtered = statusFilter === 'all' ? decisions : decisions.filter(d => d.status === statusFilter);

  return (
    <AppLayout title="Review Decisions">
      <div className="app-page max-w-3xl space-y-5">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Review Decisions</h1>
            <p className="app-page-subtitle">Formal rollout decisions made by Nick and leadership</p>
          </div>
          <Button size="sm" onClick={() => setShowForm(v => !v)}>
            <Plus className="w-4 h-4" /> New Decision
          </Button>
        </div>

        {/* Decision type reference */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Decision Types</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DECISION_TYPES.map(dt => (
              <div key={dt.value} className="flex items-start gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${dt.color}`}>{dt.label}</span>
                <p className="text-[11px] text-muted-foreground">{dt.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* New decision form */}
        {showForm && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">Record a Decision</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Reviewer Name</label>
                <input className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={form.reviewer_name} onChange={e => setForm(p => ({ ...p, reviewer_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Decision Type</label>
                <select className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={form.decision_type} onChange={e => setForm(p => ({ ...p, decision_type: e.target.value }))}>
                  <option value="">Select decision type...</option>
                  {DECISION_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Target Date</label>
                <input type="date" className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={form.target_date} onChange={e => setForm(p => ({ ...p, target_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                <select className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="finalized">Finalized</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Decision Summary</label>
              <input className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                placeholder="e.g. Begin 2-week parallel run starting July 7"
                value={form.decision} onChange={e => setForm(p => ({ ...p, decision: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Rationale</label>
              <textarea className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm resize-none" rows={3}
                placeholder="Why was this decision made? What conditions were met or not met?"
                value={form.rationale} onChange={e => setForm(p => ({ ...p, rationale: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={() => createDecision.mutate()}
                disabled={createDecision.isPending || !form.reviewer_name || !form.decision_type || !form.decision}>
                {createDecision.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Decision
              </Button>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter:</span>
          {['all', 'draft', 'finalized', 'superseded'].map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`h-7 px-3 rounded-full text-xs font-medium border transition-colors capitalize ${
                statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:border-muted-foreground'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
            <button onClick={() => setShowForm(true)} className="mt-2 text-xs text-primary underline">Record the first decision</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(d => {
              const dtCfg = DECISION_TYPES.find(t => t.value === d.decision_type);
              return (
                <div key={d.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-start gap-2 flex-wrap">
                    {dtCfg && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${dtCfg.color}`}>{dtCfg.label}</span>}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 capitalize ${STATUS_COLORS[d.status] || 'bg-muted text-muted-foreground'}`}>{d.status}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {d.reviewer_name} · {d.created_at ? format(new Date(d.created_at), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{d.decision}</p>
                  {d.rationale && <p className="text-xs text-muted-foreground leading-relaxed">{d.rationale}</p>}
                  {d.target_date && <p className="text-xs text-muted-foreground">Target: {format(new Date(d.target_date), 'MMM d, yyyy')}</p>}
                  {d.rollout_checklist_id && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" /> Linked to Rollout Checklist
                    </p>
                  )}
                  {d.status === 'draft' && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => updateStatus.mutate({ id: d.id, status: 'finalized' })}
                        disabled={updateStatus.isPending}
                        className="h-7 px-3 rounded-lg text-xs font-semibold border border-green-300 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40">
                        Finalize
                      </button>
                      <button onClick={() => updateStatus.mutate({ id: d.id, status: 'superseded' })}
                        disabled={updateStatus.isPending}
                        className="h-7 px-3 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40">
                        Supersede
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="pb-8" />
      </div>
    </AppLayout>
  );
}