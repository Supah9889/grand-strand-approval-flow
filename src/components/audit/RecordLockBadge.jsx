import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Lock, Unlock, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { audit } from '@/lib/audit';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

/**
 * Shows lock status on a signed/locked record and allows admin override.
 * Props:
 *   record     - the job/record object (must have .locked, .id, .address etc.)
 *   entityName - e.g. 'Job'
 *   onUnlocked - callback after unlock
 */
export default function RecordLockBadge({ record, entityName = 'Job', onUnlocked }) {
  const [showOverride, setShowOverride] = useState(false);
  const [reason, setReason] = useState('');
  const role = getInternalRole();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();

  const unlockMutation = useMutation({
    mutationFn: async () => {
      await base44.entities[entityName].update(record.id, { locked: false, status: 'pending' });
      await audit.unlock(record.id, role || 'admin', reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Record unlocked. This action has been logged.');
      setShowOverride(false);
      setReason('');
      onUnlocked?.();
    },
  });

  if (!record?.locked) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-800">Record Locked</p>
          <p className="text-xs text-amber-700">Signed on {record.approval_timestamp ? new Date(record.approval_timestamp).toLocaleDateString() : '—'}. Core fields are protected.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowOverride(v => !v)}
            className="text-xs text-amber-700 underline hover:text-amber-900 shrink-0 font-medium"
          >
            Override
          </button>
        )}
      </div>

      <AnimatePresence>
        {showOverride && isAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-xs font-semibold text-red-800">Admin Override — This action is logged</p>
              </div>
              <p className="text-xs text-red-700">Unlocking will reset this record's signature and allow editing. This cannot be undone silently — it will be recorded in the audit trail.</p>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Required: reason for override..."
                className="h-9 rounded-lg text-sm border-red-200"
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 rounded-lg h-8 text-xs" onClick={() => { setShowOverride(false); setReason(''); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 rounded-lg h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                  disabled={!reason.trim() || unlockMutation.isPending}
                  onClick={() => unlockMutation.mutate()}
                >
                  {unlockMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Unlock className="w-3.5 h-3.5 mr-1" /> Unlock Record</>}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}