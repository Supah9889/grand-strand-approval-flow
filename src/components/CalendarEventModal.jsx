import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { X, Loader2, Search, ChevronDown, Clock, UserPlus, Send, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { BLOCK_PRESETS, EVENT_TYPE_CONFIG, EVENT_STATUS_CONFIG } from '@/lib/calendarHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { format } from 'date-fns';

const empty = {
  title: '', job_id: '', job_address: '', color: '',
  start_date: '', start_time: '', end_time: '',
  assigned_to: '', notes: '', internal_notes: '',
  status: 'scheduled', event_type: 'job_visit', visibility: 'internal',
};

// Small inline employee search dropdown
function EmployeeSearch({ employees, selectedId, onSelect }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!q) return employees.slice(0, 15);
    return employees.filter(e =>
      e.name.toLowerCase().includes(q.toLowerCase()) ||
      (e.employee_code || '').toLowerCase().includes(q.toLowerCase())
    ).slice(0, 15);
  }, [employees, q]);

  const selected = employees.find(e => e.id === selectedId);

  const choose = (emp) => {
    onSelect(emp);
    setQ(emp.name);
    setOpen(false);
  };

  const clear = () => { onSelect(null); setQ(''); };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={selected && !open ? selected.name : q}
          onChange={e => { setQ(e.target.value); setOpen(true); if (!e.target.value) onSelect(null); }}
          onFocus={() => { setOpen(true); if (selected) setQ(''); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search employees..."
          className="w-full h-10 pl-8 pr-8 rounded-xl border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {(selected || q) && (
          <button type="button" onMouseDown={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
          {filtered.length === 0
            ? <p className="px-3 py-2 text-xs text-muted-foreground">No employees found</p>
            : filtered.map(e => (
              <button key={e.id} type="button" onMouseDown={() => choose(e)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-medium">{e.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">#{e.employee_code}</span>
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

export default function CalendarEventModal({ open, onClose, jobs = [], prefilledDate = '' }) {
  const [step, setStep] = useState('job');
  const [jobSearch, setJobSearch] = useState('');
  const [form, setForm] = useState(empty);
  const [hourlyMode, setHourlyMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [assignedEmployee, setAssignedEmployee] = useState(null);
  const [sendNotification, setSendNotification] = useState(true);
  const queryClient = useQueryClient();
  const role = getInternalRole();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ active: true }, 'name'),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setStep('job'); setJobSearch(''); setSelectedPreset(null); setHourlyMode(false);
      setForm({ ...empty, start_date: prefilledDate || '' });
      setAssignedEmployee(null);
      setSendNotification(true);
    }
  }, [open, prefilledDate]);

  const filteredJobs = useMemo(() => {
    const q = jobSearch.toLowerCase();
    if (!q) return jobs;
    return jobs.filter(j =>
      (j.title || '').toLowerCase().includes(q) ||
      (j.address || '').toLowerCase().includes(q) ||
      (j.customer_name || '').toLowerCase().includes(q)
    );
  }, [jobs, jobSearch]);

  const selectJob = (job) => {
    setForm(f => ({ ...f, job_id: job.id, job_address: job.address, job_title: job.title || '', color: job.color || '#2563eb', title: f.title || job.title || job.address || '' }));
    setStep('details');
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      let startDate = data.start_date;
      if (data.start_time) startDate = `${data.start_date}T${data.start_time}`;
      let endDate = data.start_date;
      if (data.end_time) endDate = `${data.start_date}T${data.end_time}`;

      const event = await base44.entities.CalendarEvent.create({
        title: data.title,
        event_type: data.event_type,
        job_id: data.job_id,
        job_address: data.job_address,
        job_title: data.job_title,
        start_date: startDate,
        end_date: endDate || startDate,
        // Store structured assignment: employee ID + name
        assigned_to: assignedEmployee
          ? `${assignedEmployee.name} (${assignedEmployee.employee_code})`
          : data.assigned_to || '',
        notes: data.notes,
        internal_notes: data.internal_notes,
        status: data.status,
        visibility: data.visibility,
        color: data.color,
        all_day: !data.start_time,
        created_by_name: role || 'admin',
      });

      // Audit log event assignment
      if (assignedEmployee) {
        await audit.assignment.eventCreated(
          event.id,
          role || 'Admin',
          assignedEmployee.name,
          data.title,
          sendNotification,
          { job_id: data.job_id, job_address: data.job_address }
        );

        // Send notification if chosen
        if (sendNotification && assignedEmployee.email) {
          base44.integrations.Core.SendEmail({
            to: assignedEmployee.email,
            subject: `You've been assigned to an event`,
            body: `Hi ${assignedEmployee.name},\n\nYou have been assigned to the following event:\n\n"${data.title}"\nDate: ${data.start_date}${data.start_time ? ' at ' + data.start_time : ''}\nJob: ${data.job_address || 'N/A'}\n\nAssigned by: ${role || 'Admin'}\n\nPlease log in for details.`,
          }).catch(() => {});
        }
      }

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success(assignedEmployee && sendNotification ? 'Event saved & employee notified' : 'Event saved');
      handleClose();
    },
  });

  const handleClose = () => {
    setForm(empty); setStep('job'); setJobSearch('');
    setHourlyMode(false); setSelectedPreset(null);
    setAssignedEmployee(null); setSendNotification(true);
    onClose();
  };
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="cem-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
          <motion.div key="cem-modal" initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-y-auto max-h-[90vh]">

              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  {step === 'details' && (
                    <button onClick={() => setStep('job')} className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                      <ChevronDown className="w-4 h-4 rotate-90" />
                    </button>
                  )}
                  {form.color && step === 'details' && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: form.color }} />}
                  <p className="text-sm font-semibold text-foreground">{step === 'job' ? 'Select a Job' : 'Event Details'}</p>
                </div>
                <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {step === 'job' && (
                <div className="px-5 py-4 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search jobs..." value={jobSearch} onChange={e => setJobSearch(e.target.value)} className="pl-9 h-10 rounded-xl text-sm" autoFocus />
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {filteredJobs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">No jobs found.</p>}
                    {filteredJobs.map(job => (
                      <button key={job.id} onClick={() => selectJob(job)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: job.color || '#2563eb' }} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{job.title || job.address}</p>
                          {job.title && <p className="text-xs text-muted-foreground truncate">{job.address}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setStep('details')} className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors">
                    Skip — create event without a job
                  </button>
                </div>
              )}

              {step === 'details' && (
                <div className="px-5 py-4 space-y-3">
                  {form.job_address && (
                    <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: form.color || '#2563eb' }} />
                      <p className="text-xs text-muted-foreground truncate">{form.job_address}</p>
                    </div>
                  )}

                  <Input placeholder="Event Title *" value={form.title} onChange={e => set('title', e.target.value)} className="h-10 rounded-xl text-sm" autoFocus />

                  <Select value={form.event_type} onValueChange={v => set('event_type', v)}>
                    <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(EVENT_TYPE_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.icon} {c.label}</SelectItem>)}</SelectContent>
                  </Select>

                  <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className="h-10 rounded-xl text-sm" />

                  {/* Time toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Exact times</span></div>
                    <button type="button" onClick={() => { setHourlyMode(v => !v); setSelectedPreset(null); }}
                      className={`w-9 h-5 rounded-full transition-colors relative ${hourlyMode ? 'bg-primary' : 'bg-muted'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hourlyMode ? 'left-[18px]' : 'left-0.5'}`} />
                    </button>
                  </div>

                  {!hourlyMode && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {BLOCK_PRESETS.map((preset, idx) => (
                        <button key={idx} type="button" onClick={() => { setSelectedPreset(idx); set('start_time', preset.start); set('end_time', preset.end); }}
                          className={`text-xs px-2 py-2 rounded-lg border transition-colors text-center ${selectedPreset === idx ? 'border-primary bg-secondary text-primary font-medium' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {hourlyMode && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><p className="text-xs text-muted-foreground mb-1">Start</p><Input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} className="h-10 rounded-xl text-sm" /></div>
                      <div><p className="text-xs text-muted-foreground mb-1">End</p><Input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} className="h-10 rounded-xl text-sm" /></div>
                    </div>
                  )}

                  {/* ── Structured employee assignment ── */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-xs font-medium text-muted-foreground">Assign Employee</p>
                    </div>
                    <EmployeeSearch
                      employees={employees}
                      selectedId={assignedEmployee?.id || ''}
                      onSelect={setAssignedEmployee}
                    />

                    {/* Notification toggle — only shown when an employee is selected */}
                    {assignedEmployee && (
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-border">
                        <div className="flex items-center gap-2">
                          <Send className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">Send notification</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSendNotification(v => !v)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${sendNotification ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${sendNotification ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select value={form.status} onValueChange={v => set('status', v)}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(EVENT_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={form.visibility} onValueChange={v => set('visibility', v)}>
                      <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal Only</SelectItem>
                        <SelectItem value="client">Client Visible</SelectItem>
                        <SelectItem value="vendor">Vendor Visible</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea placeholder="Notes (client-visible if shared)" value={form.notes} onChange={e => set('notes', e.target.value)} className="rounded-xl text-sm min-h-12" />
                  <Textarea placeholder="Internal notes (never shared)" value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} className="rounded-xl text-sm min-h-10" />

                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" className="flex-1 h-10 rounded-xl" onClick={handleClose}>Cancel</Button>
                    <Button className="flex-1 h-10 rounded-xl" style={form.color ? { backgroundColor: form.color, borderColor: form.color } : {}}
                      disabled={!form.title || !form.start_date || createMutation.isPending}
                      onClick={() => createMutation.mutate(form)}>
                      {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Event'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}