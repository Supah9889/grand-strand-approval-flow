import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { logAudit } from '@/lib/audit';
import { Button } from '@/components/ui/button';
import { X, Loader2, CheckSquare, Square, AlertTriangle } from 'lucide-react';

const CHECKLIST_ITEMS = [
  { key: 'customer_confirmed',     label: 'Customer confirmed in new platform' },
  { key: 'property_confirmed',     label: 'Property address confirmed' },
  { key: 'open_work_identified',   label: 'Open work / scope identified' },
  { key: 'documents_attached',     label: 'Required documents attached' },
  { key: 'photos_reviewed',        label: 'Photos reviewed and transferred' },
  { key: 'notes_reviewed',         label: 'Notes reviewed and migrated' },
  { key: 'team_confirmed',         label: 'Assigned team confirmed' },
  { key: 'platform_job_created',   label: 'New platform job created (converted)' },
  { key: 'field_team_notified',    label: 'Field team notified of transition' },
  { key: 'proven_jobs_archived',   label: 'Marked as archive/reference in Proven Jobs' },
];

const CUTOVER_STATUSES = [
  { value: 'not_started',       label: 'Not Started',        color: 'bg-muted text-muted-foreground' },
  { value: 'preparing',         label: 'Preparing',          color: 'bg-blue-100 text-blue-700' },
  { value: 'ready_for_cutover', label: 'Ready for Cutover',  color: 'bg-cyan-100 text-cyan-700' },
  { value: 'cutover_complete',  label: 'Cutover Complete',   color: 'bg-green-100 text-green-700' },
  { value: 'blocked',           label: 'Blocked',            color: 'bg-red-100 text-red-700' },
];

export default function LegacyCutoverModal({ record, onClose, onSaved }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const existingChecklist = (() => {
    try { return JSON.parse(record.cutover_checklist || '{}'); } catch { return {}; }
  })();

  const [checklist, setChecklist] = useState(existingChecklist);
  const [status, setStatus] = useState(record.cutover_status || 'not_started');
  const [notes, setNotes] = useState(record.cutover_notes || '');
  const [error, setError] = useState(null);

  const checkedCount = CHECKLIST_ITEMS.filter(i => checklist[i.key]).length;
  const allChecked = checkedCount === CHECKLIST_ITEMS.length;

  const toggleItem = (key) =>
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));

  const save = useMutation({
    mutationFn: () => {
      const isComplete = status === 'cutover_complete';
      return base44.entities.LegacyJobRecord.update(record.id, {
        cutover_status: status,
        cutover_checklist: JSON.stringify(checklist),
        cutover_notes: notes,
        ...(isComplete ? {
          cutover_by: user?.full_name,
          cutover_at: new Date().toISOString(),
        } : {}),
      });
    },
    onSuccess: () => {
      const action = status === 'cutover_complete' ? 'legacy_cutover_completed' : 'legacy_cutover_prepared';
      logAudit(action, 'LegacyJobRecord', record.id, {
        cutover_status: status,
        checklist_count: checkedCount,
        job_name: record.job_name,
        customer_name: record.customer_name,
      });
      qc.invalidateQueries(['legacy-records']);
      onSaved?.();
    },
    onError: (err) => setError(err.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Prepare for Cutover</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">
              {record.job_name || record.property_address || 'Legacy Job'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Status picker */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Cutover Status</label>
            <div className="flex flex-wrap gap-2">
              {CUTOVER_STATUSES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStatus(s.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    status === s.value
                      ? `${s.color} border-current`
                      : 'bg-card text-muted-foreground border-border hover:border-muted-foreground'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Checklist Progress</span>
              <span className={`font-bold ${allChecked ? 'text-green-600' : 'text-foreground'}`}>
                {checkedCount}/{CHECKLIST_ITEMS.length}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${allChecked ? 'bg-green-500' : 'bg-primary'}`}
                style={{ width: `${Math.round((checkedCount / CHECKLIST_ITEMS.length) * 100)}%` }}
              />
            </div>
          </div>

          {/* Checklist items */}
          <div className="space-y-1">
            {CHECKLIST_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => toggleItem(item.key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/30 text-left transition-colors"
              >
                {checklist[item.key]
                  ? <CheckSquare className="w-4 h-4 text-green-600 shrink-0" />
                  : <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                }
                <span className={`text-sm ${checklist[item.key] ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Cutover Notes</label>
            <textarea
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none"
              rows={3}
              placeholder="Notes about blockers, pending items, or transition details..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {status === 'cutover_complete' && !allChecked && (
            <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">
                {CHECKLIST_ITEMS.length - checkedCount} checklist item{CHECKLIST_ITEMS.length - checkedCount !== 1 ? 's' : ''} incomplete. You can still mark cutover complete, but please review.
              </p>
            </div>
          )}

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2">{error}</p>}
        </div>

        <div className="flex gap-2 justify-end p-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Cutover Status
          </Button>
        </div>
      </div>
    </div>
  );
}