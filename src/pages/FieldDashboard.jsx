import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Clock, MapPin, CheckSquare, Camera, FileText, Send,
  Play, Square, Loader2, ChevronRight, AlertTriangle, Building2
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { format } from 'date-fns';

const todayISO = new Date().toISOString().split('T')[0];

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}

function getSessionEmployee() {
  try { return JSON.parse(sessionStorage.getItem('session_employee')); } catch { return null; }
}

const SERVICE_LINE_LABELS = {
  water_mitigation: 'Water Mitigation', mold_mitigation: 'Mold Mitigation',
  air_sample_testing: 'Air Sample Testing', reconstruction: 'Reconstruction',
  emergency_response: 'Emergency Response', interior_painting: 'Interior Painting',
  exterior_painting: 'Exterior Painting', drywall: 'Drywall', insulation: 'Insulation',
  cabinet_painting: 'Cabinet Painting', epoxy_garage_floor: 'Epoxy Floor',
};

function StatusPill({ status }) {
  const map = {
    in_progress: 'bg-blue-100 text-blue-700',
    scheduled: 'bg-green-100 text-green-700',
    waiting: 'bg-yellow-100 text-yellow-700',
    new: 'bg-muted text-muted-foreground',
    complete: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${map[status] || 'bg-muted text-muted-foreground'}`}>
      {status?.replace('_', ' ')}
    </span>
  );
}

function QuickNoteModal({ job, onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const [toNexus, setToNexus] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await onSubmit({ note, toNexus, job });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Quick Note</p>
        <p className="text-xs text-muted-foreground">{job?.address}</p>
        <textarea
          className="w-full border border-input rounded-xl p-3 text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="Enter note..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={toNexus} onChange={e => setToNexus(e.target.checked)} className="rounded" />
          <Send className="w-3.5 h-3.5 text-primary" />
          <span>Submit to Nexus for review</span>
        </label>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm font-medium text-muted-foreground">Cancel</button>
          <button onClick={handleSave} disabled={!note.trim() || saving} className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClockModal({ jobs, activeEntry, onClose, onClockIn, onClockOut }) {
  const [selectedJobId, setSelectedJobId] = useState(activeEntry?.job_id || '');
  const [costCode, setCostCode] = useState('Other Labor/Sub');
  const [saving, setSaving] = useState(false);

  const handleAction = async () => {
    setSaving(true);
    if (activeEntry) { await onClockOut(activeEntry); }
    else { await onClockIn({ jobId: selectedJobId, costCode }); }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-4">
        <p className="text-sm font-semibold">{activeEntry ? 'Clock Out' : 'Clock In'}</p>
        {!activeEntry && (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Job</label>
              <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
                className="w-full border border-input rounded-xl px-3 h-10 text-sm bg-card">
                <option value="">Select job...</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.address}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cost Code</label>
              <select value={costCode} onChange={e => setCostCode(e.target.value)}
                className="w-full border border-input rounded-xl px-3 h-10 text-sm bg-card">
                {['Painting Labor/Sub','Drywall Labor/Sub','Carpentry Labor/Sub','Other Labor/Sub','Paint Expenses'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {activeEntry && (
          <p className="text-sm text-muted-foreground">
            Currently clocked in to: <span className="font-medium text-foreground">{activeEntry.job_address}</span>
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm font-medium text-muted-foreground">Cancel</button>
          <button
            onClick={handleAction}
            disabled={!activeEntry && !selectedJobId || saving}
            className={`flex-1 h-10 rounded-xl text-sm font-semibold disabled:opacity-50 ${activeEntry ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : activeEntry ? 'Clock Out' : 'Clock In'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FieldDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const company = getActiveCompany();
  const employee = getSessionEmployee();

  const [showClockModal, setShowClockModal] = useState(false);
  const [noteJob, setNoteJob] = useState(null);

  const { data: jobs = [] } = useQuery({
    queryKey: ['field-jobs', company?.id],
    queryFn: () => company
      ? base44.entities.Job.filter({ company_id: company.id, lifecycle_status: 'in_progress' }, '-created_date', 50)
      : base44.entities.Job.list('-created_date', 50),
    enabled: true,
  });

  const { data: scheduleEvents = [] } = useQuery({
    queryKey: ['field-schedule', company?.id, todayISO],
    queryFn: async () => {
      const all = company
        ? await base44.entities.ScheduleEvent.filter({ company_id: company.id })
        : await base44.entities.ScheduleEvent.list('-start_datetime', 100);
      return all.filter(e => e.start_datetime?.startsWith(todayISO) && e.status !== 'cancelled');
    },
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['field-work-orders', company?.id],
    queryFn: () => company
      ? base44.entities.WorkOrder.filter({ company_id: company.id, status: 'assigned' }, '-created_date', 50)
      : base44.entities.WorkOrder.filter({ status: 'assigned' }, '-created_date', 50),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['field-time-entries', employee?.id],
    queryFn: () => employee
      ? base44.entities.TimeEntry.filter({ employee_id: employee.id, status: 'clocked_in' })
      : [],
    enabled: !!employee,
  });

  const activeEntry = timeEntries.find(e => e.status === 'clocked_in');

  const todayJobs = useMemo(() => {
    const scheduledJobIds = new Set(scheduleEvents.map(e => e.job_id).filter(Boolean));
    const inProgress = jobs.filter(j => j.op_status === 'in_progress');
    const scheduled = jobs.filter(j => scheduledJobIds.has(j.id) && !inProgress.find(p => p.id === j.id));
    return [...inProgress, ...scheduled].slice(0, 10);
  }, [jobs, scheduleEvents]);

  const clockInMutation = useMutation({
    mutationFn: async ({ jobId, costCode }) => {
      const job = jobs.find(j => j.id === jobId);
      return base44.entities.TimeEntry.create({
        company_id: company?.id,
        company_slug: company?.slug,
        employee_id: employee?.id || 'unknown',
        employee_name: employee?.name || 'Field User',
        job_id: jobId,
        job_address: job?.address || '',
        job_title: job?.title || '',
        cost_code: costCode,
        clock_in: new Date().toISOString(),
        entry_date: todayISO,
        status: 'clocked_in',
        approval_status: 'pending',
        entry_source: 'employee_clock',
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-time-entries'] }),
  });

  const clockOutMutation = useMutation({
    mutationFn: async (entry) => {
      const now = new Date();
      const clockIn = new Date(entry.clock_in);
      const mins = Math.round((now - clockIn) / 60000);
      return base44.entities.TimeEntry.update(entry.id, {
        clock_out: now.toISOString(),
        status: 'clocked_out',
        duration_minutes: mins,
        total_hours: parseFloat((mins / 60).toFixed(2)),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-time-entries'] }),
  });

  const saveNoteMutation = useMutation({
    mutationFn: async ({ note, toNexus, job }) => {
      await base44.entities.JobNote.create({
        job_id: job.id,
        job_address: job.address,
        content: note,
        note_type: 'field_update',
        visibility: 'internal',
        author_role: 'staff',
        author_name: employee?.name || 'Field User',
      });
      if (toNexus) {
        await base44.entities.NexusItem.create({
          company_id: company?.id || job.company_id,
          company_slug: company?.slug || job.company_slug,
          source_type: 'job_note',
          source_id: job.id,
          title: `Field Note: ${job.address}`,
          summary: note.slice(0, 200),
          raw_content: note,
          category: 'job_procedure',
          priority: 'normal',
          status: 'pending_review',
          submitted_by_name: employee?.name || 'Field User',
          linked_job_id: job.id,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['field-notes'] }),
  });

  return (
    <AppLayout title="Field">
      <div className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">

        {/* Company badge */}
        {company && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: company.color || '#3b82f6' }} />
            <span className="text-xs font-semibold text-muted-foreground">{company.name}</span>
            <button onClick={() => navigate('/company-select')} className="ml-auto text-xs text-primary hover:underline">Switch</button>
          </div>
        )}

        {/* Clock In/Out hero card */}
        <div className={`rounded-2xl p-4 flex items-center justify-between shadow-sm border ${activeEntry ? 'bg-emerald-50 border-emerald-200' : 'bg-card border-border'}`}>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Time Clock</p>
            {activeEntry ? (
              <>
                <p className="text-sm font-semibold text-emerald-700">Clocked In</p>
                <p className="text-xs text-muted-foreground">{activeEntry.job_address}</p>
                <p className="text-xs text-muted-foreground">Since {format(new Date(activeEntry.clock_in), 'h:mm a')}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not clocked in</p>
            )}
          </div>
          <button
            onClick={() => setShowClockModal(true)}
            className={`flex items-center gap-2 h-11 px-4 rounded-xl font-semibold text-sm ${activeEntry ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'}`}
          >
            {activeEntry ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {activeEntry ? 'Out' : 'In'}
          </button>
        </div>

        {/* Today's Schedule */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today's Schedule</h2>
            <button onClick={() => navigate('/calendar')} className="text-xs text-primary hover:underline">View all</button>
          </div>
          {scheduleEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">No events scheduled today</p>
          ) : (
            <div className="space-y-2">
              {scheduleEvents.slice(0, 5).map(ev => (
                <div key={ev.id} className="bg-card border border-border rounded-xl p-3 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{ev.event_type?.replace('_', ' ')}</p>
                    {ev.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{ev.location}</p>}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground shrink-0">
                    {ev.start_datetime ? format(new Date(ev.start_datetime), 'h:mm a') : 'All day'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Today's Jobs */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active Jobs</h2>
            <button onClick={() => navigate('/search')} className="text-xs text-primary hover:underline">All jobs</button>
          </div>
          {todayJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">No active jobs</p>
          ) : (
            <div className="space-y-2">
              {todayJobs.map(job => (
                <div key={job.id} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{job.address}</p>
                      <p className="text-xs text-muted-foreground">{job.customer_name}</p>
                    </div>
                    <StatusPill status={job.op_status} />
                  </div>
                  {job.service_line && (
                    <p className="text-xs text-primary font-medium mb-2">{SERVICE_LINE_LABELS[job.service_line] || job.service_line}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNoteJob(job)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      <FileText className="w-3.5 h-3.5" /> Note
                    </button>
                    <button
                      onClick={() => navigate(`/job-hub?id=${job.id}`)}
                      className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground ml-auto"
                    >
                      Open <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Work Orders */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assigned Work Orders</h2>
          </div>
          {workOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">No assigned work orders</p>
          ) : (
            <div className="space-y-2">
              {workOrders.slice(0, 5).map(wo => (
                <div key={wo.id} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{wo.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{wo.job_address}</p>
                    </div>
                    {wo.priority === 'urgent' && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                  </div>
                  {wo.due_date && (
                    <p className="text-xs text-muted-foreground mt-1">Due: {wo.due_date}</p>
                  )}
                  <button
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="mt-2 w-full h-8 rounded-lg bg-muted text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> View Checklist
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Modals */}
      {showClockModal && (
        <ClockModal
          jobs={jobs}
          activeEntry={activeEntry}
          onClose={() => setShowClockModal(false)}
          onClockIn={({ jobId, costCode }) => clockInMutation.mutateAsync({ jobId, costCode })}
          onClockOut={(entry) => clockOutMutation.mutateAsync(entry)}
        />
      )}
      {noteJob && (
        <QuickNoteModal
          job={noteJob}
          onClose={() => setNoteJob(null)}
          onSubmit={saveNoteMutation.mutateAsync}
        />
      )}
    </AppLayout>
  );
}