import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, ShieldCheck, Users, ShieldAlert } from 'lucide-react';
import CompanyLogo from '../CompanyLogo';
import { attemptAdminLogin } from '@/lib/adminAuth';

const ROLES = [
  { value: 'admin', label: 'Admin', icon: ShieldAlert, desc: 'Full access – add, edit, import, export' },
  { value: 'staff', label: 'Staff', desc: 'Search, view jobs & open signing flow', icon: Users },
];

export default function AdminPinGate({ onAuthed }) {
  const [role, setRole] = useState('staff');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (attemptAdminLogin(pin, role)) {
      onAuthed(role);
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
        className="w-full max-w-sm space-y-6"
      >
        <div className="flex flex-col items-center">
          <CompanyLogo className="h-14 w-auto mb-6" />
          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Internal Access</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Select your role and enter your PIN
          </p>
        </div>

        {/* Role picker */}
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setRole(value); setPin(''); setError(false); }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                role === value
                  ? 'border-primary bg-secondary'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              <Icon className={`w-6 h-6 ${role === value ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${role === value ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">{desc}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            inputMode="numeric"
            placeholder={`Enter ${role === 'admin' ? 'Admin' : 'Staff'} PIN`}
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
            Sign In
          </Button>
        </form>
      </motion.div>
    </div>
  );
}