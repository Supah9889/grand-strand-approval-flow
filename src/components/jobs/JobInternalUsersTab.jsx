import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, UserCheck, Trash2, Bell, BellOff, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { format } from 'date-fns';

const ROLE_OPTIONS = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'lead', label: 'Lead' },
  { value: 'crew', label: 'Crew' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'estimator', label: 'Estimator' },
  { value: 'other', label: 'Other' },
];

export default function JobInternalUsersTab({ jobId, jobAddress, isAdmin }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const [showAdd, setShowAdd] = useState(false);
  const [selEmployee, setSelEmployee] = useState('');
  const [selRole, setSelRole] = useState('crew');
  const [sendNotification, setSendNotification] = useState(true);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['job-assignments', jobId],
    queryFn: () => base44.entities.JobAssignment.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ active: true }, 'name'),
    enabled: isAdmin,
  });

  const addMut = useMutation({
    mutationFn: async (empId) => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      const now = new Date().toISOString();
      const assignment = await base44.entities.JobAssignment.create({
        job_id: jobId,
        job_address: jobAddress,
        employee_id: emp.id,
        employee_name: emp.name,
        employee_code: emp.employee_code,
        role_on_job: selRole,
        notify_on_updates: sendNotification,
        assigned_by: actorName,
        notes: sendNotification ? `Notification sent ${format(new Date(), 'MMM d, yyyy h:mm a')}` : 'Notification not sent',
      });

      // Audit log the assignment
      await audit.assignment.created(
        jobId,
        actorName || 'Admin',
        emp.name,
        jobAddress || `Job ${jobId}`,
        sendNotification,
        { job_address: jobAddress }
      );

      // Send notification email if chosen
      if (sendNotification && emp.email) {
        base44.integrations.Core.SendEmail({
          to: emp.email,
          subject: `You've been assigned to a job`,
          body: `Hi ${emp.name},\n\nYou have been assigned to the following job:\n\n${jobAddress || jobId}\nRole: ${ROLE_OPTIONS.find(r => r.value === selRole)?.label || selRole}\n\nAssigned by: ${actorName || 'Admin'}\nDate: ${format(new Date(), 'PPP')}\n\nPlease log in to the app for more details.`,
        }).catch(() => {}); // fire-and-forget, don't block save
      }

      return assignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-assignments', jobId] });
      setShowAdd(false);
      setSelEmployee('');
      setSelRole('crew');
      setSendNotification(true);
      toast.success(sendNotification ? 'Employee assigned & notified' : 'Employee assigned (no notification)');
    },
  });

  const removeMut = useMutation({
    mutationFn: async (assignment) => {
      await base44.entities.JobAssignment.delete(assignment.id);
      // Audit log removal
      await audit.assignment.removed(
        jobId,
        actorName || 'Admin',
        assignment.employee_name,
        jobAddress || `Job ${jobId}`,
        { job_address: jobAddress }
      );
    },
    onSuccess: (_, assignment) => {
      queryClient.invalidateQueries({ queryKey: ['job-assignments', jobId] });
      toast.success('Assignment removed');
    },
  });

  const toggleNotify = useMutation({
    mutationFn: ({ id, val }) => base44.entities.JobAssignment.update(id, { notify_on_updates: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-assignments', jobId] }),
  });

  const assignedIds = assignments.map(a => a.employee_id);
  const availableEmployees = employees.filter(e => !assignedIds.includes(e.id));

  if (isLoading) return (
    <div className="flex justify-center py-6">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Assigned Team</p>
          <p className="text-xs text-muted-foreground">{assignments.length} assigned to this job</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="h-8 text-xs rounded-lg gap-1" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" /> Assign
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="bg-secondary/40 rounded-xl p-3 space-y-2 border border-border">
          <p className="text-xs font-medium text-foreground">Add Team Member</p>

          {/* Employee selector */}
          <Select value={selEmployee} onValueChange={setSelEmployee}>
            <SelectTrigger className="h-9 rounded-lg text-sm">
              <SelectValue placeholder="Select employee..." />
            </SelectTrigger>
            <SelectContent>
              {availableEmployees.length === 0
                ? <SelectItem value="_none" disabled>All employees already assigned</SelectItem>
                : availableEmployees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="font-medium">{e.name}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">#{e.employee_code}</span>
                    {e.role && <span className="text-muted-foreground ml-1.5 text-xs">· {e.role}</span>}
                  </SelectItem>
                ))
              }
            </SelectContent>
          </Select>

          {/* Role selector */}
          <Select value={selRole} onValueChange={setSelRole}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Notification toggle */}
          <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-border">
            <div className="flex items-center gap-2">
              <Send className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Send notification email</span>
            </div>
            <button
              type="button"
              onClick={() => setSendNotification(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors relative ${sendNotification ? 'bg-primary' : 'bg-muted'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sendNotification ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
          {sendNotification && (
            <p className="text-[10px] text-muted-foreground px-1">
              An email will be sent to the employee's registered address (if set) with assignment details.
            </p>
          )}

          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs rounded-lg"
              onClick={() => addMut.mutate(selEmployee)}
              disabled={!selEmployee || addMut.isPending}>
              {addMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg"
              onClick={() => { setShowAdd(false); setSelEmployee(''); setSendNotification(true); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {assignments.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground text-center py-6">No team members assigned yet.</p>
      )}

      <div className="space-y-2">
        {assignments.map(a => (
          <div key={a.id} className="bg-card border border-border rounded-xl px-3 py-2.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{a.employee_name}</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p className="text-xs text-muted-foreground">{a.role_on_job?.replace('_', ' ')} · #{a.employee_code}</p>
                {a.assigned_by && <span className="text-[10px] text-muted-foreground">Assigned by {a.assigned_by}</span>}
              </div>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => toggleNotify.mutate({ id: a.id, val: !a.notify_on_updates })}
                  className={`p-1 rounded-lg transition-colors ${a.notify_on_updates ? 'text-primary' : 'text-muted-foreground'}`}
                  title={a.notify_on_updates ? 'Notifications on' : 'Notifications off'}
                >
                  {a.notify_on_updates ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => removeMut.mutate(a)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove assignment"
                  disabled={removeMut.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}