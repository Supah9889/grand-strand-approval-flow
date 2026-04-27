import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Send, RotateCcw, CheckCircle2, Trash2, UserX, AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';
import EmployeeInviteStatus from './EmployeeInviteStatus';
import EmployeeInviteModal from './EmployeeInviteModal';
import PermissionSwitchboard from './PermissionSwitchboard';
import { toast } from 'sonner';
import { isAdmin, isOwnerOnly, getInternalRole } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';

export default function EmployeeDetailPanel({ employee, onClose }) {
  const [showInvite, setShowInvite] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // 'deactivate' | 'delete' | null
  const queryClient = useQueryClient();
  const actor = getInternalRole() || 'Admin';

  // ── Pre-flight: check for linked records before allowing hard delete ──────
  // Only runs when the delete confirmation panel is open (enabled: deleteConfirm === 'delete')
  const { data: linkedCounts, isLoading: checkingLinks } = useQuery({
    queryKey: ['employee-linked-check', employee.id],
    queryFn: async () => {
      const [timeEntries, assignments, calendarEvents] = await Promise.all([
        base44.entities.TimeEntry.filter({ employee_id: employee.id }),
        base44.entities.JobAssignment.filter({ employee_id: employee.id }),
        base44.entities.CalendarEvent.filter({ assigned_to: employee.name }),
      ]);
      return {
        timeEntries: timeEntries.length,
        assignments: assignments.length,
        calendarEvents: calendarEvents.length,
        total: timeEntries.length + assignments.length + calendarEvents.length,
      };
    },
    enabled: deleteConfirm === 'delete',
    staleTime: 0,
  });

  const hasLinkedRecords = linkedCounts && linkedCounts.total > 0;

  const deactivateMutation = useMutation({
    mutationFn: () => base44.entities.Employee.update(employee.id, { active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      audit.employee.archived(employee.id, actor, employee.name);
      setDeleteConfirm(null);
      toast.success('Employee deactivated');
      onClose();
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: () => base44.entities.Employee.delete(employee.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      audit.employee.deleted(employee.id, actor, employee.name);
      setDeleteConfirm(null);
      toast.success('Employee permanently deleted');
      onClose();
    },
    onError: () => {
      toast.error('Delete failed. Deactivate this employee instead to preserve historical records.');
      setDeleteConfirm(null);
    },
  });

  const markVerifiedMutation = useMutation({
    mutationFn: () => base44.entities.Employee.update(employee.id, {
      verification_status: 'verified',
      verification_date: new Date().toISOString(),
      invite_status: 'confirmed',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      audit.employee.inviteConfirmed(employee.id, actor, employee.name);
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

          {/* Permission Switchboard — visible to admin + owner */}
          {isAdmin() && (
            <div className="border-t border-border pt-4">
              <PermissionSwitchboard employee={employee} />
            </div>
          )}

          {/* Notes */}
          {employee.notes && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Notes</p>
              <p className="text-xs text-foreground whitespace-pre-wrap">{employee.notes}</p>
            </div>
          )}

          {/* Owner-only: Deactivate / Delete */}
          {isOwnerOnly() && (
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Owner Actions</p>

              {!deleteConfirm ? (
                <div className="flex gap-2">
                  {employee.active && (
                    <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => setDeleteConfirm('deactivate')}>
                      <UserX className="w-3.5 h-3.5 mr-1.5" />Deactivate
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-xs border-destructive/30 text-destructive hover:bg-destructive/5"
                    onClick={() => setDeleteConfirm('delete')}>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
                  </Button>
                </div>
              ) : deleteConfirm === 'deactivate' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />Deactivate {employee.name}?
                  </p>
                  <p className="text-xs text-amber-700">They will no longer be able to clock in. Their records will be preserved.</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-8 rounded-xl text-xs" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                    <Button size="sm" className="flex-1 h-8 rounded-xl text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => deactivateMutation.mutate()} disabled={deactivateMutation.isPending}>
                      {deactivateMutation.isPending ? 'Saving…' : 'Confirm Deactivate'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />Permanently delete {employee.name}?
                  </p>

                  {checkingLinks ? (
                    <div className="flex items-center gap-2 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Checking for linked records…</span>
                    </div>
                  ) : hasLinkedRecords ? (
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-amber-700">Cannot safely delete — linked records exist:</p>
                          <ul className="text-xs text-amber-700 mt-0.5 space-y-0.5">
                            {linkedCounts.timeEntries > 0 && <li>• {linkedCounts.timeEntries} time {linkedCounts.timeEntries === 1 ? 'entry' : 'entries'}</li>}
                            {linkedCounts.assignments > 0 && <li>• {linkedCounts.assignments} job {linkedCounts.assignments === 1 ? 'assignment' : 'assignments'}</li>}
                            {linkedCounts.calendarEvents > 0 && <li>• {linkedCounts.calendarEvents} calendar {linkedCounts.calendarEvents === 1 ? 'event' : 'events'}</li>}
                          </ul>
                          <p className="text-xs text-amber-700 mt-1">Deactivate instead to preserve historical records and audit integrity.</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-8 rounded-xl text-xs" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        <Button size="sm" className="flex-1 h-8 rounded-xl text-xs bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => { setDeleteConfirm('deactivate'); }}>
                          Deactivate Instead
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-destructive">No linked records found. This will permanently remove the employee record and cannot be undone.</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-8 rounded-xl text-xs" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
                        <Button variant="destructive" size="sm" className="flex-1 h-8 rounded-xl text-xs"
                          onClick={() => hardDeleteMutation.mutate()} disabled={hardDeleteMutation.isPending}>
                          {hardDeleteMutation.isPending ? 'Deleting…' : 'Delete Forever'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
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