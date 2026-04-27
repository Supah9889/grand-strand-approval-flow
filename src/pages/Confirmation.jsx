import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Mail, Loader2, ArrowRight, Home, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import AppLayout from '../components/AppLayout';
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

  useEffect(() => {
    if (job?.customer_email) setEmail(job.customer_email);
  }, [job]);

  const handleSendEmail = async () => {
    if (!email) return;
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'Your Job Approval Confirmation - Grand Strand Custom Painting',
        body: `
        <h2>Approval Confirmation</h2>
        <p>Dear ${job.customer_name},</p>
        <p>Your approval has been recorded for the following job:</p>
        <ul>
          <li><strong>Address:</strong> ${job.address}</li>
          <li><strong>Customer:</strong> ${job.customer_name}</li>
          <li><strong>Description:</strong> ${job.description}</li>
          <li><strong>Total Price:</strong> $${Number(job.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</li>
          <li><strong>Signed On:</strong> ${job.approval_timestamp ? format(new Date(job.approval_timestamp), 'MMMM d, yyyy · h:mm a') : 'N/A'}</li>
          <li><strong>Terms Version Agreed:</strong> ${job.terms_version || 'N/A'}</li>
        </ul>
        ${job.approval_statement ? `<p style="font-size:12px;color:#666;border-left:3px solid #ccc;padding-left:10px;margin-top:16px;"><em>${job.approval_statement}</em></p>` : ''}
        <p>Thank you for choosing Grand Strand Custom Painting!</p>
      `
      });
      toast.success('Confirmation sent to your email!');
      setEmail('');
    } catch {
      toast.error('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // Clean session & go home
  const goHome = () => {
    navigate('/search', { replace: true });
  };

  if (isLoading) {
    return (
      <AppLayout title="Confirmation">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Confirmation">
      <div className="max-w-lg mx-auto w-full px-4 py-6">
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

          {job && (
            <div className="bg-muted/50 rounded-xl p-4 text-left space-y-1.5">
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Customer:</span> {job.customer_name}</p>
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Address:</span> {job.address}</p>
              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Amount:</span> ${Number(job.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
          )}

          {/* Email copy */}
          <div className="border-t border-border pt-5 space-y-3 text-left">
            <p className="text-sm font-medium text-foreground">Send a copy to your email</p>
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

          {/* Navigation actions */}
          <div className="space-y-2 pt-1">
            <Button
              className="w-full h-12 rounded-xl text-base font-medium"
              onClick={() => navigate(`/review?jobId=${jobId}`)}
            >
              Continue to Review
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-xl text-sm"
                onClick={goHome}
              >
                <Home className="w-4 h-4 mr-1.5" />
                Go Home
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl text-sm"
                onClick={goHome}
              >
                <Search className="w-4 h-4 mr-1.5" />
                Back to Search
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}