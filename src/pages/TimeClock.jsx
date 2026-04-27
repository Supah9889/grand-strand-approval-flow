import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, LogIn, LogOut, User, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import AppLayout from '../components/AppLayout';
import { toast } from 'sonner';
import { runPunchGeoCheck, sendGeoAlert } from '@/lib/geolocation';

const COST_CODES = [
  'Carpentry Labor/Sub',
  'Drywall Labor/Sub',
  'Other Labor/Sub',
  'Paint Expenses',
  'Painting Labor/Sub',
];

/** Fetch (or create) GeoSettings — returns { alert_radius_miles, alert_email, geo_tracking_enabled } */
async function fetchGeoSettings() {
  try {
    const records = await base44.entities.GeoSettings.list();
    return records[0] || { alert_radius_miles: 0.25, alert_email: null, geo_tracking_enabled: true };
  } catch {
    return { alert_radius_miles: 0.25, alert_email: null, geo_tracking_enabled: true };
  }
}

export default function TimeClock() {
  const [step, setStep] = useState('code'); // code | select | clocked
  const [code, setCode] = useState('');
  const [employee, setEmployee] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [costCode, setCostCode] = useState('');
  const [note, setNote] = useState('');
  const [activeEntry, setActiveEntry] = useState(null);
  const [geoStatus, setGeoStatus] = useState(null); // null | 'capturing' | 'captured' | 'denied' | 'unavailable'
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

      // Geo capture (non-blocking)
      setGeoStatus('capturing');
      const geoSettings = await fetchGeoSettings();
      let geoPayload = {};
      if (geoSettings.geo_tracking_enabled !== false) {
        const geo = await runPunchGeoCheck(job?.address, geoSettings.alert_radius_miles, 'punch_in');
        setGeoStatus(geo.punch_in_location_status);
        geoPayload = geo;

        // Send alert if flagged
        if (geo.punch_in_flagged && geoSettings.alert_email) {
          sendGeoAlert({
            base44Client: base44,
            toEmail: geoSettings.alert_email,
            employeeName: employee.name,
            punchType: 'Clock In',
            jobAddress: job?.address,
            distanceMiles: geo.punch_in_distance_miles,
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        }
      }

      return base44.entities.TimeEntry.create({
        employee_id: employee.id,
        employee_name: employee.name,
        employee_code: employee.employee_code,
        job_id: selectedJob,
        job_address: job?.address || '',
        job_title: job?.title || '',
        cost_code: costCode,
        clock_in: new Date().toISOString(),
        entry_date: new Date().toISOString().split('T')[0],
        employee_note: note,
        note,
        entry_source: 'employee_clock',
        status: 'clocked_in',
        created_by_name: employee.name,
        geo_flagged: geoPayload.punch_in_flagged || false,
        ...geoPayload,
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

      // Geo capture (non-blocking)
      setGeoStatus('capturing');
      const geoSettings = await fetchGeoSettings();
      let geoPayload = {};
      if (geoSettings.geo_tracking_enabled !== false) {
        const geo = await runPunchGeoCheck(activeEntry.job_address, geoSettings.alert_radius_miles, 'punch_out');
        setGeoStatus(geo.punch_out_location_status);
        geoPayload = geo;

        if (geo.punch_out_flagged && geoSettings.alert_email) {
          sendGeoAlert({
            base44Client: base44,
            toEmail: geoSettings.alert_email,
            employeeName: employee?.name || activeEntry.employee_name,
            punchType: 'Clock Out',
            jobAddress: activeEntry.job_address,
            distanceMiles: geo.punch_out_distance_miles,
            timestamp: now.toISOString(),
          }).catch(() => {});
        }
      }

      const wasAlreadyFlagged = activeEntry.geo_flagged;
      return base44.entities.TimeEntry.update(activeEntry.id, {
        clock_out: now.toISOString(),
        duration_minutes: mins,
        status: 'clocked_out',
        employee_note: note || activeEntry.employee_note || activeEntry.note,
        note: note || activeEntry.note,
        last_updated_by: employee?.name || activeEntry.employee_name,
        geo_flagged: wasAlreadyFlagged || geoPayload.punch_out_flagged || false,
        ...geoPayload,
      });
    },
    onSuccess: () => {
      toast.success('Clocked out successfully');
      setStep('code');
      setCode('');
      setEmployee(null);
      setActiveEntry(null);
      setNote('');
      setGeoStatus(null);
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
    setGeoStatus(null);
  };

  const isBusy = clockInMutation.isPending || clockOutMutation.isPending;

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

        {/* Geo status indicator — shown while capturing or after result */}
        <AnimatePresence>
          {geoStatus && (
            <motion.div key={geoStatus} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className={`rounded-xl px-3 py-2 text-xs flex items-center gap-2 ${
                geoStatus === 'capturing'  ? 'bg-primary/5 text-primary border border-primary/20' :
                geoStatus === 'captured'   ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                geoStatus === 'denied'     ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                             'bg-muted text-muted-foreground border border-border'
              }`}>
              {geoStatus === 'capturing'  ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> :
               geoStatus === 'captured'   ? <MapPin className="w-3.5 h-3.5 shrink-0" /> :
               geoStatus === 'denied'     ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> :
                                            <MapPin className="w-3.5 h-3.5 shrink-0" />}
              {geoStatus === 'capturing'  ? 'Capturing location…' :
               geoStatus === 'captured'   ? 'Location captured' :
               geoStatus === 'denied'     ? 'Location permission denied — punch recorded without location' :
                                            'Location unavailable — punch recorded without location'}
            </motion.div>
          )}
        </AnimatePresence>

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
                disabled={!selectedJob || !costCode || isBusy}
                onClick={() => clockInMutation.mutate()}
              >
                {isBusy
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
                {/* Show clock-in geo status if captured */}
                {activeEntry.punch_in_location_status && (
                  <p className={`text-xs pl-5 ${
                    activeEntry.punch_in_location_status === 'captured' ? 'text-emerald-600' :
                    activeEntry.punch_in_location_status === 'denied'   ? 'text-amber-600' :
                    'text-muted-foreground'
                  }`}>
                    Clock-in location: {activeEntry.punch_in_location_status}
                    {activeEntry.punch_in_distance_miles != null ? ` · ${activeEntry.punch_in_distance_miles} mi from job` : ''}
                    {activeEntry.punch_in_flagged ? ' ⚠️' : ''}
                  </p>
                )}
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
                disabled={isBusy}
                onClick={() => clockOutMutation.mutate()}
              >
                {isBusy
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