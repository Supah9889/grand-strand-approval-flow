import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, Meh, ThumbsDown, Star, Send, Loader2, CheckCircle2, Home, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { toast } from 'sonner';
import { logAudit } from '@/lib/audit';

const GOOGLE_REVIEW_URL = 'https://maps.app.goo.gl/nE6phzt8wjxLm2Aw8';

const ratings = [
  { value: 'great',    label: 'Great',    icon: ThumbsUp,   color: 'text-primary' },
  { value: 'okay',     label: 'Okay',     icon: Meh,        color: 'text-amber-500' },
  { value: 'not_good', label: 'Not Good', icon: ThumbsDown, color: 'text-destructive' },
];

export default function Review() {
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    base44.entities.Job.update(jobId, { review_prompt_shown: true });
    logAudit(jobId, 'review_link_opened', 'Customer', 'Review prompt shown to customer');
  }, [jobId]);

  const goHome = () => navigate('/search', { replace: true });

  const submitMutation = useMutation({
    mutationFn: async ({ rating, feedbackText, googleClicked }) => {
      const data = { review_rating: rating };
      if (feedbackText) data.review_feedback = feedbackText;
      if (googleClicked) data.google_review_clicked = true;
      if (rating === 'okay' || rating === 'not_good') data.internal_feedback_submitted = true;
      await base44.entities.Job.update(jobId, data);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    },
  });

  if (submitted) {
    return (
      <AppLayout title="Review">
        <div className="max-w-lg mx-auto w-full px-4 py-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 text-center space-y-5"
          >
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">Thank You!</h2>
              <p className="text-muted-foreground text-sm mt-1">
                We appreciate your feedback. It helps us improve.
              </p>
            </div>
            {/* Session reset actions */}
            <div className="border-t border-border pt-5 space-y-2">
              <p className="text-xs text-muted-foreground mb-3">Ready for the next customer?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-11 rounded-xl text-sm" onClick={goHome}>
                  <Home className="w-4 h-4 mr-1.5" />
                  Go Home
                </Button>
                <Button variant="outline" className="h-11 rounded-xl text-sm" onClick={goHome}>
                  <Search className="w-4 h-4 mr-1.5" />
                  New Search
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="How did we do?">
      <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">

        <div>
          <h1 className="text-lg font-semibold text-foreground">How was your experience?</h1>
          <p className="text-xs text-muted-foreground mt-0.5">We'd love to hear from you</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
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
                <span className={`text-sm font-medium ${selected === value ? 'text-foreground' : 'text-muted-foreground'}`}>
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
                    onClick={() => {
                      submitMutation.mutate({ rating: 'great', googleClicked: true });
                      logAudit(jobId, 'review_link_opened', 'Customer', 'Google Review link clicked');
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
                    onClick={() => submitMutation.mutate({ rating: 'great', googleClicked: false })}
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
                  onClick={() => submitMutation.mutate({ rating: selected, feedbackText: feedback, googleClicked: false })}
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

        {/* Always-visible home buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl text-sm" onClick={goHome}>
            <Home className="w-4 h-4 mr-1.5" />
            Go Home
          </Button>
          <Button variant="outline" className="h-11 rounded-xl text-sm" onClick={goHome}>
            <Search className="w-4 h-4 mr-1.5" />
            Back to Search
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}