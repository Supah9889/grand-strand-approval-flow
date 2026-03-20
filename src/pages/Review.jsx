import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, Meh, ThumbsDown, Star, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CompanyLogo from '../components/CompanyLogo';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';

const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID';

const ratings = [
  { value: 'great', label: 'Great', icon: ThumbsUp, color: 'text-primary' },
  { value: 'okay', label: 'Okay', icon: Meh, color: 'text-amber-500' },
  { value: 'not_good', label: 'Not Good', icon: ThumbsDown, color: 'text-destructive' },
];

export default function Review() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async ({ rating, feedbackText }) => {
      const data = { review_rating: rating };
      if (feedbackText) data.review_feedback = feedbackText;
      await base44.entities.Job.update(jobId, data);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    },
  });

  if (submitted) {
    return (
      <div className="min-h-screen bg-background font-inter">
        <div className="max-w-lg mx-auto px-4 py-8">
          <div className="flex flex-col items-center mb-8">
            <CompanyLogo className="h-14 w-auto mb-6" />
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 text-center space-y-4"
          >
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
            <h2 className="text-xl font-semibold text-foreground">Thank You!</h2>
            <p className="text-muted-foreground text-sm">
              We appreciate your feedback. It helps us improve.
            </p>
          </motion.div>
        </div>
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
          <h1 className="text-2xl font-semibold text-foreground">How was your experience?</h1>
          <p className="text-muted-foreground text-sm mt-1">We'd love to hear from you</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-6 space-y-6"
        >
          <div className="grid grid-cols-3 gap-3">
            {ratings.map(({ value, label, icon: Icon, color }) => (
              <button
                key={value}
                onClick={() => setSelected(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  selected === value
                    ? 'border-primary bg-secondary'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <Icon className={`w-7 h-7 ${selected === value ? color : 'text-muted-foreground'}`} />
                <span className={`text-sm font-medium ${
                  selected === value ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {label}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {selected === 'great' && (
              <motion.div
                key="great"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-foreground text-center">
                  We're so glad! Would you mind leaving us a Google review?
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    className="w-full h-12 rounded-xl text-base font-medium"
                    onClick={async () => {
                      submitMutation.mutate({ rating: 'great' });
                      if (jobId) await logAudit(jobId, 'review_link_opened', 'Customer', 'Google Review link opened');
                      window.open(GOOGLE_REVIEW_URL, '_blank');
                    }}
                    disabled={submitMutation.isPending}
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Leave a Google Review
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-sm text-muted-foreground"
                    onClick={() => submitMutation.mutate({ rating: 'great' })}
                    disabled={submitMutation.isPending}
                  >
                    Skip for now
                  </Button>
                </div>
              </motion.div>
            )}

            {(selected === 'okay' || selected === 'not_good') && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 overflow-hidden"
              >
                <p className="text-sm text-foreground">
                  We're sorry to hear that. Tell us what we could improve:
                </p>
                <Textarea
                  placeholder="Your feedback helps us get better..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="rounded-xl min-h-24 text-sm"
                />
                <Button
                  className="w-full h-12 rounded-xl text-base font-medium"
                  onClick={() => submitMutation.mutate({ rating: selected, feedbackText: feedback })}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Submit Feedback</>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}