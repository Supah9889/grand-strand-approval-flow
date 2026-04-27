import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Pencil, Sun, Cloud, CloudRain, Wind, Thermometer, Camera, AlertCircle, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import LogForm from '../components/dailylogs/LogForm';
import PhotoLightbox from '../components/dailylogs/PhotoLightbox';
import { getInternalRole } from '@/lib/adminAuth';
import { audit } from '@/lib/audit';
import { toast } from 'sonner';

const WEATHER_ICON = { sunny: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudRain, windy: Wind, cold: Thermometer, hot: Thermometer, humid: Thermometer };
const WEATHER_COLOR = { sunny: 'text-yellow-500', cloudy: 'text-slate-400', rain: 'text-blue-500', storm: 'text-purple-600', windy: 'text-cyan-500', cold: 'text-blue-400', hot: 'text-orange-500', humid: 'text-teal-500' };

function Field({ label, value, multiline }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm text-foreground ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
    </div>
  );
}

export default function DailyLogDetail() {
  const logId = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [editing, setEditing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const { data: log, isLoading } = useQuery({
    queryKey: ['daily-log', logId],
    queryFn: async () => { const res = await base44.entities.DailyLog.filter({ id: logId }); return res[0]; },
    enabled: !!logId,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.DailyLog.update(logId, data),
    onSuccess: (_, updatedData) => {
      queryClient.invalidateQueries({ queryKey: ['daily-log', logId] });
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      const jobLabel = log?.job_address || log?.job_title || log?.job_id || 'Unknown Job';
      const logDate = log?.log_date || '';
      // If follow_up_status resolved, log that specifically; else log generic edit
      if (updatedData?.follow_up_status === 'resolved') {
        audit.dailyLog.followUpResolved(logId, role || 'Admin', jobLabel, { job_id: log?.job_id, job_address: log?.job_address });
      } else {
        audit.dailyLog.edited(logId, role || 'Admin', jobLabel, logDate, { job_id: log?.job_id, job_address: log?.job_address });
      }
      setEditing(false);
      toast.success('Log updated');
    },
  });

  const photos = (() => { try { return JSON.parse(log?.photos || '[]'); } catch { return []; } })();
  const WeatherIcon = log?.weather ? WEATHER_ICON[log.weather] : null;

  if (isLoading) return <AppLayout title="Daily Log"><div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></AppLayout>;
  if (!log) return (
    <AppLayout title="Daily Log">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-muted-foreground">Log not found.</p>
        <Button variant="outline" onClick={() => navigate('/daily-logs')} className="rounded-xl"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout title="Daily Log">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">

        <button onClick={() => navigate('/daily-logs')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Daily Logs
        </button>

        {editing ? (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Edit Daily Log</p>
            <LogForm initial={log} jobs={jobs} onSave={updateMutation.mutate} onCancel={() => setEditing(false)} />
          </div>
        ) : (
          <>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-mono text-muted-foreground">
                      {log.log_date ? format(parseISO(log.log_date), 'EEEE, MMMM d, yyyy') : ''}
                    </p>
                    {WeatherIcon && <WeatherIcon className={`w-4 h-4 ${WEATHER_COLOR[log.weather]}`} />}
                    {log.weather && <span className="text-xs text-muted-foreground capitalize">{log.weather}</span>}
                  </div>
                  <h1 className="text-base font-bold text-foreground">{log.job_address || log.job_title || 'Daily Log'}</h1>
                  {log.job_address && log.job_title && log.job_title !== log.job_address && (
                    <p className="text-sm text-muted-foreground">{log.job_title}</p>
                  )}
                  {log.created_by && <p className="text-xs text-muted-foreground mt-1">Created by {log.created_by_name || log.created_by}</p>}
                </div>
                {role === 'admin' && (
                  <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs gap-1" onClick={() => setEditing(true)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
              </div>

              {log.follow_up_needed && log.follow_up_status !== 'resolved' && (
                <div className="mt-3 flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-orange-700">Follow-Up Needed</p>
                    {log.follow_up_note && <p className="text-xs text-orange-600 mt-0.5">{log.follow_up_note}</p>}
                  </div>
                  {role === 'admin' && (
                    <button onClick={() => updateMutation.mutate({ follow_up_status: 'resolved' })}
                      className="text-xs text-orange-600 underline underline-offset-2 shrink-0">Resolve</button>
                  )}
                </div>
              )}
              {log.follow_up_status === 'resolved' && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                  <Check className="w-3.5 h-3.5" /> Follow-up resolved
                </div>
              )}
            </motion.div>

            {/* Content sections */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-5">
              {log.crew_present && (
                <div className="pb-4 border-b border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Crew Present</p>
                  <p className="text-sm text-foreground">{log.crew_present}</p>
                </div>
              )}
              <div className={log.crew_present ? '' : ''}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Work Completed</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{log.work_completed}</p>
              </div>
              {log.delays_issues && (
                <div className="pt-4 border-t border-border/60 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Delays / Issues</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{log.delays_issues}</p>
                </div>
              )}
              {log.materials_delivered && (
                <div className="pt-4 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Materials Delivered</p>
                  <p className="text-sm text-foreground">{log.materials_delivered}</p>
                </div>
              )}
              {log.general_notes && (
                <div className="pt-4 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">General Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{log.general_notes}</p>
                </div>
              )}
              {log.safety_notes && (
                <div className="pt-4 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Safety Notes</p>
                  <p className="text-sm text-foreground">{log.safety_notes}</p>
                </div>
              )}
              {log.subcontractors_present && (
                <div className="pt-4 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Subcontractors</p>
                  <p className="text-sm text-foreground">{log.subcontractors_present}</p>
                </div>
              )}
            </div>

            {/* Photos */}
            {photos.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photos ({photos.length})</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, i) => (
                    <button key={url} onClick={() => setLightboxIndex(i)}
                      className="aspect-square rounded-xl overflow-hidden bg-muted hover:opacity-90 transition-opacity">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Job link */}
            {log.job_id && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Linked Job</p>
                <button onClick={() => navigate(`/approve?jobId=${log.job_id}`)}
                  className="text-sm text-primary underline underline-offset-2 hover:opacity-80">
                  {log.job_address || log.job_title}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNav={dir => setLightboxIndex(i => (i + dir + photos.length) % photos.length)}
      />
    </AppLayout>
  );
}