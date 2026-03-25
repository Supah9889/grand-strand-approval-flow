import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, UserCheck, Trash2, Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

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
      return base44.entities.JobAssignment.create({
        job_id: jobId,
        job_address: jobAddress,
        employee_id: emp.id,
        employee_name: emp.name,
        employee_code: emp.employee_code,
        role_on_job: selRole,
        notify_on_updates: true,
        assigned_by: actorName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-assignments', jobId] });
      setShowAdd(false);
      setSelEmployee('');
      setSelRole('crew');
      toast.success('Employee assigned to job');
    },
  });

  const removeMut = useMutation({
    mutationFn: id => base44.entities.JobAssignment.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-assignments', jobId] }),
  });

  const toggleNotify = useMutation({
    mutationFn: ({ id, val }) => base44.entities.JobAssignment.update(id, { notify_on_updates: val }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-assignments', jobId] }),
  });

  const assignedIds = assignments.map(a => a.employee_id);
  const availableEmployees = employees.filter(e => !assignedIds.includes(e.id));

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

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
        <div className="bg-secondary/40 rounded-xl p-3 space-y-2">
          <p className="text-xs font-medium text-foreground">Add Team Member</p>
          <Select value={selEmployee} onValueChange={setSelEmployee}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select employee..." /></SelectTrigger>
            <SelectContent>
              {availableEmployees.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name} — {e.employee_code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selRole} onValueChange={setSelRole}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-8 text-xs rounded-lg" onClick={() => addMut.mutate(selEmployee)} disabled={!selEmployee || addMut.isPending}>
              {addMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={() => setShowAdd(false)}>Cancel</Button>
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
              <p className="text-xs text-muted-foreground">{a.role_on_job?.replace('_', ' ')} · #{a.employee_code}</p>
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
                <button onClick={() => removeMut.mutate(a.id)} className="p-1 rounded-lg text-muted-foreground hover:text-destructive">
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