import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, ShieldCheck } from 'lucide-react';
import CompanyLogo from '../CompanyLogo';
import { attemptAdminLogin } from '@/lib/adminAuth';

export default function AdminPinGate({ onAuthed }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (attemptAdminLogin(pin)) {
      onAuthed();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background font-inter flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <CompanyLogo className="h-14 w-auto mb-6" />
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Admin Access</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Enter your PIN to access the admin panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className={`h-12 rounded-xl text-center text-xl tracking-widest ${
              error ? 'border-destructive focus-visible:ring-destructive' : ''
            }`}
            maxLength={10}
            autoFocus
          />
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-destructive text-sm text-center"
            >
              Incorrect PIN. Please try again.
            </motion.p>
          )}
          <Button type="submit" className="w-full h-12 rounded-xl text-base font-medium">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Unlock Admin
          </Button>
        </form>
      </motion.div>
    </div>
  );
}