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

export default function Signature() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
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

  const submitMutation = useMutation({
    mutationFn: async () => {
      const blob = await (await fetch(signatureData)).blob();
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const now = new Date().toISOString();
      const statement = buildApprovalStatement(job.customer_name, job.address, job.price);
      await base44.entities.Job.update(jobId, {
        signature_url: file_url,
        approval_timestamp: now,
        status: 'approved',
        locked: true,
        terms_version: TERMS_VERSION,
        approval_statement: statement,
      });
      await base44.entities.SignatureRecord.create({
        job_id: jobId,
        title: 'Work Authorization',
        signer_name: job.customer_name,
        signer_role: 'customer',
        status: 'signed',
        signed_date: now,
        is_primary: true,
        linked_job_approval: true,
      });
      await logAudit(jobId, 'signature_submitted', 'Customer', `Signed by ${job.customer_name} · Terms ${TERMS_VERSION}`);
    },
    onSuccess: () => {
      navigate(`/confirmation?jobId=${jobId}`);
    },
    onError: () => {
      toast.error('Submission failed. Please try again.');
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Sign to Approve">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
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
          onClick={() => navigate(`/approve?jobId=${jobId}`)}
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