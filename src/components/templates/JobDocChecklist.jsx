/**
 * JobDocChecklist
 * Full documentation readiness checklist for the JobDocumentation page.
 * Evaluates rooms, moisture readings, drying logs, air samples, equipment, notes, and photos.
 * Shows a "Suggest Template Improvement" Nexus button.
 */
import React, { useMemo, useState } from 'react';
import {
  CheckCircle2, Circle, AlertTriangle, ChevronDown, ChevronUp,
  Camera, FileText, Droplets, Wind, FlaskConical, Cpu, Home, Send, Loader2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { logAudit } from '@/lib/audit';
import { getInternalRole } from '@/lib/adminAuth';

const TYPE_META = {
  rooms:      { label: 'Rooms documented',        icon: Home,        check: ctx => ctx.rooms?.length > 0 },
  photos:     { label: 'Photos uploaded',          icon: Camera,      check: ctx => (ctx.photos?.length ?? 0) > 0 },
  moisture:   { label: 'Moisture readings logged', icon: Droplets,    check: ctx => ctx.moistureReadings?.length > 0 },
  drying:     { label: 'Drying logs recorded',     icon: Wind,        check: ctx => ctx.dryingLogs?.length > 0 },
  air_sample: { label: 'Air samples collected',    icon: FlaskConical,check: ctx => ctx.airSamples?.length > 0 },
  equipment:  { label: 'Equipment assigned',       icon: Cpu,         check: ctx => ctx.equipment?.length > 0 },
  notes:      { label: 'Field notes added',        icon: FileText,    check: ctx => ctx.notes?.length > 0 },
};

function NexusImprovementSheet({ jobId, jobAddress, templateId, templateName, company, employee, onClose }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const role = getInternalRole();

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await base44.entities.NexusItem.create({
      company_id: company?.id,
      company_slug: company?.slug,
      source_type: 'manual',
      source_id: templateId || jobId,
      title: `Template Improvement: ${templateName || jobAddress || 'Unknown job'}`,
      summary: text.slice(0, 200),
      raw_content: text,
      category: 'process_improvement',
      priority: 'normal',
      status: 'pending_review',
      submitted_by_name: employee?.name || 'Technician',
      linked_job_id: jobId,
      tags: JSON.stringify(['template_feedback']),
    });
    await logAudit(jobId, 'nexus_submitted', role || 'technician', `Template improvement suggestion submitted for: ${templateName || 'job'}`);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Suggest Template Improvement</p>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <p className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-2">
          This creates a <strong>pending_review</strong> item in Nexus. A reviewer must approve it — nothing is auto-applied.
        </p>
        {templateName && (
          <p className="text-xs text-foreground bg-muted rounded-lg px-3 py-2">
            Template: <strong>{templateName}</strong>
          </p>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Describe the improvement *</label>
          <textarea
            className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-28"
            placeholder="What should be added, changed, or clarified in the template?"
            value={text}
            onChange={e => setText(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button
            onClick={submit}
            disabled={!text.trim() || saving}
            className="flex-1 h-10 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" />Submit</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobDocChecklist({
  jobId, jobAddress, templateId, templateName,
  company, employee,
  context = {},
  className = '',
  canSubmitNexus = false,
}) {
  const [expanded, setExpanded] = useState(true);
  const [showNexus, setShowNexus] = useState(false);

  const items = useMemo(() => Object.entries(TYPE_META).map(([key, meta]) => ({
    key,
    label: meta.label,
    Icon: meta.icon,
    satisfied: meta.check(context),
  })), [context]);

  const satisfiedCount = items.filter(i => i.satisfied).length;
  const total = items.length;
  const allDone = satisfiedCount === total;

  return (
    <>
      <div className={`rounded-xl border ${allDone ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'} overflow-hidden ${className}`}>
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 gap-2"
        >
          <div className="flex items-center gap-2">
            {allDone
              ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            <span className="text-xs font-semibold text-foreground">Documentation Readiness</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${allDone ? 'text-emerald-700' : 'text-amber-700'}`}>
              {satisfiedCount}/{total}
            </span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </button>

        {/* Status banner */}
        {!allDone && (
          <div className="px-3 pb-2">
            <p className="text-[11px] text-amber-700 font-medium">⚠ Required documentation missing — complete before manager review</p>
          </div>
        )}
        {allDone && (
          <div className="px-3 pb-2">
            <p className="text-[11px] text-emerald-700 font-medium">✓ Ready for manager review</p>
          </div>
        )}

        {/* Item list */}
        {expanded && (
          <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2">
            {items.map(({ key, label, Icon, satisfied }) => (
              <div key={key} className="flex items-center gap-2">
                {satisfied
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  : <Circle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className={`text-xs ${satisfied ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{label}</span>
              </div>
            ))}

            {/* Nexus suggestion button */}
            {canSubmitNexus && (
              <div className="pt-2 border-t border-border/30">
                <button
                  type="button"
                  onClick={() => setShowNexus(true)}
                  className="flex items-center gap-1.5 text-xs text-purple-700 hover:text-purple-900 font-medium"
                >
                  <Send className="w-3 h-3" />
                  Suggest Template Improvement
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showNexus && (
        <NexusImprovementSheet
          jobId={jobId}
          jobAddress={jobAddress}
          templateId={templateId}
          templateName={templateName}
          company={company}
          employee={employee}
          onClose={() => setShowNexus(false)}
        />
      )}
    </>
  );
}