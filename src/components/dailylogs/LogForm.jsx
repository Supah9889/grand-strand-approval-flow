import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Camera, X, Upload, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const WEATHER_OPTIONS = ['sunny','cloudy','rain','storm','windy','cold','hot','humid','other'];
const lbl = s => s.charAt(0).toUpperCase() + s.slice(1);

const EMPTY = (jobId, jobAddress, jobTitle) => ({
  job_id: jobId || '',
  job_title: jobTitle || '',
  job_address: jobAddress || '',
  log_date: format(new Date(), 'yyyy-MM-dd'),
  crew_present: '',
  work_completed: '',
  delays_issues: '',
  materials_delivered: '',
  general_notes: '',
  weather: '',
  safety_notes: '',
  follow_up_needed: false,
  follow_up_note: '',
  photos: '[]',
});

export default function LogForm({ initial, jobId, jobAddress, jobTitle, jobs = [], onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY(jobId, jobAddress, jobTitle));
  const [photos, setPhotos] = useState(() => { try { return JSON.parse(initial?.photos || '[]'); } catch { return []; } });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(prev => [...prev, file_url]);
    }
    setUploading(false);
    toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
  };

  const removePhoto = (url) => setPhotos(prev => prev.filter(p => p !== url));

  const handleSave = async () => {
    if (!form.job_id || !form.log_date || !form.work_completed) {
      toast.error('Job, date, and work completed are required');
      return;
    }
    setSaving(true);
    const selectedJob = jobs.find(j => j.id === form.job_id);
    await onSave({
      ...form,
      job_address: selectedJob?.address || form.job_address,
      job_title: selectedJob?.title || form.job_title,
      photos: JSON.stringify(photos),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Job + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Job / Project *</label>
          {jobId ? (
            <p className="text-sm font-medium text-foreground py-1">{jobAddress || jobTitle || jobId}</p>
          ) : (
            <Select value={form.job_id} onValueChange={v => set('job_id', v)}>
              <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select job" /></SelectTrigger>
              <SelectContent>
                {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title || j.id}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
          <Input type="date" value={form.log_date} onChange={e => set('log_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Weather</label>
          <Select value={form.weather || ''} onValueChange={v => set('weather', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {WEATHER_OPTIONS.map(w => <SelectItem key={w} value={w}>{lbl(w)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Crew */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Crew Present</label>
        <Input value={form.crew_present} onChange={e => set('crew_present', e.target.value)} placeholder="Names or description of who was on site" className="h-9 rounded-lg text-sm" />
      </div>

      {/* Work Completed */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Work Completed *</label>
        <Textarea value={form.work_completed} onChange={e => set('work_completed', e.target.value)} placeholder="Describe what work was done today..." className="rounded-lg text-sm min-h-24" />
      </div>

      {/* Delays */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Delays / Issues</label>
        <Textarea value={form.delays_issues} onChange={e => set('delays_issues', e.target.value)} placeholder="Any delays, problems, or issues that came up..." className="rounded-lg text-sm min-h-16" />
      </div>

      {/* Materials */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Materials Delivered</label>
        <Input value={form.materials_delivered} onChange={e => set('materials_delivered', e.target.value)} placeholder="What materials arrived today" className="h-9 rounded-lg text-sm" />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">General Notes</label>
        <Textarea value={form.general_notes} onChange={e => set('general_notes', e.target.value)} placeholder="Any other observations or notes from today..." className="rounded-lg text-sm min-h-16" />
      </div>

      {/* Photos */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Photos</label>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {photos.map(url => (
              <div key={url} className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
                <img src={url} alt="log photo" className="w-full h-full object-cover" />
                <button onClick={() => removePhoto(url)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-xl px-4 py-3 hover:border-primary/40 transition-colors">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">{uploading ? 'Uploading...' : 'Add photos'}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
        </label>
      </div>

      {/* Follow-up */}
      <div className="border border-border rounded-xl p-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.follow_up_needed} onChange={e => set('follow_up_needed', e.target.checked)} className="w-4 h-4 accent-primary" />
          <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500" /> Follow-up Needed
          </span>
        </label>
        {form.follow_up_needed && (
          <Input value={form.follow_up_note} onChange={e => set('follow_up_note', e.target.value)} placeholder="What needs follow-up?" className="h-9 rounded-lg text-sm" />
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-10 rounded-xl gap-2" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Log'}
        </Button>
      </div>
    </div>
  );
}