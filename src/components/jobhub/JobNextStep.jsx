/**
 * JobNextStep — Guided "what to do next" banner for the Job Hub.
 *
 * Logic (in priority order):
 *  1. Job already signed/approved          → "Signed document ready" (green)
 *  2. Job has a pending signature request  → "Waiting on signature"  (amber)
 *  3. Work order PDF exists                → offer "Send for Signature"
 *  4. No PDF yet                           → offer "Upload Work Order"
 */

import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, FileUp, Send, Loader2, ChevronRight, FileSearch,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { SIGNATURE_DOCUMENT_MODES } from '@/lib/signatureDocumentModes';
import DocumentPreviewModal from '@/components/shared/DocumentPreviewModal';
import { JOB_PRIMARY_ACTIONS, getBestSignedDocR2Key, getBestSignedDocUrl, getJobPrimaryAction } from '@/lib/signedDocHelpers';
import { buildApprovalPath, ensureSignaturePublicToken } from '@/lib/signingLinks';
import { isBuildertrendImportedJob } from '@/lib/jobHelpers';

function toR2Ref(key) {
  return key ? `r2://${key}` : '';
}

function keyFromR2Ref(value) {
  return typeof value === 'string' && value.startsWith('r2://') ? value.slice(5) : '';
}

function isMissingR2Function(error) {
  const status = error?.response?.status || error?.status;
  const message = String(error?.message || error?.response?.data?.error || error?.response?.data?.message || '').toLowerCase();
  return status === 404 || message.includes('not found') || message.includes('function');
}

function getR2UploadErrorMessage(error) {
  if (isMissingR2Function(error)) {
    return 'Secure file upload is not configured yet. Please contact admin.';
  }
  return error?.message || 'Upload failed. Please try again.';
}

async function uploadFileToR2({ jobId, file, category, purpose }) {
  const response = await base44.functions.invoke('requestR2UploadUrl', {
    jobId,
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    category,
    purpose,
  });
  const data = response?.data || response;
  if (!data?.uploadUrl || !data?.r2Key) throw new Error('R2 upload URL request failed.');

  const uploadResponse = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: file.type ? { 'Content-Type': file.type } : {},
    body: file,
  });
  if (!uploadResponse.ok) throw new Error('R2 upload failed.');

  return { r2Key: data.r2Key, fileRef: toR2Ref(data.r2Key) };
}

async function resolveFileUrl({ jobId, value, r2Key, category, purpose }) {
  const key = r2Key || keyFromR2Ref(value);
  if (!key) return value || '';

  const response = await base44.functions.invoke('requestR2ReadUrl', {
    jobId,
    fileKey: key,
    category,
    purpose,
  });
  const data = response?.data || response;
  if (!data?.signedUrl) throw new Error('R2 read URL request failed.');
  return data.signedUrl;
}

// ── Determine the current step ────────────────────────────────────────────────
function getStep(job) {
  const primaryAction = getJobPrimaryAction(job);
  if (
    primaryAction.type === JOB_PRIMARY_ACTIONS.VIEW_SIGNED_DOCUMENT ||
    primaryAction.type === JOB_PRIMARY_ACTIONS.SIGNED_DOCUMENT_MISSING
  ) return 'signed';
  if (primaryAction.type === JOB_PRIMARY_ACTIONS.UPLOAD_WORK_ORDER) return 'needs_pdf';
  if (primaryAction.type === JOB_PRIMARY_ACTIONS.WAITING_ON_WORK_ORDER) return 'needs_pdf';
  return 'ready_to_send';
}

// ── Step config ───────────────────────────────────────────────────────────────
const STEP_CONFIG = {
  signed: {
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    title: 'Job Signed & Approved',
    subtitle: 'The customer has signed. You\'re all set.',
    actionLabel: 'View Signed Document',
    actionIcon: FileSearch,
  },
  ready_to_send: {
    icon: Send,
    iconColor: 'text-primary',
    bg: 'bg-primary/5 border-primary/20',
    title: 'Ready to Send for Signature',
    subtitle: 'Send the job to the customer for review and signature.',
    actionLabel: 'Send for Signature',
    actionIcon: ChevronRight,
  },
  needs_pdf: {
    icon: FileUp,
    iconColor: 'text-slate-500',
    bg: 'bg-muted/60 border-border',
    title: 'Upload Work Order PDF',
    subtitle: 'This job is set to stamp an uploaded work order before it can be sent for signature.',
    actionLabel: 'Upload Work Order',
    actionIcon: ChevronRight,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function JobNextStep({ job, isAdmin, onGoToSignature }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null); // { url, title, docType }

  if (isBuildertrendImportedJob(job)) {
    return null;
  }

  const primaryAction = getJobPrimaryAction(job, [], { canUploadWorkOrder: isAdmin });
  const step = getStep(job);
  const cfg = STEP_CONFIG[step];
  const Icon = cfg.icon;
  const ActionIcon = cfg.actionIcon;

  const handleAction = async () => {
    if (step === 'signed') {
      const docUrl = getBestSignedDocUrl(job);
      const docR2Key = getBestSignedDocR2Key(job);
      if (docUrl || docR2Key) {
        const resolvedUrl = await resolveFileUrl({
          jobId: job.id,
          value: docUrl,
          r2Key: docR2Key || keyFromR2Ref(docUrl),
          category: 'signed_doc',
          purpose: 'preview_signed_document',
        });
        setPreviewDoc({
          url: resolvedUrl,
          title: job.source_work_order_file_name ? `Signed: ${job.source_work_order_file_name}` : 'Signed Work Order (Final)',
          docType: 'Signed Work Order (Final)',
        });
      }
      if (!docUrl && !docR2Key) {
        toast.error('Signed document is not available yet.');
      }
      return;
    }
    if (step === 'ready_to_send') {
      try {
        const signingToken = await ensureSignaturePublicToken(job);
        queryClient.invalidateQueries({ queryKey: ['job-hub', job.id] });
        navigate(buildApprovalPath(job.id, signingToken));
      } catch (error) {
        toast.error(error?.message || 'Could not create a secure signing link.');
      }
      return;
    }
    // needs_pdf → open file picker
    if (step === 'needs_pdf') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) { toast.error('Please upload a PDF file.'); return; }

    setUploading(true);
    try {
      const result = await uploadFileToR2({
        jobId: job.id,
        file,
        category: 'contract',
        purpose: 'source_work_order_pdf',
      });

      // Save PDF to job AND auto-set mode to stamp
      await base44.entities.Job.update(job.id, {
        source_work_order_file_url: result.fileRef,
        source_work_order_r2_key: result.r2Key,
        source_work_order_file_name: file.name,
        signature_document_mode: SIGNATURE_DOCUMENT_MODES.STAMP_UPLOADED_PDF,
        signature_placement: job.signature_placement || 'bottom_right',
      });

      queryClient.invalidateQueries({ queryKey: ['job-hub', job.id] });
      toast.success('Work order uploaded — ready to send for signature.');
    } catch (err) {
      toast.error(getR2UploadErrorMessage(err));
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  // Skip send actions for non-admins, but still show a clear blocked work-order state.
  if (!isAdmin && step === 'ready_to_send') {
    return null;
  }

  return (
    <>
    <DocumentPreviewModal
      open={!!previewDoc}
      onClose={() => setPreviewDoc(null)}
      url={previewDoc?.url}
      title={previewDoc?.title}
      docType={previewDoc?.docType}
    />
    <div className={`rounded-2xl border px-4 py-3.5 flex items-start gap-3 ${cfg.bg}`}>
      {/* Icon */}
      <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">{cfg.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{cfg.subtitle}</p>
      </div>

      {/* Action button */}
      {isAdmin && (
        <button
          onClick={handleAction}
          disabled={uploading || primaryAction.disabled}
          className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-0.5 disabled:opacity-50"
        >
          {uploading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <ActionIcon className="w-3.5 h-3.5" />
          }
          {uploading ? 'Uploading...' : cfg.actionLabel}
        </button>
      )}
      {!isAdmin && step === 'needs_pdf' && (
        <p className="mt-0.5 shrink-0 text-xs font-medium text-muted-foreground">
          Ask an admin to upload the work order.
        </p>
      )}

      {/* Hidden file input for PDF upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
    </>
  );
}
