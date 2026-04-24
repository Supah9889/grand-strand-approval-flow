import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * MobileStatusIndicator: Shows sync status, connectivity, and pending actions
 */
export default function MobileStatusIndicator({
  status = 'idle', // idle, saving, saved, syncing, offline, retry_failed
  message = '',
  isOnline = true,
  pendingCount = 0,
  autoHide = true,
  hideDuration = 2000,
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoHide && ['saved'].includes(status)) {
      const timer = setTimeout(() => setVisible(false), hideDuration);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [status, autoHide, hideDuration]);

  const config = {
    idle: { icon: null, text: '', color: 'text-muted-foreground', bg: 'bg-muted/20' },
    saving: { icon: Loader2, text: 'Saving…', color: 'text-primary', bg: 'bg-primary/5', spin: true },
    saved: { icon: CheckCircle2, text: 'Saved', color: 'text-green-600', bg: 'bg-green-50' },
    syncing: { icon: Loader2, text: 'Syncing…', color: 'text-blue-600', bg: 'bg-blue-50', spin: true },
    offline: { icon: WifiOff, text: 'Offline', color: 'text-amber-600', bg: 'bg-amber-50' },
    retry_failed: { icon: AlertCircle, text: 'Retry Failed', color: 'text-red-600', bg: 'bg-red-50' },
  };

  const cfg = config[status] || config.idle;
  const Icon = cfg.icon;

  if (!visible || !Icon) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${cfg.color} ${cfg.bg} max-w-xs mx-auto`}
      >
        {Icon && (
          <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.spin ? 'animate-spin' : ''}`} />
        )}
        <span>{message || cfg.text}</span>
        {!isOnline && (
          <span className="ml-auto text-xs text-muted-foreground">No connection</span>
        )}
        {pendingCount > 0 && (
          <span className="ml-auto text-xs bg-white/30 px-1.5 py-0.5 rounded">
            {pendingCount} pending
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}