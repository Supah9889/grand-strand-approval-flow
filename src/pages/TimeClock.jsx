import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, LogIn, LogOut, User, MapPin, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import AppLayout from '../components/AppLayout';
import { toast } from 'sonner';

const COST_CODES = [
  'Carpentry Labor/Sub',
  'Drywall Labor/Sub',
  'Other Labor/Sub',
  'Paint Expenses',
  'Painting Labor/Sub',
];

export default function TimeClock() {
  const [step, setStep] = useState('code'); // code | select | clocked
  const [code, setCode] = useState('');
  const [employee, setEmployee] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [costCode, setCostCode] = useState('');
  const [note, setNote] = useState('');
  const [activeEntry, setActiveEntry] = useState(null);
  const queryClient = useQueryClient();

  const { data: jobs = [] } = useQuery({
    queryKey: ['clock-jobs'],
    queryFn: () => base44.entities.Job.filter({ status: 'pending' }),
  });

  const allJobs = useQuery({
    queryKey: ['clock-all-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 100),
  });

  const lookupMutation = useMutation({
    mutationFn: async (empCode) => {
      const results = await base44.entities.Employee.filter({ employee_code: empCode, active: true });
      if (!results.length) throw new Error('Employee not found');
      return results[0];
    },
    onSuccess: async (emp) => {
      setEmployee(emp);
      if (emp.default_cost_code) setCostCode(emp.default_cost_code);
      // Check if already clocked in
      const open = await base44.entities.TimeEntry.filter({ employee_id: emp.id, status: 'clocked_in' });
      if (open.length) {
        setActiveEntry(open[0]);
        setStep('clocked');
      } else {
        setStep('select');
      }
    },
    onError: () => toast.error('Employee code not found. Please check and try again.'),
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      const job = (allJobs.data || []).find(j => j.id === selectedJob);
      return base44.entities.TimeEntry.create({
        employee_id: employee.id,
        employee_name: employee.name,
        employee_code: employee.employee_code,
        job_id: selectedJob,
        job_address: job?.address || '',
        cost_code: costCode,
        clock_in: new Date().toISOString(),
        note,
        status: 'clocked_in',
      });
    },
    onSuccess: (entry) => {
      setActiveEntry(entry);
      setStep('clocked');
      toast.success(`Clocked in — ${format(new Date(), 'h:mm a')}`);
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const inTime = new Date(activeEntry.clock_in);
      const mins = Math.round((now - inTime) / 60000);
      return base44.entities.TimeEntry.update(activeEntry.id, {
        clock_out: now.toISOString(),
        duration_minutes: mins,
        status: 'clocked_out',
        note: note || activeEntry.note,
      });
    },
    onSuccess: () => {
      toast.success('Clocked out successfully');
      setStep('code');
      setCode('');
      setEmployee(null);
      setActiveEntry(null);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });

  const reset = () => {
    setStep('code');
    setCode('');
    setEmployee(null);
    setActiveEntry(null);
    setNote('');
    setSelectedJob(null);
  };

  return (
    <AppLayout title="Time Clock">
      <div className="max-w-sm mx-auto w-full px-4 py-8 space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
            <Clock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Employee Time Clock</h1>
          <p className="text-xs text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d · h:mm a')}</p>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Enter Code */}
          {step === 'code' && (
            <motion.div key="code" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <p className="text-sm font-medium text-foreground">Enter your employee code</p>
              <Input
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Employee Code"
                className="h-12 rounded-xl text-center text-lg tracking-widest"
                onKeyDown={e => e.key === 'Enter' && code && lookupMutation.mutate(code)}
                autoFocus
              />
              <Button
                className="w-full h-12 rounded-xl"
                disabled={!code || lookupMutation.isPending}
                onClick={() => lookupMutation.mutate(code)}
              >
                {lookupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
              </Button>
            </motion.div>
          )}

          {/* STEP 2: Select Job & Clock In */}
          {step === 'select' && employee && (
            <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <User className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">{employee.name}</p>
              </div>

              <div className="space-y-3">
                <Select value={selectedJob} onValueChange={setSelectedJob}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Select job / address" />
                  </SelectTrigger>
                  <SelectContent>
                    {(allJobs.data || []).map(j => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.address} {j.customer_name ? `· ${j.customer_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={costCode} onValueChange={setCostCode}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Select cost code" />
                  </SelectTrigger>
                  <SelectContent>
                    {COST_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Textarea
                  placeholder="Optional note (reason, condition, etc.)"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="rounded-xl text-sm min-h-16"
                />
              </div>

              <Button
                className="w-full h-12 rounded-xl"
                disabled={!selectedJob || !costCode || clockInMutation.isPending}
                onClick={() => clockInMutation.mutate()}
              >
                {clockInMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><LogIn className="w-4 h-4 mr-2" /> Clock In</>}
              </Button>
              <button onClick={reset} className="w-full text-xs text-muted-foreground underline">Back</button>
            </motion.div>
          )}

          {/* STEP 3: Already Clocked In */}
          {step === 'clocked' && activeEntry && (
            <motion.div key="clocked" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <div className="text-center space-y-1">
                <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
                <p className="font-semibold text-foreground">{employee?.name || activeEntry.employee_name}</p>
                <p className="text-xs text-muted-foreground">Clocked in since {format(new Date(activeEntry.clock_in), 'h:mm a')}</p>
              </div>

              <div className="bg-secondary/50 rounded-xl p-3 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-foreground truncate">{activeEntry.job_address}</span>
                </div>
                <p className="text-muted-foreground text-xs pl-5">{activeEntry.cost_code}</p>
              </div>

              <Textarea
                placeholder="Add clock-out note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="rounded-xl text-sm min-h-16"
              />

              <Button
                variant="destructive"
                className="w-full h-12 rounded-xl"
                disabled={clockOutMutation.isPending}
                onClick={() => clockOutMutation.mutate()}
              >
                {clockOutMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><LogOut className="w-4 h-4 mr-2" /> Clock Out</>}
              </Button>
              <button onClick={reset} className="w-full text-xs text-muted-foreground underline">Switch Employee</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}