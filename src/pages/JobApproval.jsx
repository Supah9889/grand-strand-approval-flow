import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, MapPin, User, FileText, DollarSign, ArrowLeft, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import TermsOfService from '../components/TermsOfService';

export default function JobApproval() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      return jobs[0];
    },
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <AppLayout title="Job Details">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!job) {
    return (
      <AppLayout title="Job Details">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-muted-foreground text-sm">Job not found.</p>
          <Button variant="outline" onClick={() => navigate('/search')} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ── LOCKED / ALREADY SIGNED ──
  if (job.locked || job.status === 'approved') {
    return (
      <AppLayout title="Job Details">
        <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">
          <button onClick={() => navigate('/search')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Search
          </button>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Signature Completed</h2>
              <p className="text-sm text-muted-foreground mt-1">This document has already been signed and locked.</p>
              {job.approval_timestamp && (
                <p className="text-xs text-muted-foreground mt-2">
                  Signed on {format(new Date(job.approval_timestamp), 'MMMM d, yyyy · h:mm a')}
                </p>
              )}
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="text-sm font-medium text-foreground">{job.customer_name}</p>
              <p className="text-xs text-muted-foreground mt-1">Address</p>
              <p className="text-sm text-foreground">{job.address}</p>
            </div>
            {job.signature_url && (
              <div className="border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-2">Signature on file</p>
                <img src={job.signature_url} alt="Signature" className="max-h-20 mx-auto" />
              </div>
            )}
            <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/search')}>
              Back to Search
            </Button>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Job Details">
      <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">

        {/* Back link */}
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Search
        </button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold text-foreground">Job Details</h2>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="text-sm font-medium text-foreground">{job.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="text-sm font-medium text-foreground">{job.customer_name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm text-foreground">{job.description}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <DollarSign className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Total Price</p>
                <p className="text-xl font-bold text-primary">
                  ${Number(job.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <p className="text-sm text-foreground">
              Please review and approve the work described above.
            </p>

            <TermsOfService />

            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={agreed}
                onCheckedChange={setAgreed}
                className="mt-0.5"
              />
              <label htmlFor="terms" className="text-sm text-foreground cursor-pointer leading-snug">
                I have read and agree to the Terms of Service
              </label>
            </div>
          </div>

          <Button
            className="w-full h-12 rounded-xl text-base font-medium"
            disabled={!agreed}
            onClick={() => navigate(`/signature?jobId=${jobId}`)}
          >
            Continue to Sign
          </Button>
        </motion.div>
      </div>
    </AppLayout>
  );
}