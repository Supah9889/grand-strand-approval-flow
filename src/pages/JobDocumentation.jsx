import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Plus, Droplets, Wind, FlaskConical, Cpu,
  Camera, FileText, Send, Loader2, ChevronRight, Home,
  Trash2, CheckCircle2, AlertTriangle, X
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { format } from 'date-fns';
import RoomForm from '@/components/restoration/RoomForm';
import MoistureReadingForm from '@/components/restoration/MoistureReadingForm';
import DryingLogForm from '@/components/restoration/DryingLogForm';
import AirSampleForm from '@/components/restoration/AirSampleForm';

function getActiveCompany() {
  try { return JSON.parse(sessionStorage.getItem('active_company')); } catch { return null; }
}
function getSessionEmployee() {
  try { return JSON.parse(sessionStorage.getItem('session_employee')); } catch { return null; }
}

const TABS = [
  { key: 'rooms', label: 'Rooms', icon: Home },
  { key: 'moisture', label: 'Moisture', icon: Droplets },
  { key: 'drying', label: 'Drying', icon: Wind },
  { key: 'samples', label: 'Air Tests', icon: FlaskConical },
  { key: 'equipment', label: 'Equipment', icon: Cpu },
];

const RESULT_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  passed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  needs_review: 'bg-orange-100 text-orange-700',
};

function NexusSheet({ jobId, jobAddress, company, employee, sourceType, sourceId, title, onClose }) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState('job_procedure');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    await base44.entities.NexusItem.create({
      company_id: company?.id,
      company_slug: company?.slug,
      source_type: sourceType || 'job_note',
      source_id: sourceId || jobId,
      title: title || `Observation: ${jobAddress}`,
      summary: text.slice(0, 200),
      raw_content: text,
      category,
      priority: 'normal',
      status: 'pending_review',
      submitted_by_name: employee?.name || 'Technician',
      linked_job_id: jobId,
    });
    setSaving(false);
    onClose();
  };

  const CATEGORIES = ['job_procedure','safety','compliance','process_improvement','vendor_performance','cost_data','other'];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="w-full bg-card rounded-t-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Submit to Nexus</p>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-2">
          This will create a <strong>pending_review</strong> item. A human reviewer must approve it — nothing is auto-applied.
        </p>
        <div>
          <label className="text-xs text-muted-foreground">Category</label>
          <select className="w-full border border-input rounded-xl px-3 h-10 text-sm mt-1 bg-card"
            value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Observation / Note *</label>
          <textarea className="w-full border border-input rounded-xl px-3 py-2 text-sm mt-1 resize-none h-28"
            placeholder="Describe the observation, issue, or procedure improvement..."
            value={text} onChange={e => setText(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-xl border border-input text-sm text-muted-foreground">Cancel</button>
          <button onClick={submit} disabled={!text.trim() || saving}
            className="flex-1 h-10 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobDocumentation() {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const company = getActiveCompany();
  const employee = getSessionEmployee();
  const [tab, setTab] = useState('rooms');
  const [showForm, setShowForm] = useState(null); // 'room'|'moisture'|'drying'|'sample'
  const [showNexus, setShowNexus] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => base44.entities.Job.get(jobId),
    enabled: !!jobId,
  });

  const { data: rooms = [], refetch: refetchRooms } = useQuery({
    queryKey: ['rooms', jobId],
    queryFn: () => base44.entities.Room.filter({ job_id: jobId }),
    enabled: !!jobId,
  });

  const { data: readings = [], refetch: refetchReadings } = useQuery({
    queryKey: ['moisture-readings', jobId],
    queryFn: () => base44.entities.MoistureReading.filter({ job_id: jobId }, '-taken_at', 200),
    enabled: !!jobId,
  });

  const { data: dryingLogs = [], refetch: refetchDrying } = useQuery({
    queryKey: ['drying-logs', jobId],
    queryFn: () => base44.entities.DryingLog.filter({ job_id: jobId }, '-log_date', 200),
    enabled: !!jobId,
  });

  const { data: airSamples = [], refetch: refetchSamples } = useQuery({
    queryKey: ['air-samples', jobId],
    queryFn: () => base44.entities.AirSampleTest.filter({ job_id: jobId }, '-sample_date', 100),
    enabled: !!jobId,
  });

  const { data: equipment = [], refetch: refetchEquipment } = useQuery({
    queryKey: ['job-equipment', jobId],
    queryFn: () => base44.entities.RestorationEquipment.filter({ current_job_id: jobId }),
    enabled: !!jobId,
  });

  const onSaved = () => {
    setShowForm(null);
    refetchRooms(); refetchReadings(); refetchDrying(); refetchSamples(); refetchEquipment();
  };

  const FORM_PROPS = { job, company, employee, rooms, onClose: () => setShowForm(null), onSaved };

  return (
    <AppLayout title="Job Documentation">
      <div className="max-w-lg mx-auto px-4 py-4 pb-32 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-muted"><ArrowLeft className="w-4 h-4 text-muted-foreground" /></button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{job?.address || 'Loading...'}</h1>
            <p className="text-xs text-muted-foreground">{job?.customer_name}</p>
          </div>
          <button onClick={() => setShowNexus(true)}
            className="flex items-center gap-1.5 h-8 px-3 bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl hover:bg-purple-200">
            <Send className="w-3.5 h-3.5" /> Nexus
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors
                ${tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Tab content */}

        {/* ROOMS */}
        {tab === 'rooms' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{rooms.length} Rooms</p>
              <button onClick={() => setShowForm('room')}
                className="flex items-center gap-1 h-7 px-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {rooms.map(room => (
              <div key={room.id} className={`bg-card border rounded-xl p-3 cursor-pointer hover:bg-muted/20 ${selectedRoom?.id === room.id ? 'border-primary' : 'border-border'}`}
                onClick={() => setSelectedRoom(r => r?.id === room.id ? null : room)}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{room.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{room.room_type?.replace('_', ' ')} {room.floor_area ? `· ${room.floor_area}` : ''}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    room.status === 'complete' ? 'bg-emerald-100 text-emerald-700' :
                    room.status === 'clear' ? 'bg-green-100 text-green-700' :
                    room.status === 'drying' ? 'bg-blue-100 text-blue-700' :
                    'bg-muted text-muted-foreground'}`}>
                    {room.status}
                  </span>
                </div>
                {room.notes && <p className="text-xs text-muted-foreground mt-1">{room.notes}</p>}
                {selectedRoom?.id === room.id && (
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <button onClick={e => { e.stopPropagation(); setShowForm('moisture'); }}
                      className="flex items-center gap-1 h-7 px-2 bg-blue-50 text-blue-700 text-xs rounded-lg border border-blue-200">
                      <Droplets className="w-3 h-3" /> Reading
                    </button>
                    <button onClick={e => { e.stopPropagation(); setShowForm('drying'); }}
                      className="flex items-center gap-1 h-7 px-2 bg-cyan-50 text-cyan-700 text-xs rounded-lg border border-cyan-200">
                      <Wind className="w-3 h-3" /> Drying Log
                    </button>
                    <button onClick={e => { e.stopPropagation(); setShowForm('sample'); }}
                      className="flex items-center gap-1 h-7 px-2 bg-purple-50 text-purple-700 text-xs rounded-lg border border-purple-200">
                      <FlaskConical className="w-3 h-3" /> Air Sample
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* MOISTURE */}
        {tab === 'moisture' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{readings.length} Readings</p>
              <button onClick={() => setShowForm('moisture')}
                className="flex items-center gap-1 h-7 px-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {readings.map(r => (
              <div key={r.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{r.reading_value}% <span className="font-normal text-muted-foreground">({r.material})</span></p>
                  {r.is_dry && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <p className="text-xs text-muted-foreground">{r.room_name} · {r.reading_type} · {r.taken_by}</p>
                {r.taken_at && <p className="text-[11px] text-muted-foreground">{format(new Date(r.taken_at), 'MMM d, h:mm a')}</p>}
                {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* DRYING LOGS */}
        {tab === 'drying' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dryingLogs.length} Logs</p>
              <button onClick={() => setShowForm('drying')}
                className="flex items-center gap-1 h-7 px-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {dryingLogs.map(log => (
              <div key={log.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{log.log_date}</p>
                  {log.nexus_submitted && <Send className="w-3.5 h-3.5 text-purple-500" />}
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mb-1">
                  {log.temperature != null && <span>{log.temperature}°F</span>}
                  {log.relative_humidity != null && <span>{log.relative_humidity}% RH</span>}
                  {log.gpp != null && <span>{log.gpp} GPP</span>}
                </div>
                <p className="text-xs text-muted-foreground">{log.room_name} · {log.technician}</p>
                {log.equipment_running && <p className="text-xs text-muted-foreground mt-1">{log.equipment_running}</p>}
                {log.moisture_notes && <p className="text-xs text-foreground mt-1">{log.moisture_notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* AIR SAMPLES */}
        {tab === 'samples' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{airSamples.length} Tests</p>
              <button onClick={() => setShowForm('sample')}
                className="flex items-center gap-1 h-7 px-2.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {airSamples.map(s => (
              <div key={s.id} className={`bg-card border rounded-xl p-3 ${s.result_status === 'failed' ? 'border-red-200' : 'border-border'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium capitalize">{s.sample_type?.replace(/_/g, ' ')}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${RESULT_STYLES[s.result_status] || 'bg-muted text-muted-foreground'}`}>
                    {s.result_status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{s.room_name} · {s.sample_date} · {s.lab}</p>
                {s.result_summary && <p className="text-xs text-foreground mt-1">{s.result_summary}</p>}
                {s.nexus_submitted && <p className="text-xs text-purple-600 mt-1 flex items-center gap-1"><Send className="w-3 h-3" />Submitted to Nexus</p>}
              </div>
            ))}
          </div>
        )}

        {/* EQUIPMENT */}
        {tab === 'equipment' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{equipment.length} Units</p>
              <button onClick={() => navigate('/equipment')}
                className="flex items-center gap-1 h-7 px-2.5 bg-muted text-muted-foreground text-xs font-medium rounded-lg">
                Manage Equipment
              </button>
            </div>
            {equipment.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No equipment assigned to this job</p>
            ) : equipment.map(eq => (
              <div key={eq.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{eq.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{eq.equipment_type?.replace('_', ' ')} {eq.current_room_name ? `· ${eq.current_room_name}` : ''}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Deployed</span>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* Floating add button for non-rooms tabs */}
      {tab !== 'rooms' && tab !== 'equipment' && (
        <div className="fixed bottom-20 right-4 z-40">
          <button
            onClick={() => setShowForm(tab === 'moisture' ? 'moisture' : tab === 'drying' ? 'drying' : 'sample')}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Forms */}
      {showForm === 'room' && <RoomForm {...FORM_PROPS} />}
      {showForm === 'moisture' && <MoistureReadingForm {...FORM_PROPS} selectedRoom={selectedRoom} />}
      {showForm === 'drying' && <DryingLogForm {...FORM_PROPS} selectedRoom={selectedRoom} />}
      {showForm === 'sample' && <AirSampleForm {...FORM_PROPS} selectedRoom={selectedRoom} />}
      {showNexus && (
        <NexusSheet
          jobId={jobId}
          jobAddress={job?.address}
          company={company}
          employee={employee}
          onClose={() => setShowNexus(false)}
        />
      )}
    </AppLayout>
  );
}