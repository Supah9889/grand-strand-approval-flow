import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function AccountDeletionDialog({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: warning, 2: confirmation
  const [email, setEmail] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      base44.auth.me().then(user => {
        setCurrentUserEmail(user.email);
      });
      setStep(1);
      setEmail('');
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (email !== currentUserEmail) {
      toast.error('Email does not match');
      return;
    }

    setIsDeleting(true);
    try {
      await base44.auth.deleteAccount();
      toast.success('Account deleted');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4"
          >
            <div className="bg-card rounded-2xl w-full sm:max-w-sm p-6 space-y-4">
              {step === 1 ? (
                <>
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Delete Account</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        This action cannot be undone. All your data will be permanently removed.
                      </p>
                    </div>
                  </div>

                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-destructive">What will be deleted:</p>
                    <ul className="text-xs text-destructive/80 space-y-1 ml-4">
                      <li>• All account data and records</li>
                      <li>• Jobs, invoices, and financial records</li>
                      <li>• Time entries and logs</li>
                      <li>• All uploaded documents</li>
                    </ul>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-11 rounded-xl"
                      onClick={onClose}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 h-11 rounded-xl"
                      onClick={() => setStep(2)}
                    >
                      Continue
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold text-foreground">Confirm Deletion</h3>
                  <p className="text-sm text-muted-foreground">
                    Type your email address to confirm account deletion:
                  </p>

                  <Input
                    type="email"
                    placeholder={currentUserEmail}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 rounded-xl"
                    disabled={isDeleting}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-11 rounded-xl"
                      onClick={() => setStep(1)}
                      disabled={isDeleting}
                    >
                      Back
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1 h-11 rounded-xl"
                      onClick={handleDelete}
                      disabled={email !== currentUserEmail || isDeleting}
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Account'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}