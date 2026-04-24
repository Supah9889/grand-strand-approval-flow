import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, Loader2, Paperclip, X, Calendar, User, AlertTriangle, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { WARRANTY_STATUS_CONFIG, WARRANTY_CATEGORY_LABELS, WARRANTY_PRIORITY_CONFIG } from '@/lib/warrantyHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';
import LinkedJobPanel from '@/components/jobs/LinkedJobPanel';

export default function WarrantyDetail() {
  const itemId = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['warranty-item', itemId],
    queryFn: async () => {
      const res = await base44.entities.WarrantyItem.filter({ id: itemId });
      return res[0];
    },
    enabled: !!itemId,
  });

  useEffect(() => {
    if (item && !form) {
      setForm({ ...item });
      setPhotos(() => { try { return JSON.parse(item.photos || '[]'); } catch { return []; } });
    }
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: data => base44.entities.WarrantyItem.update(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranty-item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['warranty-items'] });
    },
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPhotos(p => [...p, file_url]);
    }
    setUploading(false);
    toast.success('Uploaded');
  };

  const handleSave = async () => {
    setSaving(true);
    await updateMutation.mutateAsync({ ...form, photos: JSON.stringify(photos) });
    setSaving(false);
    setEditing(false);
    toast.success('Warranty request updated');
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (isLoading || !form) {
    return <AppLayout title="Warranty"><div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></AppLayout>;
  }

  if (!item) {
    return (
      <AppLayout title="Warranty">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-muted-foreground">Request not found.</p>
          <Button variant="outline" onClick={() => navigate('/warranty')} className="rounded-xl"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        </div>
      </AppLayout>
    );
  }

  const cfg = WARRANTY_STATUS_CONFIG[item.status] || WARRANTY_STATUS_CONFIG.new;

  return (
    <AppLayout title="Warranty Request">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">

        <button onClick={() => navigate('/warranty')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Warranty
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                {!item.covered_under_warranty && (
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" /> Not Covered
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-foreground">{item.title}</h1>
              <p className="text-sm text-muted-foreground">{item.customer_name}</p>
              {item.job_address && <p className="text-xs text-muted-foreground">{item.job_address}</p>}
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {item.date_reported && <span>Reported {format(parseISO(item.date_reported), 'MMM d, yyyy')}</span>}
                {item.assigned_to && <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.assigned_to}</span>}
                {item.category && <span>{WARRANTY_CATEGORY_LABELS[item.category]}</span>}
              </div>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs shrink-0" onClick={() => setEditing(true)}>Edit</Button>
            )}
          </div>

          {/* Status quick update */}
          {!editing && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
              <Select value={item.status} onValueChange={v => updateMutation.mutate({ status: v })}>
                <SelectTrigger className="h-9 rounded-xl text-sm w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(WARRANTY_STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </motion.div>

        {/* Appointment banner */}
        {item.appointment_date && !editing && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-violet-800">Appointment: {format(parseISO(item.appointment_date), 'EEEE, MMMM d, yyyy')}</p>
              {item.appointment_start_time && <p className="text-xs text-violet-600">{item.appointment_start_time}{item.appointment_end_time ? ` – ${item.appointment_end_time}` : ''}</p>}
              {item.appointment_notes && <p className="text-xs text-violet-600">{item.appointment_notes}</p>}
            </div>
          </div>
        )}

        {/* Edit / View fields */}
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">

          {editing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
                  <Input value={form.title} onChange={e => set('title', e.target.value)} className="h-9 rounded-lg text-sm" />
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
                    <SelectContent>{['low','normal','high','urgent'].map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned To</label>
                  <Input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} className="h-9 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Area / Location</label>
                  <Input value={form.area_location} onChange={e => set('area_location', e.target.value)} className="h-9 rounded-lg text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Issue Description</label>
                  <Textarea value={form.issue_description} onChange={e => set('issue_description', e.target.value)} className="rounded-lg text-sm min-h-16" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Internal Notes</label>
                  <Textarea value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} className="rounded-lg text-sm min-h-12" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Resolution Summary</label>
                  <Textarea value={form.resolution_summary} onChange={e => set('resolution_summary', e.target.value)} className="rounded-lg text-sm min-h-12" placeholder="How was this issue resolved?" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Appointment Date</label>
                  <Input type="date" value={form.appointment_date} onChange={e => set('appointment_date', e.target.value)} className="h-9 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Start Time</label>
                  <Input type="time" value={form.appointment_start_time} onChange={e => set('appointment_start_time', e.target.value)} className="h-9 rounded-lg text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="covered2" checked={form.covered_under_warranty} onChange={e => set('covered_under_warranty', e.target.checked)} className="rounded" />
                <label htmlFor="covered2" className="text-sm cursor-pointer">Covered Under Warranty</label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 h-9 rounded-xl" onClick={() => { setEditing(false); setForm({ ...item }); }}>Cancel</Button>
                <Button className="flex-1 h-9 rounded-xl gap-2" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {[
                ['Issue Description', item.issue_description],
                ['Area / Location', item.area_location],
                ['Customer Notes', item.customer_notes],
                ['Internal Notes', item.internal_notes],
                ['Resolution Summary', item.resolution_summary],
                ['Coverage Notes', item.coverage_decision_notes],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{l}</p>
                  <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{v}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Linked Job */}
        {item.job_id && <LinkedJobPanel jobId={item.job_id} />}

        {/* Photos */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photos & Files</p>
            <label className={`flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Paperclip className="w-3.5 h-3.5" />{uploading ? 'Uploading...' : 'Add'}
              <input type="file" multiple accept="image/*,.pdf" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
          {photos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No photos uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => { const p = photos.filter((_, j) => j !== i); setPhotos(p); updateMutation.mutate({ photos: JSON.stringify(p) }); }}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full items-center justify-center hidden group-hover:flex"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}