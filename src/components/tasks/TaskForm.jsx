import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Camera, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { STATUS_CONFIG, PRIORITY_CONFIG } from './TaskStatusBadge';

const TYPE_LABELS = { todo: 'To-Do', task: 'Task', punch_list: 'Punch List' };

const EMPTY = (jobId, jobAddress, jobTitle) => ({
  task_type: 'task',
  title: '',
  description: '',
  job_id: jobId || '',
  job_title: jobTitle || '',
  job_address: jobAddress || '',
  assigned_to: '',
  status: 'open',
  priority: 'normal',
  due_date: '',
  notes: '',
  photos: '[]',
});

export default function TaskForm({ initial, jobId, jobAddress, jobTitle, jobs = [], onSave, onCancel }) {
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
  };

  const handleSave = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    setSaving(true);
    const selectedJob = !jobId ? jobs.find(j => j.id === form.job_id) : null;
    await onSave({
      ...form,
      job_address: selectedJob?.address || form.job_address,
      job_title: selectedJob?.title || form.job_title,
      photos: JSON.stringify(photos),
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
          <Select value={form.task_type} onValueChange={v => set('task_type', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PRIORITY_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
        <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="What needs to be done?" className="h-9 rounded-lg text-sm" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
        <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="More detail about this item..." className="rounded-lg text-sm min-h-16" />
      </div>

      {!jobId && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Job</label>
          <Select value={form.job_id || ''} onValueChange={v => set('job_id', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select job (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>No job linked</SelectItem>
              {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned To</label>
          <Input value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder="Name" className="h-9 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Due Date</label>
          <Input type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes..." className="rounded-lg text-sm min-h-14" />
      </div>

      {/* Photos */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Photos / Attachments</label>
        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            {photos.map(url => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                <img src={url} alt="attachment" className="w-full h-full object-cover" />
                <button onClick={() => setPhotos(p => p.filter(x => x !== url))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-xl px-4 py-2.5 hover:border-primary/40 transition-colors">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Camera className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm text-muted-foreground">{uploading ? 'Uploading...' : 'Add photos'}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" className="flex-1 h-10 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-10 rounded-xl" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
}