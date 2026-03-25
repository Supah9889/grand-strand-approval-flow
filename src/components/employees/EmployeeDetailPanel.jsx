import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Send, RotateCcw, CheckCircle2 } from 'lucide-react';
import EmployeeInviteStatus from './EmployeeInviteStatus';
import EmployeeInviteModal from './EmployeeInviteModal';
import PermissionSwitchboard from './PermissionSwitchboard';
import { toast } from 'sonner';
import { isAdmin } from '@/lib/adminAuth';

export default function EmployeeDetailPanel({ employee, onClose }) {
  const [showInvite, setShowInvite] = useState(false);
  const queryClient = useQueryClient();

  const markVerifiedMutation = useMutation({
    mutationFn: () => base44.entities.Employee.update(employee.id, {
      verification_status: 'verified',
      verification_date: new Date().toISOString(),
      invite_status: 'confirmed',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee marked as verified');
    },
  });

  const inviteStatus = employee.invite_status || 'not_sent';
  const hasBeenInvited = inviteStatus !== 'not_sent';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">{employee.name}</p>
            <p className="text-xs text-muted-foreground">#{employee.employee_code}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Basic info */}
          <div className="space-y-1.5 text-sm">
            {employee.email && <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{employee.email}</span></div>}
            {employee.phone && <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span className="font-medium">{employee.phone}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium capitalize">{employee.role}</span></div>
            {employee.default_cost_code && <div className="flex justify-between"><span className="text-muted-foreground">Cost Code</span><span className="font-medium text-xs">{employee.default_cost_code}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
              <span className={`text-xs font-medium ${employee.active ? 'text-emerald-600' : 'text-slate-400'}`}>{employee.active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          {/* Invite / verification section */}
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Invite & Verification</p>
            <EmployeeInviteStatus employee={employee} />

            {/* Actions */}
            <div className="space-y-2 pt-1">
              {!hasBeenInvited ? (
                <Button className="w-full h-9 rounded-xl text-sm" onClick={() => setShowInvite(true)}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />Send Join Invite
                </Button>
              ) : (
                <Button variant="outline" className="w-full h-9 rounded-xl text-sm" onClick={() => setShowInvite(true)}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Resend Invite
                </Button>
              )}

              {inviteStatus === 'pending_confirmation' && (
                <Button variant="ghost" size="sm" className="w-full h-8 rounded-xl text-xs text-muted-foreground"
                  onClick={() => markVerifiedMutation.mutate()} disabled={markVerifiedMutation.isPending}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Mark as Manually Verified
                </Button>
              )}
            </div>
          </div>

          {/* Notes */}
          {employee.notes && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Notes</p>
              <p className="text-xs text-foreground whitespace-pre-wrap">{employee.notes}</p>
            </div>
          )}
        </div>
      </div>

      {showInvite && (
        <EmployeeInviteModal
          employee={employee}
          onClose={() => setShowInvite(false)}
          onSent={() => setShowInvite(false)}
        />
      )}
    </>
  );
}