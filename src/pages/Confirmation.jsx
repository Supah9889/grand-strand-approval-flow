import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Mail, Download, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import CompanyLogo from '../components/CompanyLogo';
import { toast } from 'sonner';

export default function Confirmation() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-confirmed', jobId],
    queryFn: async () => {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      return jobs[0];
    },
    enabled: !!jobId,
  });

  const handleSendEmail = async () => {
    if (!email) return;
    setSending(true);
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: 'Your Job Approval Confirmation - Grand Strand Custom Painting',
      body: `
        <h2>Approval Confirmation</h2>
        <p>Dear ${job.customer_name},</p>
        <p>Your approval has been recorded for the following job:</p>
        <ul>
          <li><strong>Address:</strong> ${job.address}</li>
          <li><strong>Description:</strong> ${job.description}</li>
          <li><strong>Total Price:</strong> $${Number(job.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</li>
          <li><strong>Approved on:</strong> ${job.approval_timestamp ? format(new Date(job.approval_timestamp), 'MMMM d, yyyy · h:mm a') : 'N/A'}</li>
        </ul>
        <p>Thank you for choosing Grand Strand Custom Painting!</p>
      `
    });
    setSending(false);
    toast.success('Confirmation sent to your email!');
    setEmail('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-inter">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
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
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 text-center space-y-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          >
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto" />
          </motion.div>

          <div>
            <h2 className="text-xl font-semibold text-foreground">Approval Recorded</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Your approval has been successfully submitted.
            </p>
          </div>

          <div className="border-t border-border pt-5 space-y-4">
            <p className="text-sm font-medium text-foreground text-left">Send a copy to your email</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl text-sm"
              />
              <Button
                onClick={handleSendEmail}
                disabled={!email || sending}
                size="icon"
                className="h-11 w-12 rounded-xl shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Button
            className="w-full h-12 rounded-xl text-base font-medium"
            onClick={() => navigate(`/review?jobId=${jobId}`)}
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}