import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, User, Calendar, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import AppLayout from '../components/AppLayout';
import SignatureCanvas from '../components/SignatureCanvas';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';
import { TERMS_VERSION, buildApprovalStatement } from '@/lib/terms';
import { upsertPrimaryJobApprovalRecord } from '@/lib/signatureRecords';
import { renderDefaultApprovalDocument } from '@/lib/defaultApprovalTemplate';
import { isStampUploadedPdfMode, normalizeSignatureDocumentMode } from '@/lib/signatureDocumentModes';
import { stampWorkOrderPdf } from '@/lib/workOrderPdfStamping';

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

function getR2UploadErrorMessage(error, fallback = 'Submission failed. Please try again.') {
  if (isMissingR2Function(error)) {
    return 'Secure file upload is not configured yet. Please contact admin.';
  }
  return error?.message || fallback;
}

function getSigningToken(urlParams) {
  return urlParams.get('token') || urlParams.get('signatureToken') || urlParams.get('signature_token') || urlParams.get('approvalToken') || urlParams.get('approval_token') || '';
}

function appendSigningToken(path, signingToken) {
  return signingToken ? `${path}&token=${encodeURIComponent(signingToken)}` : path;
}

async function uploadFileToR2({ jobId, file, category, purpose, publicSigning = false, signingToken = '' }) {
  const response = await base44.functions.invoke('requestR2UploadUrl', {
    jobId,
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    fileSize: file.size,
    category,
    purpose,
    publicSigning,
    signingToken,
  });
  const data = response?.data || response;
  if (!data?.uploadUrl || !data?.r2Key) throw new Error('R2 upload URL request failed.');

  const uploadResponse = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: file.type ? { 'Content-Type': file.type } : {},
    body: file,
  });
  if (!uploadResponse.ok) throw new Error('R2 upload failed.');

  if (publicSigning) {
    const verifyResponse = await base44.functions.invoke('requestR2UploadUrl', {
      action: 'verify_public_signature_upload',
      jobId,
      fileKey: data.r2Key,
      uploadSessionId: data.uploadSessionId,
      category,
      purpose,
      publicSigning: true,
      signingToken,
    });
    const verifyData = verifyResponse?.data || verifyResponse;
    if (!verifyData?.ok) throw new Error('Uploaded file could not be verified.');
  }

  return {
    r2Key: data.r2Key,
    fileRef: toR2Ref(data.r2Key),
    uploadSessionId: data.uploadSessionId,
    metadata: data.metadata || {},
  };
}

async function resolveFileUrl({ jobId, value, r2Key, category, purpose, publicSigning = false, signingToken = '' }) {
  const key = r2Key || keyFromR2Ref(value);
  if (!key) return value || '';

  const response = await base44.functions.invoke('requestR2ReadUrl', {
    jobId,
    fileKey: key,
    category,
    purpose,
    publicSigning,
    signingToken,
  });
  const data = response?.data || response;
  if (!data?.signedUrl) throw new Error('R2 read URL request failed.');
  return data.signedUrl;
}

export default function Signature() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
  const signingToken = getSigningToken(urlParams);
  const navigate = useNavigate();
  const [signatureData, setSignatureData] = useState(null);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      return jobs[0];
    },
    enabled: !!jobId,
  });
  const { data: currentUser = null, isLoading: isAuthLoading } = useQuery({
    queryKey: ['signature-auth'],
    queryFn: () => base44.auth.me().catch(() => null),
  });

  const usePublicSigning = Boolean(signingToken);
  const canSubmitSignature = usePublicSigning || Boolean(currentUser);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error('Missing job id');
      if (!signatureData?.startsWith('data:image/png')) throw new Error('Missing signature');
      if (!canSubmitSignature) {
        throw new Error('This signing link is missing required security information. Please request a new signing link.');
      }

      const latestJobs = await base44.entities.Job.filter({ id: jobId });
      const latestJob = latestJobs[0];
      if (!latestJob) throw new Error('Job not found');

      if (latestJob.locked || latestJob.status === 'approved') {
        return;
      }

      const blob = await (await fetch(signatureData)).blob();
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      const signatureUpload = await uploadFileToR2({
        jobId,
        file,
        category: 'signed_doc',
        purpose: 'raw_signature_image',
        publicSigning: usePublicSigning,
        signingToken,
      });
      const signatureReadUrl = await resolveFileUrl({
        jobId,
        r2Key: signatureUpload.r2Key,
        category: 'signed_doc',
        purpose: 'render_signature_image',
        publicSigning: usePublicSigning,
        signingToken,
      });
      const now = new Date().toISOString();
      const statement = buildApprovalStatement(latestJob.customer_name, latestJob.address, latestJob.price);

      let approvalRecord;
      try {
        approvalRecord = await upsertPrimaryJobApprovalRecord({
          job: latestJob,
          signatureUrl: '',
          signedAt: now,
          actorName: 'Customer',
        });
        await base44.entities.SignatureRecord.update(approvalRecord.id, {
          signature_url: '',
          signature_r2_key: signatureUpload.r2Key,
          source_work_order_r2_key: latestJob.source_work_order_r2_key || keyFromR2Ref(latestJob.source_work_order_file_url),
        });
        approvalRecord = {
          ...approvalRecord,
          signature_url: '',
          signature_r2_key: signatureUpload.r2Key,
          source_work_order_r2_key: latestJob.source_work_order_r2_key || keyFromR2Ref(latestJob.source_work_order_file_url),
        };
      } catch (recordError) {
        throw new Error('Signature was captured, but the approval record could not be saved. Please try submitting again before leaving this page.', { cause: recordError });
      }

      if (!approvalRecord?.id) {
        throw new Error('Signature was captured, but the approval document could not be linked to the approval record. Please try submitting again before leaving this page.');
      }

      let signedOutputR2Key = '';
      try {
        const signatureDocumentMode = normalizeSignatureDocumentMode(approvalRecord.signature_document_mode || latestJob.signature_document_mode);
        const usesStampedPdf = isStampUploadedPdfMode(signatureDocumentMode);

        const sourceWorkOrderUrl = usesStampedPdf
          ? await resolveFileUrl({
              jobId,
              value: approvalRecord.source_work_order_file_url,
              r2Key: approvalRecord.source_work_order_r2_key,
              category: 'contract',
              purpose: 'stamp_source_work_order',
              publicSigning: usePublicSigning,
              signingToken,
            })
          : '';

        if (usesStampedPdf && !sourceWorkOrderUrl) {
          throw new Error('A source work order PDF is required before this job can be approved.');
        }

        const documentBlob = usesStampedPdf
          ? await stampWorkOrderPdf({
              sourcePdfUrl: sourceWorkOrderUrl,
              signatureUrl: signatureReadUrl,
              signerName: approvalRecord.signer_name || latestJob.customer_name,
              signedAt: approvalRecord.signed_date || now,
              placement: approvalRecord.signature_placement,
            })
          : new Blob([renderDefaultApprovalDocument(latestJob, { ...approvalRecord, signature_url: signatureData })], { type: 'text/html;charset=utf-8' });
        const documentFileName = usesStampedPdf ? `work-authorization-${jobId}.pdf` : `work-authorization-${jobId}.html`;
        const documentFileType = usesStampedPdf ? 'application/pdf' : 'text/html';
        const documentDisplayName = usesStampedPdf ? 'Stamped Work Order PDF' : 'Customer Approval / Work Authorization';
        const documentFile = new File([documentBlob], documentFileName, { type: documentFileType });
        const outputUpload = await uploadFileToR2({
          jobId,
          file: documentFile,
          category: 'signed_doc',
          purpose: usesStampedPdf ? 'signed_stamped_document' : 'signed_approval_document',
          publicSigning: usePublicSigning,
          signingToken,
        });
        signedOutputR2Key = outputUpload.r2Key;

        await base44.entities.SignatureRecord.update(approvalRecord.id, {
          output_file_url: '',
          output_file_name: documentDisplayName,
          signed_output_file_url: '',
          output_file_r2_key: outputUpload.r2Key,
          signed_output_r2_key: outputUpload.r2Key,
          signature_document_mode: signatureDocumentMode,
        });
      } catch (documentError) {
        throw new Error('Signature was captured, but the signed approval document could not be saved. Please try submitting again before leaving this page.', { cause: documentError });
      }

      await base44.entities.Job.update(jobId, {
        signature_url: '',
        signature_r2_key: signatureUpload.r2Key,
        approval_timestamp: now,
        status: 'approved',
        locked: true,
        signature_document_mode: normalizeSignatureDocumentMode(approvalRecord.signature_document_mode || latestJob.signature_document_mode),
        signed_output_file_url: '',
        signed_output_r2_key: signedOutputR2Key,
        terms_version: TERMS_VERSION,
        approval_statement: statement,
      });
      await logAudit(jobId, 'signature_submitted', 'Customer', `Signed by ${latestJob.customer_name} · Terms ${TERMS_VERSION}`);
    },
    onSuccess: () => {
      navigate(`/confirmation?jobId=${jobId}`);
    },
    onError: (error) => {
      toast.error(getR2UploadErrorMessage(error));
    },
  });

  if (isLoading || isAuthLoading) {
    return (
      <AppLayout title="Sign to Approve">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!canSubmitSignature) {
    return (
      <AppLayout title="Sign to Approve">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-muted-foreground max-w-sm">
            This signing link is missing required security information. Please request a new signing link.
          </p>
          <Button variant="outline" onClick={() => navigate('/search')} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
          </Button>
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout title="Sign to Approve">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-muted-foreground text-sm">Job not found.</p>
          <Button variant="outline" onClick={() => navigate('/search')} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Sign to Approve">
      <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">

        <button
          onClick={() => navigate(appendSigningToken(`/approve?jobId=${jobId}`, signingToken))}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Details
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold text-foreground">Sign to Approve</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">{job.customer_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">{job.address}</p>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM d, yyyy · h:mm a')}</p>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-sm font-medium text-foreground mb-3">Your Signature</p>
            <SignatureCanvas onSignatureChange={setSignatureData} />
          </div>

          <Button
            className="w-full h-12 rounded-xl text-base font-medium"
            disabled={!signatureData || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
            ) : (
              'Submit Signature'
            )}
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
}
