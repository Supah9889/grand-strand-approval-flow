import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, User, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import CompanyLogo from '../components/CompanyLogo';
import SignatureCanvas from '../components/SignatureCanvas';
import { logAudit } from '@/lib/audit';

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
      await base44.entities.Job.update(jobId, {
        signature_url: file_url,
        approval_timestamp: now,
        status: 'approved',
        locked: true,
      });
      await logAudit(jobId, 'signature_submitted', 'Customer', `Signed by ${job.customer_name}`);
    },
    onSuccess: () => {
      navigate(`/confirmation?jobId=${jobId}`);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-inter">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center font-inter">
        <p className="text-muted-foreground">Job not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-inter">
      <div className="max-w-lg mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-8"
        >
          <CompanyLogo className="h-14 w-auto mb-6" />
          <h1 className="text-2xl font-semibold text-foreground">Sign to Approve</h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-5"
        >
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
    </div>
  );
}