import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { attemptOverrideLogin, loginAsEmployee } from '@/lib/adminAuth';
import { base44 } from '@/api/base44Client';
import CompanyLogo from '../components/CompanyLogo';
import { Loader2 } from 'lucide-react';

export default function AccessGate() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    // 1. Try override codes first (owner / admin / staff)
    const overrideRole = attemptOverrideLogin(trimmed);
    if (overrideRole) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // 2. Look up employee by their personal code
    setLoading(true);
    try {
      const matches = await base44.entities.Employee.filter({ employee_code: trimmed, active: true });
      const employee = matches?.[0];

      if (employee) {
        loginAsEmployee(employee);
        navigate('/dashboard', { replace: true });
        return;
      }
    } catch {
      // Fall through to error
    } finally {
      setLoading(false);
    }

    // 3. No match
    setError('Invalid access code. Please try again.');
    setShaking(true);
    setCode('');
    setTimeout(() => setShaking(false), 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <CompanyLogo className="h-16 w-auto" />
        </div>

        {/* Card */}
        <motion.div
          animate={shaking ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="bg-white border border-border rounded-2xl shadow-lg p-7 space-y-5"
        >
          <div className="text-center space-y-1">
            <h1 className="text-base font-semibold text-foreground">Enter Access Code</h1>
            <p className="text-xs text-muted-foreground">Grand Strand Custom Painting · Internal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={code}
              onChange={e => { setCode(e.target.value); setError(''); }}
              placeholder="••••"
              className="w-full h-12 text-center text-xl tracking-[0.4em] font-mono rounded-xl border border-input bg-transparent px-4 focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:tracking-normal placeholder:text-muted-foreground"
              autoComplete="off"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-destructive text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={!code || loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
            </button>
          </form>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Contact your administrator if you need access.
        </p>
      </motion.div>
    </div>
  );
}