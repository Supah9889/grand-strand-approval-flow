import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { StickyNote, Loader2, X, Paperclip } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { getInternalRole, isAdmin as checkAdmin } from '@/lib/adminAuth';
import { NOTE_TYPE_OPTIONS } from '@/lib/timelineHelpers';

export default function JobAddNoteSheet({ job, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const isAdmin = checkAdmin();
  const fileInputRef = useRef(null);
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const saveMut = useMutation({
    mutationFn: async () => {
      let file_url = null;
      let file_name = null;
      if (file) {
        setUploading(true);
        const res = await base44.integrations.Core.UploadFile({ file });
        file_url = res.file_url;
        file_name = file.name;
        setUploading(false);
      }
      return base44.entities.JobNote.create({
        job_id: job.id,
        job_address: job.address,
        job_title: job.title || job.address,
        content,
        note_type: noteType,
        author_role: isAdmin ? 'admin' : 'staff',
        author_name: actorName || null,
        file_url,
        file_name,
        read: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-tl-notes', job.id] });
      queryClient.invalidateQueries({ queryKey: ['hub-notes', job.id] });
      toast.success('Note added');
      setContent('');
      setNoteType('general');
      setFile(null);
      onSuccess?.();
      onClose?.();
    },
    onError: () => { setUploading(false); toast.error('Failed to save note'); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-foreground">Add Note</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">{job.address}</p>

        {/* Type */}
        <Select value={noteType} onValueChange={setNoteType}>
          <SelectTrigger className="h-9 rounded-xl text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NOTE_TYPE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Content */}
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write a note — calls, texts, field updates, access info, homeowner contact..."
          className="rounded-xl text-sm min-h-24 resize-none"
          autoFocus
        />

        {/* File attach */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5" />
            {file ? file.name : 'Attach file (optional)'}
          </button>
          {file && (
            <button onClick={() => setFile(null)} className="text-xs text-destructive hover:underline">Remove</button>
          )}
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || uploading || !content.trim()}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {(saveMut.isPending || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
            Save Note
          </button>
          <button onClick={onClose} className="text-sm text-muted-foreground px-4 py-2.5 rounded-xl hover:bg-muted transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}