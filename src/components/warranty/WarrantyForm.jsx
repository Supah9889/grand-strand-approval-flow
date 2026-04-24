import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { WARRANTY_STATUS_CONFIG, WARRANTY_CATEGORY_LABELS } from '@/lib/warrantyHelpers';
import { getInternalRole } from '@/lib/adminAuth';

export default function WarrantyForm({ jobs = [], onSave, onCancel, prefillJobId }) {
  const role = getInternalRole();
  const [form, setForm] = useState({
    job_id: prefillJobId || '',
    job_address: '',
    customer_name: '',
    date_reported: new Date().toISOString().split('T')[0],
    title: '',
    issue_description: '',
    area_location: '',
    category: 'other',
    priority: 'normal',
    status: 'new',
    assigned_to: '',
    customer_notes: '',
    internal_notes: '',
    appointment_required: false,
    appointment_date: '',
    appointment_start_time: '',
    appointment_notes: '',
    follow_up_needed: false,
    covered_under_warranty: true,
    created_by_name: role || 'admin',
  });
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleJobSelect = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    set('job_id', jobId);
    if (job) {
      set('job_address', job.address || '');
      set('customer_name', job.customer_name || '');
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(p => [...p, file_url]);
    }
    setUploading(false);
    toast.success('Photo(s) uploaded');
  };

  const handleSave = async () => {
    if (!form.job_id) { toast.error('Linked job is required'); return; }
    if (!form.title) { toast.error('Title is required'); return; }
    setSaving(true);
    await onSave({ ...form, photos: JSON.stringify(photos) });
    setSaving(false);
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      {/* Job & Customer */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Linked Job *</label>
          <Select value={form.job_id} onValueChange={handleJobSelect}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select job..." /></SelectTrigger>
            <SelectContent>
              {jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address || j.title} {j.customer_name ? `— ${j.customer_name}` : ''}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title / Summary *</label>
          <Input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Paint peeling on south wall" className="h-9 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(WARRANTY_CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Priority</label>
          <Select value={form.priority} onValueChange={v => set('priority', v)}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['low','normal','high','urgent'].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Date Reported</label>
          <Input type="date" value={form.date_reported} onChange={e => set('date_reported', e.target.value)} className="h-9 rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned To</label>
          <Input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Staff name" className="h-9 rounded-lg text-sm" />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Area / Location</label>
          <Input value={form.area_location} onChange={e => set('area_location', e.target.value)} placeholder="e.g. Master bedroom ceiling, south exterior wall" className="h-9 rounded-lg text-sm" />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Issue Description</label>
        <Textarea value={form.issue_description} onChange={e => set('issue_description', e.target.value)} className="rounded-lg text-sm min-h-16" placeholder="Describe the warranty issue in detail..." />
      </div>

      {/* Appointment */}
      <div className="border-t border-border pt-3">
        <div className="flex items-center gap-2 mb-3">
          <input type="checkbox" id="appt" checked={form.appointment_required} onChange={e => set('appointment_required', e.target.checked)} className="rounded" />
          <label htmlFor="appt" className="text-sm text-foreground cursor-pointer">Appointment Required</label>
        </div>
        {form.appointment_required && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Appointment Date</label>
              <Input type="date" value={form.appointment_date} onChange={e => set('appointment_date', e.target.value)} className="h-9 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Start Time</label>
              <Input type="time" value={form.appointment_start_time} onChange={e => set('appointment_start_time', e.target.value)} className="h-9 rounded-lg text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Appointment Notes</label>
              <Input value={form.appointment_notes} onChange={e => set('appointment_notes', e.target.value)} className="h-9 rounded-lg text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Customer Notes</label>
          <Textarea value={form.customer_notes} onChange={e => set('customer_notes', e.target.value)} className="rounded-lg text-sm min-h-12" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Internal Notes</label>
          <Textarea value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} className="rounded-lg text-sm min-h-12" />
        </div>
      </div>

      {/* Coverage */}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="covered" checked={form.covered_under_warranty} onChange={e => set('covered_under_warranty', e.target.checked)} className="rounded" />
        <label htmlFor="covered" className="text-sm text-foreground cursor-pointer">Covered Under Warranty</label>
      </div>

      {/* Photos */}
      <div className="border-t border-border pt-3">
        <label className="block text-xs font-medium text-muted-foreground mb-2">Photos / Files</label>
        <label className={`flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <Paperclip className="w-3.5 h-3.5" />
          {uploading ? 'Uploading...' : 'Upload photos or files'}
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handlePhotoUpload} />
        </label>
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {photos.map((url, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border group">
                <img src={url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                <button onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-border pt-4 sticky bottom-0 bg-card pb-1">
        <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1 h-9 rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Request'}
        </Button>
      </div>
    </div>
  );
}