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
  CheckCircle2, Clock, FileUp, Send, ExternalLink, Loader2, ChevronRight, FileSearch,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { SIGNATURE_DOCUMENT_MODES } from '@/lib/signatureDocumentModes';
import DocumentPreviewModal from '@/components/shared/DocumentPreviewModal';

// ── Determine the current step ────────────────────────────────────────────────
function getStep(job) {
  if (job.status === 'approved') {
    return 'signed';
  }
  if (job.status === 'pending' && job.approval_timestamp) {
    return 'waiting';
  }
  if (job.source_work_order_file_url || job.signature_url) {
    return 'ready_to_send';
  }
  return 'needs_pdf';
}

// Pick the best signed doc URL: stamped output first, then job-level
function getBestSignedDocUrl(job) {
  return job.signed_output_file_url || null;
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
  waiting: {
    icon: Clock,
    iconColor: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
    title: 'Waiting on Signature',
    subtitle: 'The signature request has been sent to the customer.',
    actionLabel: 'Open Signature Page',
    actionIcon: ExternalLink,
  },
  ready_to_send: {
    icon: Send,
    iconColor: 'text-primary',
    bg: 'bg-primary/5 border-primary/20',
    title: 'Ready to Send for Signature',
    subtitle: 'Work order PDF is uploaded. Send the job for customer signature.',
    actionLabel: 'Send for Signature',
    actionIcon: ChevronRight,
  },
  needs_pdf: {
    icon: FileUp,
    iconColor: 'text-slate-500',
    bg: 'bg-muted/60 border-border',
    title: 'Upload Work Order PDF',
    subtitle: 'Upload a work order PDF to enable PDF signature stamping, or skip to send a generated approval.',
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

  const step = getStep(job);
  const cfg = STEP_CONFIG[step];
  const Icon = cfg.icon;
  const ActionIcon = cfg.actionIcon;

  const handleAction = async () => {
    if (step === 'signed') {
      const docUrl = getBestSignedDocUrl(job);
      if (docUrl) {
        setPreviewDoc({
          url: docUrl,
          title: job.source_work_order_file_name ? `Signed: ${job.source_work_order_file_name}` : 'Signed Work Order (Final)',
          docType: 'Signed Work Order (Final)',
        });
      } else {
        // No stamped PDF yet — fall back to approval page
        navigate(`/approve?jobId=${job.id}`);
      }
      return;
    }
    if (step === 'waiting' || step === 'ready_to_send') {
      navigate(`/approve?jobId=${job.id}`);
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
      const result = await base44.integrations.Core.UploadFile({ file });
      if (!result?.file_url) throw new Error('Upload failed: missing file URL');

      // Save PDF to job AND auto-set mode to stamp
      await base44.entities.Job.update(job.id, {
        source_work_order_file_url: result.file_url,
        source_work_order_file_name: file.name,
        signature_document_mode: SIGNATURE_DOCUMENT_MODES.STAMP_UPLOADED_PDF,
        signature_placement: job.signature_placement || 'bottom_right',
      });

      queryClient.invalidateQueries({ queryKey: ['job-hub', job.id] });
      toast.success('Work order uploaded — ready to send for signature.');
    } catch (err) {
      toast.error(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  // Skip showing the banner for non-admins on steps that require admin action
  if (!isAdmin && (step === 'needs_pdf' || step === 'ready_to_send')) {
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
          disabled={uploading}
          className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-0.5 disabled:opacity-50"
        >
          {uploading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <ActionIcon className="w-3.5 h-3.5" />
          }
          {uploading ? 'Uploading...' : cfg.actionLabel}
        </button>
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