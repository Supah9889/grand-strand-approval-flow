import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Pen, CheckCircle2, Clock, AlertCircle, ExternalLink,
  Lock, Plus, X, Save, Loader2, FileText, ChevronDown, ChevronUp,
  Paperclip, User, Calendar, RefreshCw, Archive, XCircle, Eye, Upload
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { getSession } from '@/lib/adminAuth';
import { normalizeSignatureRecordPayload, validateSignatureRecordPayload } from '@/lib/signatureRecords';
import {
  SIGNATURE_DOCUMENT_MODES,
  SIGNATURE_PLACEMENTS,
  normalizeSignatureDocumentMode,
  normalizeSignaturePlacement,
} from '@/lib/signatureDocumentModes';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:    { label: 'Draft',    color: 'bg-muted text-muted-foreground',         dot: 'bg-muted-foreground', icon: FileText },
  sent:     { label: 'Sent',     color: 'bg-blue-50 text-blue-700',               dot: 'bg-blue-400',         icon: Clock },
  viewed:   { label: 'Viewed',   color: 'bg-cyan-50 text-cyan-700',               dot: 'bg-cyan-400',         icon: Eye },
  signed:   { label: 'Signed',   color: 'bg-green-50 text-green-700 font-medium', dot: 'bg-green-500',        icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'bg-red-50 text-red-700',                 dot: 'bg-red-400',          icon: XCircle },
  replaced: { label: 'Replaced', color: 'bg-amber-50 text-amber-700',             dot: 'bg-amber-400',        icon: RefreshCw },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500',            dot: 'bg-slate-300',        icon: Archive },
};

const SIGNER_ROLE_OPTIONS = [
  { value: 'homeowner',       label: 'Homeowner' },
  { value: 'tenant',          label: 'Tenant' },
  { value: 'builder_rep',     label: 'Builder Rep' },
  { value: 'customer',        label: 'Customer' },
  { value: 'internal_approver', label: 'Internal Approver' },
  { value: 'vendor_sub',      label: 'Vendor / Sub' },
  { value: 'office_admin',    label: 'Office / Admin' },
  { value: 'general',         label: 'General Signer' },
];

const STATUS_OPTIONS = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }));

const DOCUMENT_MODE_OPTIONS = [
  {
    value: SIGNATURE_DOCUMENT_MODES.GENERATED_TEMPLATE,
    label: 'Generated Template',
    description: 'Creates a signed approval document from the app template.',
  },
  {
    value: SIGNATURE_DOCUMENT_MODES.STAMP_UPLOADED_PDF,
    label: 'Stamp Uploaded PDF',
    description: "Stamps the customer's signature and timestamp onto the uploaded work order PDF.",
  },
];

const PLACEMENT_OPTIONS = [
  { value: SIGNATURE_PLACEMENTS.BOTTOM_LEFT, label: 'Bottom-left' },
  { value: SIGNATURE_PLACEMENTS.BOTTOM_RIGHT, label: 'Bottom-right' },
];

function getDocumentModeLabel(mode) {
  return DOCUMENT_MODE_OPTIONS.find(option => option.value === normalizeSignatureDocumentMode(mode))?.label || 'Generated template';
}

function getPlacementLabel(placement) {
  return PLACEMENT_OPTIONS.find(option => option.value === normalizeSignaturePlacement(placement))?.label || 'Bottom-right';
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.detail ||
    error?.response?.data?.message ||
    error?.message ||
    fallback;
}

function withTimeout(promise, message, timeoutMs = 15000) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function verifySignatureSetup(savedJob, expected) {
  if (!savedJob) return { ok: false, reason: 'Job record not found after save' };

  const checks = [
    ['signature_document_mode', expected.signature_document_mode, savedJob.signature_document_mode],
    ['signature_placement', expected.signature_placement || '', savedJob.signature_placement || ''],
  ];

  if (expected.signature_document_mode === SIGNATURE_DOCUMENT_MODES.STAMP_UPLOADED_PDF) {
    checks.push(
      ['source_work_order_file_url', expected.source_work_order_file_url, savedJob.source_work_order_file_url],
      ['source_work_order_file_name', expected.source_work_order_file_name, savedJob.source_work_order_file_name],
    );
  }

  for (const [field, exp, got] of checks) {
    if (exp !== got) {
      return { ok: false, reason: `${field} expected "${exp}" but got "${got || '(empty)'}"` };
    }
  }

  return { ok: true, reason: null };
}

function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.draft;
}

function fmtDate(ts) {
  if (!ts) return null;
  try { return format(parseISO(ts), 'MMM d, yyyy'); } catch { return null; }
}

function SignatureDocumentSetup({ job, isAdmin }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState(normalizeSignatureDocumentMode(job.signature_document_mode));
  const [placement, setPlacement] = useState(normalizeSignaturePlacement(job.signature_placement));
  const [sourceUrl, setSourceUrl] = useState(job.source_work_order_file_url || '');
  const [sourceName, setSourceName] = useState(job.source_work_order_file_name || '');
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ state: 'idle', message: '', details: null });

  const isPdfMode = mode === SIGNATURE_DOCUMENT_MODES.STAMP_UPLOADED_PDF;
  const selectedMode = DOCUMENT_MODE_OPTIONS.find(option => option.value === mode) || DOCUMENT_MODE_OPTIONS[0];
  const currentMode = normalizeSignatureDocumentMode(job.signature_document_mode);
  const currentPlacement = normalizeSignaturePlacement(job.signature_placement);

  useEffect(() => {
    setMode(normalizeSignatureDocumentMode(job.signature_document_mode));
    setPlacement(normalizeSignaturePlacement(job.signature_placement));
    setSourceUrl(job.source_work_order_file_url || '');
    setSourceName(job.source_work_order_file_name || '');
  }, [job.id, job.signature_document_mode, job.signature_placement, job.source_work_order_file_url, job.source_work_order_file_name]);

  const saveMut = useMutation({
    mutationFn: async () => {
      setSaveStatus({ state: 'saving', message: 'Saving signature setup...', details: null });

      if (isPdfMode && !sourceUrl) {
        throw new Error('Please upload a work order PDF');
      }

      const payload = {
        signature_document_mode: mode,
        source_work_order_file_url: sourceUrl,
        source_work_order_file_name: sourceName,
        signature_placement: placement,
      };

      await withTimeout(
        base44.entities.Job.update(job.id, payload),
        'Signature setup save timed out. Please try again.'
      );

      const refreshedJobs = await withTimeout(
        base44.entities.Job.filter({ id: job.id }),
        'Signature setup saved, but verification timed out. Please refresh and check the job.'
      );
      const refreshedJob = refreshedJobs?.[0];

      const verification = verifySignatureSetup(refreshedJob, payload);
      if (!verification.ok) {
        throw new Error(`Signature setup did not persist: ${verification.reason}`);
      }

      return refreshedJob;
    },
    onSuccess: (savedJob) => {
      queryClient.setQueryData(['job-hub', job.id], savedJob);
      queryClient.invalidateQueries({ queryKey: ['job-hub', job.id] });
      setSaveStatus({
        state: 'success',
        message: 'Saved successfully',
        details: {
          mode: getDocumentModeLabel(savedJob.signature_document_mode),
          fileName: savedJob.source_work_order_file_name || 'None uploaded',
          placement: getPlacementLabel(savedJob.signature_placement),
        },
      });
      toast.success(`Signature setup saved: ${getDocumentModeLabel(mode)}`);
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Failed to save signature setup');
      setSaveStatus({ state: 'error', message, details: null });
      toast.error(message);
    },
  });

  const handlePdfUpload = async (file) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      toast.error('Upload a PDF work order.');
      return;
    }

    setUploading(true);
    try {
      const uploadResult = await withTimeout(
        base44.integrations.Core.UploadFile({ file }),
        'Work order upload timed out. Please try again.'
      );
      if (!uploadResult?.file_url) {
        throw new Error('Work order upload failed: missing file URL');
      }

      setSourceUrl(uploadResult.file_url);
      setSourceName(file.name);
      setSaveStatus({ state: 'idle', message: '', details: null });
      toast.success('Work order PDF uploaded');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Work order upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (isPdfMode && !sourceUrl) {
      setSaveStatus({ state: 'error', message: 'Please upload a work order PDF', details: null });
      toast.error('Please upload a work order PDF');
      return;
    }
    saveMut.mutate();
  };

  const markDirty = (fn) => (value) => {
    setSaveStatus({ state: 'idle', message: '', details: null });
    fn(value);
  };

  if (!isAdmin) {
    return (
      <div className="bg-muted/40 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-muted-foreground mb-1">Signature Document Setup</p>
        <p className="text-xs text-muted-foreground">{selectedMode.description}</p>
        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <p>Current mode: <span className="font-medium text-foreground">{getDocumentModeLabel(currentMode)}</span></p>
          {job.source_work_order_file_name && <p>Work order: <span className="font-medium text-foreground">{job.source_work_order_file_name}</span></p>}
          <p>Placement: <span className="font-medium text-foreground">{getPlacementLabel(currentPlacement)}</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Signature Document Setup</p>
        <p className="text-xs text-muted-foreground mt-1">{selectedMode.description}</p>
        <div className="mt-3 grid gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-3">
          <p>Current mode: <span className="block font-medium text-foreground">{getDocumentModeLabel(currentMode)}</span></p>
          <p>Work order: <span className="block truncate font-medium text-foreground">{job.source_work_order_file_name || 'None uploaded'}</span></p>
          <p>Placement: <span className="block font-medium text-foreground">{getPlacementLabel(currentPlacement)}</span></p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Document mode</label>
        <Select value={mode} onValueChange={markDirty(value => setMode(normalizeSignatureDocumentMode(value)))}>
          <SelectTrigger className="h-9 rounded-xl text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_MODE_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPdfMode && (
        <div className="space-y-3 rounded-xl border border-dashed border-border bg-secondary/30 p-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Source work order PDF</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={`w-full min-h-16 rounded-xl border border-border bg-background px-3 py-3 text-left text-sm transition-colors ${
                sourceUrl ? 'text-foreground hover:border-primary/40' : 'text-muted-foreground hover:border-primary/40'
              }`}
            >
              <span className="flex items-center gap-2">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Upload className="w-4 h-4 text-primary" />}
                <span className="min-w-0">
                  <span className="block truncate">{sourceName || 'Upload work order PDF'}</span>
                  {sourceUrl && <span className="block text-xs text-muted-foreground mt-0.5">Ready for signature stamping</span>}
                </span>
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={event => handlePdfUpload(event.target.files?.[0] || null)}
            />
          </div>

          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Paperclip className="w-3 h-3" />
              View uploaded work order
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Signature placement</label>
            <Select value={placement} onValueChange={markDirty(value => setPlacement(normalizeSignaturePlacement(value)))}>
              <SelectTrigger className="h-9 rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLACEMENT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {saveStatus.state !== 'idle' && (
        <div className={`rounded-xl border px-3 py-2 text-xs ${
          saveStatus.state === 'success'
            ? 'border-green-200 bg-green-50 text-green-800'
            : saveStatus.state === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-primary/20 bg-secondary text-primary'
        }`}>
          <div className="flex items-center gap-2 font-semibold">
            {saveStatus.state === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{saveStatus.message}</span>
          </div>
          {saveStatus.state === 'success' && saveStatus.details && (
            <div className="mt-2 grid gap-1 text-green-900 sm:grid-cols-3">
              <p>Mode: <span className="font-medium">{saveStatus.details.mode}</span></p>
              <p className="truncate">File: <span className="font-medium">{saveStatus.details.fileName}</span></p>
              <p>Placement: <span className="font-medium">{saveStatus.details.placement}</span></p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMut.isPending || uploading}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {saveMut.isPending ? 'Saving...' : 'Save setup'}
        </button>
      </div>
    </div>
  );
}

// ── Inline create/edit form ───────────────────────────────────────────────────
function SignatureRecordForm({ jobId, jobAddress, initial, onDone, onCancel }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    signer_name: initial?.signer_name || '',
    signer_role: initial?.signer_role || 'customer',
    status: initial?.status || 'draft',
    notes: initial?.notes || '',
    output_file_url: initial?.output_file_url || '',
    output_file_name: initial?.output_file_name || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const actorName = getSession()?.employee?.name || 'Admin';

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = normalizeSignatureRecordPayload({
        job_id: jobId,
        job_address: jobAddress,
        title: form.title.trim(),
        description: form.description,
        signer_name: form.signer_name.trim() || null,
        signer_role: form.signer_role,
        status: form.status,
        signed_date: initial?.signed_date,
        notes: form.notes,
        output_file_url: form.output_file_url,
        output_file_name: form.output_file_name,
        is_primary: Boolean(initial?.is_primary),
        linked_job_approval: Boolean(initial?.linked_job_approval),
        created_by_name: actorName,
      });
      const errors = validateSignatureRecordPayload(payload);
      if (errors.length) {
        throw new Error(errors.join(' '));
      }
      if (initial?.id && payload.status !== 'signed' && initial.signed_date) {
        payload.signed_date = '';
      }
      if (initial?.id) {
        const oldStatus = initial.status;
        await base44.entities.SignatureRecord.update(initial.id, payload);
        // Log status change as a more descriptive audit event when status is transitioning
        const action = form.status === 'sent' && oldStatus !== 'sent'
          ? 'invoice_sent' // reuse "sent" action from ACTION_LABELS
          : 'record_edited';
        const detail = form.status === 'sent' && oldStatus !== 'sent'
          ? `${actorName} sent approval record "${form.title}" to ${form.signer_name || 'signer'}.`
          : `${actorName} updated approval record: "${form.title}" (${oldStatus} → ${form.status}).`;
        await logAudit(initial.id, action, actorName, detail, {
          module: 'signature', record_id: initial.id, job_id: jobId, job_address: jobAddress,
          old_value: oldStatus, new_value: form.status, is_sensitive: true,
        });
      } else {
        const rec = await base44.entities.SignatureRecord.create(payload);
        await logAudit(rec.id, 'record_created', actorName, `${actorName} created approval record: "${form.title}".`, {
          module: 'signature', record_id: rec.id, job_id: jobId, job_address: jobAddress, is_sensitive: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-sig-records', jobId] });
      toast.success(initial?.id ? 'Record updated' : 'Record created');
      onDone?.();
    },
    onError: (error) => {
      toast.error(error?.message || 'Could not save approval record');
    },
  });

  return (
    <div className="bg-secondary/30 border border-border rounded-xl p-4 space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{initial?.id ? 'Edit record' : 'New approval / signature item'}</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Title */}
      <Input
        value={form.title}
        onChange={e => set('title', e.target.value)}
        placeholder="Title — e.g. Work Authorization, Estimate Acceptance *"
        className="h-9 rounded-xl text-sm"
        autoFocus
      />

      {/* Description */}
      <Input
        value={form.description}
        onChange={e => set('description', e.target.value)}
        placeholder="Description (optional)"
        className="h-9 rounded-xl text-sm"
      />

      {/* Signer name + role */}
      <div className="flex gap-2">
        <Input
          value={form.signer_name}
          onChange={e => set('signer_name', e.target.value)}
          placeholder="Signer name"
          className="h-9 rounded-xl text-sm flex-1"
        />
        <Select value={form.signer_role} onValueChange={v => set('signer_role', v)}>
          <SelectTrigger className="h-9 rounded-xl text-xs w-40 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIGNER_ROLE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-12 shrink-0">Status</span>
        <Select value={form.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="h-9 rounded-xl text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Output file URL (optional) */}
      <div className="flex gap-2">
        <Input
          value={form.output_file_url}
          onChange={e => set('output_file_url', e.target.value)}
          placeholder="Output / signed doc URL (optional)"
          className="h-9 rounded-xl text-sm flex-1"
        />
        <Input
          value={form.output_file_name}
          onChange={e => set('output_file_name', e.target.value)}
          placeholder="File label"
          className="h-9 rounded-xl text-xs w-28 shrink-0"
        />
      </div>

      {/* Notes */}
      <Input
        value={form.notes}
        onChange={e => set('notes', e.target.value)}
        placeholder="Notes — context, exceptions, follow-up (optional)"
        className="h-9 rounded-xl text-sm"
      />

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel} className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          onClick={() => saveMut.mutate()}
          disabled={!form.title.trim() || saveMut.isPending}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {saveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save
        </button>
      </div>
    </div>
  );
}

// ── Single record card ────────────────────────────────────────────────────────
function SignatureRecordCard({ record, isAdmin, onEdit, onDelete, navigate, jobId }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = getStatusConfig(record.status);
  const StatusIcon = statusCfg.icon;
  const signerRoleLabel = SIGNER_ROLE_OPTIONS.find(o => o.value === record.signer_role)?.label || record.signer_role;

  const isArchived = record.status === 'archived' || record.status === 'replaced';
  const isSigned = record.status === 'signed';

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      isSigned ? 'border-green-200 bg-green-50/30' :
      isArchived ? 'border-slate-200 bg-slate-50/50 opacity-70' :
      'border-border bg-card'
    }`}>
      {/* Main row */}
      <div className="flex items-start gap-3 px-3.5 py-3">
        {/* Status icon */}
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
          isSigned ? 'bg-green-100' : isArchived ? 'bg-slate-100' : 'bg-muted'
        }`}>
          <StatusIcon className={`w-3.5 h-3.5 ${isSigned ? 'text-green-600' : isArchived ? 'text-slate-400' : 'text-muted-foreground'}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title + status badge */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground leading-tight">{record.title}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-1 ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>

          {/* Signer info */}
          {(record.signer_name || record.signer_role) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <User className="w-3 h-3 text-muted-foreground/50 shrink-0" />
              <p className="text-xs text-muted-foreground">
                {record.signer_name || '—'}
                {record.signer_role && <span className="ml-1 opacity-70">({signerRoleLabel})</span>}
              </p>
            </div>
          )}

          {/* Dates row */}
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {record.created_date && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Calendar className="w-2.5 h-2.5" />Created {fmtDate(record.created_date)}
              </span>
            )}
            {record.signed_date && (
              <span className="flex items-center gap-1 text-[10px] text-green-600">
                <CheckCircle2 className="w-2.5 h-2.5" />Signed {fmtDate(record.signed_date)}
              </span>
            )}
          </div>
        </div>

        {/* Expand / admin actions */}
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {(record.description || record.notes || record.output_file_url) && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => onEdit(record)}
              className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
              title="Edit"
            >
              <Pen className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border/50 px-3.5 py-3 space-y-2 bg-background/50">
          {record.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">{record.description}</p>
          )}
          {record.output_file_url && (
            <a
              href={record.output_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Paperclip className="w-3 h-3" />
              {record.output_file_name || 'Signed document'}
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
          {record.notes && (
            <p className="text-[10px] text-muted-foreground italic border-l-2 border-border pl-2">{record.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Job-level approval summary (from job.status) ──────────────────────────────
function JobApprovalSummary({ job, navigate }) {
  const isSigned = job.status === 'approved';
  const isPending = job.status === 'pending';

  return (
    <div className={`rounded-xl px-4 py-3 border flex items-start gap-3 ${
      isSigned ? 'bg-green-50 border-green-200' :
      isPending ? 'bg-amber-50/60 border-amber-200' :
      'bg-muted/40 border-border'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isSigned ? 'bg-green-100' : isPending ? 'bg-amber-100' : 'bg-muted'
      }`}>
        {isSigned
          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
          : isPending
            ? <Clock className="w-4 h-4 text-amber-600" />
            : <AlertCircle className="w-4 h-4 text-muted-foreground" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {isSigned ? 'Job Signed & Approved' : isPending ? 'Awaiting Signature' : 'Signature Not Yet Requested'}
          </p>
          {job.locked && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
              <Lock className="w-2.5 h-2.5" /> Locked
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isSigned
            ? `Signed${job.approval_timestamp ? ` ${format(parseISO(job.approval_timestamp), 'MMM d, yyyy · h:mm a')}` : ''}`
            : isPending
              ? 'Signature request sent to customer'
              : 'No signature collected yet'
          }
        </p>
        {isSigned && job.signature_url && (
          <div className="mt-2">
            <img src={job.signature_url} alt="Customer signature" className="max-h-10 rounded border border-green-200 bg-white" />
          </div>
        )}
      </div>
      <button
        onClick={() => navigate(`/approve?jobId=${job.id}`)}
        className="flex items-center gap-1 text-[11px] text-primary hover:underline shrink-0 mt-0.5"
      >
        <Pen className="w-3 h-3" />
        {isSigned ? 'View' : 'Open'}
        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
      </button>
    </div>
  );
}

// ── Main tab component ────────────────────────────────────────────────────────
export default function JobSignatureTab({ job, isAdmin }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['hub-sig-records', job.id],
    queryFn: () => base44.entities.SignatureRecord.filter({ job_id: job.id }, 'created_date'),
    enabled: !!job.id,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.SignatureRecord.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-sig-records', job.id] });
      toast.success('Record removed');
    },
  });

  const handleEdit = (rec) => { setEditingRecord(rec); setShowForm(false); };
  const closeForm = () => { setShowForm(false); setEditingRecord(null); };

  // Separate active vs archived
  const activeRecords = records.filter(r => r.status !== 'archived' && r.status !== 'replaced');
  const archivedRecords = records.filter(r => r.status === 'archived' || r.status === 'replaced');
  const pendingCount = activeRecords.filter(r => ['draft', 'sent', 'viewed'].includes(r.status)).length;

  return (
    <div className="space-y-3">

      {/* ── Job-level approval summary (existing flow) ── */}
      <JobApprovalSummary job={job} navigate={navigate} />

      <SignatureDocumentSetup job={job} isAdmin={isAdmin} />

      {/* ── Structured records section ── */}
      <div className="space-y-2">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Approval Records</p>
            {activeRecords.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                {activeRecords.length}
              </span>
            )}
            {pendingCount > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                {pendingCount} pending
              </span>
            )}
          </div>
          {isAdmin && !showForm && !editingRecord && (
            <button
              onClick={() => { setShowForm(true); setEditingRecord(null); }}
              className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>

        {/* Add form */}
        {showForm && !editingRecord && (
          <SignatureRecordForm
            jobId={job.id}
            jobAddress={job.address}
            onDone={closeForm}
            onCancel={closeForm}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        )}

        {/* Active records */}
        {!isLoading && activeRecords.length === 0 && !showForm && (
          <p className="text-xs text-muted-foreground italic py-2 px-1">
            No structured approval records yet.{isAdmin ? ' Use + Add to create one.' : ''}
          </p>
        )}

        {activeRecords.map(rec =>
          editingRecord?.id === rec.id ? (
            <SignatureRecordForm
              key={rec.id}
              jobId={job.id}
              jobAddress={job.address}
              initial={rec}
              onDone={closeForm}
              onCancel={closeForm}
            />
          ) : (
            <SignatureRecordCard
              key={rec.id}
              record={rec}
              isAdmin={isAdmin}
              onEdit={handleEdit}
              onDelete={(id) => deleteMut.mutate(id)}
              navigate={navigate}
              jobId={job.id}
            />
          )
        )}

        {/* Archived / replaced records */}
        {archivedRecords.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchived(v => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              {showArchived ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {showArchived ? 'Hide' : 'Show'} {archivedRecords.length} archived / replaced
            </button>
            {showArchived && archivedRecords.map(rec => (
              editingRecord?.id === rec.id ? (
                <SignatureRecordForm
                  key={rec.id}
                  jobId={job.id}
                  jobAddress={job.address}
                  initial={rec}
                  onDone={closeForm}
                  onCancel={closeForm}
                />
              ) : (
                <SignatureRecordCard
                  key={rec.id}
                  record={rec}
                  isAdmin={isAdmin}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteMut.mutate(id)}
                  navigate={navigate}
                  jobId={job.id}
                />
              )
            ))}
          </div>
        )}
      </div>

      {/* ── Admin audit detail ── */}
      {isAdmin && (
        <div className="bg-muted/40 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Job Approval Record</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Job status: <span className="text-foreground font-medium">{job.status || 'not set'}</span></p>
            {job.terms_version && <p>Terms: <span className="text-foreground font-medium">{job.terms_version}</span></p>}
            {job.approval_timestamp && (
              <p>Signed: <span className="text-foreground font-medium">
                {format(parseISO(job.approval_timestamp), 'PPpp')}
              </span></p>
            )}
            {job.review_rating && <p>Review: <span className="text-foreground font-medium">{job.review_rating}</span></p>}
          </div>
        </div>
      )}
    </div>
  );
}