import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { isAdminAuthed } from '@/lib/adminAuth';
import { toast } from 'sonner';

const COST_CODES = ['Carpentry Labor/Sub', 'Drywall Labor/Sub', 'Other Labor/Sub', 'Paint Expenses', 'Painting Labor/Sub'];
const emptyForm = { name: '', employee_code: '', email: '', phone: '', role: 'field', default_cost_code: '', notes: '', active: true };

export default function EmployeeManager() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setForm(emptyForm);
      setShowForm(false);
      toast.success('Employee added');
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => base44.entities.Employee.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  return (
    <AppLayout title="Employees">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Employees</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{employees.filter(e => e.active).length} active</p>
          </div>
          <Button className="h-9 rounded-xl text-sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1.5" />Add
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Employee</p>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
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
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="field">Field</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={form.default_cost_code} onValueChange={v => setForm({...form, default_cost_code: v})}>
                  <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Default Cost Code" /></SelectTrigger>
                  <SelectContent>{COST_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="rounded-xl text-sm min-h-14" />
              <Button className="w-full h-10 rounded-xl" disabled={!form.name || !form.employee_code || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Employee'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : employees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No employees yet.</p>
        ) : (
          <div className="space-y-2">
            {employees.map(emp => (
              <div key={emp.id} className={`bg-card border border-border rounded-xl p-4 ${!emp.active ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{emp.name}</p>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">#{emp.employee_code}</span>
                    </div>
                    {emp.default_cost_code && <p className="text-xs text-muted-foreground mt-0.5">{emp.default_cost_code}</p>}
                    {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                      {emp.role}
                    </span>
                    <button onClick={() => toggleActive.mutate({ id: emp.id, active: !emp.active })}
                      className={`text-xs px-2 py-0.5 rounded-full border ${emp.active ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                      {emp.active ? 'Active' : 'Off'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}