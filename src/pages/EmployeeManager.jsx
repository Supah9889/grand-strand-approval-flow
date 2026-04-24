import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import BottomSheetSelect from '@/components/BottomSheetSelect';
import PullToRefresh from '@/components/PullToRefresh';
import { Loader2, Plus, Users, X, Settings2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { isAdminAuthed, getInternalRole } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';
import EmployeeInviteModal from '../components/employees/EmployeeInviteModal';
import EmployeeDetailPanel from '../components/employees/EmployeeDetailPanel';
import EmployeeInviteStatus from '../components/employees/EmployeeInviteStatus';
import ApprovedEmailsManager from '../components/employees/ApprovedEmailsManager';

const COST_CODES = ['Carpentry Labor/Sub', 'Drywall Labor/Sub', 'Other Labor/Sub', 'Paint Expenses', 'Painting Labor/Sub'];
const emptyForm = { name: '', employee_code: '', email: '', phone: '', role: 'field', default_cost_code: '', notes: '', active: true };

export default function EmployeeManager() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pendingInviteEmployee, setPendingInviteEmployee] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const actor = getInternalRole() || 'Admin';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['employees'] });
    setIsRefreshing(false);
  };

  if (!isAdminAuthed()) {
    return (
      <AppLayout title="Employees">
        <div className="flex-1 flex items-center justify-center flex-col gap-3 px-4">
          <Users className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">Admin access required.</p>
          <Button variant="outline" className="rounded-xl" onClick={() => window.location.href = '/admin'}>Go to Admin</Button>
        </div>
      </AppLayout>
    );
  }

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('name'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Employee.create(data),
    onSuccess: (newEmployee) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      audit.employee.created(newEmployee.id, actor, newEmployee.name, newEmployee.role);
      setForm(emptyForm);
      setShowForm(false);
      setPendingInviteEmployee(newEmployee);
    },
  });

  const toggleActive = useOptimisticMutation({
    mutationFn: ({ id, active }) => base44.entities.Employee.update(id, { active }),
    queryKey: ['employees'],
    optimisticUpdate: (prev, { id, active }) =>
      prev.map(e => e.id === id ? { ...e, active } : e),
    onSuccess: (_, { id, active }) => {
      const emp = employees.find(e => e.id === id);
      if (emp) audit.employee.activeToggled(id, actor, emp.name, active);
    },
    onError: () => toast.error('Failed to update employee status'),
  });

  return (
    <AppLayout title="Employees">
      <PullToRefresh onRefresh={handleRefresh} isRefreshing={isRefreshing}>
        <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Employees</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{employees.filter(e => e.active).length} active</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs gap-1.5" onClick={() => setShowSettings(!showSettings)}>
              <Settings2 className="w-3.5 h-3.5" />Settings
            </Button>
            <Button className="h-9 rounded-xl text-sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-1.5" />Add
            </Button>
          </div>
        </div>

        {/* Approved Emails Settings Panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-2xl p-5 overflow-hidden">
              <ApprovedEmailsManager />
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Employee Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Employee</p>
                <button onClick={() => setShowForm(false)} aria-label="Close new employee form"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Full Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Input placeholder="Employee Code *" value={form.employee_code} onChange={e => setForm({...form, employee_code: e.target.value})} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <BottomSheetSelect value={form.role} onChange={v => setForm({...form, role: v})} label="Role" options={[
                  { label: 'Admin', value: 'admin' },
                  { label: 'Staff', value: 'staff' },
                  { label: 'Field', value: 'field' },
                ]} />
                <BottomSheetSelect value={form.default_cost_code} onChange={v => setForm({...form, default_cost_code: v})} label="Cost Code" options={[
                  { label: 'None', value: '' },
                  ...COST_CODES.map(c => ({ label: c, value: c })),
                ]} />
              </div>
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="rounded-xl text-sm min-h-14" />
              <Button className="w-full h-10 rounded-xl" disabled={!form.name || !form.employee_code || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Employee'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Employee List */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : employees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No employees yet.</p>
        ) : (
          <div className="space-y-2">
            {employees.map(emp => (
              <button key={emp.id}
                className={`w-full text-left bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all ${!emp.active ? 'opacity-50' : ''}`}
                onClick={() => setSelectedEmployee(emp)}
                aria-label={`View details for ${emp.name}, ${emp.role}, ${emp.active ? 'active' : 'inactive'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{emp.name}</p>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">#{emp.employee_code}</span>
                      <EmployeeInviteStatus employee={emp} compact />
                    </div>
                    {emp.default_cost_code && <p className="text-xs text-muted-foreground mt-0.5">{emp.default_cost_code}</p>}
                    {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                      {emp.role}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); toggleActive.mutate({ id: emp.id, active: !emp.active }); }}
                      aria-label={`${emp.active ? 'Deactivate' : 'Activate'} employee ${emp.name}`}
                      aria-pressed={emp.active}
                      className={`text-xs px-2 py-0.5 rounded-full border ${emp.active ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}
                    >
                      {emp.active ? 'Active' : 'Off'}
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>

      {/* Post-save invite modal */}
      {pendingInviteEmployee && (
        <EmployeeInviteModal
          employee={pendingInviteEmployee}
          onClose={() => { toast.success('Employee added'); setPendingInviteEmployee(null); }}
          onSent={() => setPendingInviteEmployee(null)}
        />
      )}

      {/* Employee detail slide-over */}
      {selectedEmployee && (
        <EmployeeDetailPanel
          employee={employees.find(e => e.id === selectedEmployee.id) || selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </AppLayout>
  );
}