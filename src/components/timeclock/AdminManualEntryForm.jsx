import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

const COST_CODES = ['Carpentry Labor/Sub','Drywall Labor/Sub','Other Labor/Sub','Paint Expenses','Painting Labor/Sub'];

function toISO(localDatetime) {
  if (!localDatetime) return '';
  return new Date(localDatetime).toISOString();
}

export default function AdminManualEntryForm({ jobs = [], employees = [], onSave, onCancel }) {
  const role = getInternalRole();
  const [form, setForm] = useState({
    employee_id: '',
    employee_name: '',
    employee_code: '',
    job_id: '',
    job_address: '',
    cost_code: 'Painting Labor/Sub',
    clock_in: '',
    clock_out: '',
    employee_note: '',
    admin_note: '',
    entry_source: 'admin_manual',
    manual_adjustment: true,
    status: 'clocked_out',
    created_by_name: role || 'admin',
    last_updated_by: role || 'admin',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleEmployeeSelect = (empId) => {
    const emp = employees.find(e => e.id === empId);
    set('employee_id', empId);
    if (emp) { set('employee_name', emp.name); set('employee_code', emp.employee_code || ''); }
  };

  const handleJobSelect = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    set('job_id', jobId);
    if (job) set('job_address', job.address || '');
  };

  const handleSave = async () => {
    if (!form.employee_name || !form.job_id || !form.clock_in) { toast.error('Employee, job, and clock-in time required'); return; }
    setSaving(true);
    const clockIn = toISO(form.clock_in);
    const clockOut = form.clock_out ? toISO(form.clock_out) : '';
    let duration_minutes = 0;
    if (clockIn && clockOut) {
      duration_minutes = Math.round((new Date(clockOut) - new Date(clockIn)) / 60000);
    }
    const entryDate = clockIn ? clockIn.split('T')[0] : new Date().toISOString().split('T')[0];
    await onSave({ ...form, clock_in: clockIn, clock_out: clockOut, duration_minutes, entry_date: entryDate, status: clockOut ? 'clocked_out' : 'clocked_in' });
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Employee</label>
        {employees.length > 0 ? (
          <Select value={form.employee_id} onValueChange={handleEmployeeSelect}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select employee..." /></SelectTrigger>
            <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.employee_code})</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Input value={form.employee_name} onChange={e => set('employee_name', e.target.value)} placeholder="Employee name" className="h-9 rounded-lg text-sm" />
            <Input value={form.employee_code} onChange={e => set('employee_code', e.target.value)} placeholder="Emp code" className="h-9 rounded-lg text-sm" />
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Job</label>
        <Select value={form.job_id} onValueChange={handleJobSelect}>
          <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select job..." /></SelectTrigger>
          <SelectContent>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Cost Code</label>
        <Select value={form.cost_code} onValueChange={v => set('cost_code', v)}>
          <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{COST_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Clock In *</label>
          <Input type="datetime-local" value={form.clock_in} onChange={e => set('clock_in', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Clock Out</label>
          <Input type="datetime-local" value={form.clock_out} onChange={e => set('clock_out', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Admin Note / Reason</label>
        <Textarea value={form.admin_note} onChange={e => set('admin_note', e.target.value)} placeholder="Reason for manual entry..." className="rounded-lg text-sm min-h-12" />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Entry'}
        </Button>
      </div>
    </div>
  );
}