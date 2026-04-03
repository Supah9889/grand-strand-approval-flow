import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { StickyNote, Loader2, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { getInternalRole, isAdmin as checkAdmin } from '@/lib/adminAuth';

export default function JobAddNoteSheet({ job, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const isAdmin = checkAdmin();
  const [content, setContent] = useState('');

  const saveMut = useMutation({
    mutationFn: () => base44.entities.JobNote.create({
      job_id: job.id,
      job_address: job.address,
      job_title: job.title || job.address,
      content,
      author_role: isAdmin ? 'admin' : 'staff',
      read: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-tl-notes', job.id] });
      queryClient.invalidateQueries({ queryKey: ['hub-notes', job.id] });
      toast.success('Note added');
      setContent('');
      onSuccess?.();
      onClose?.();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* Sheet */}
      <div className="relative z-10 w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-4">
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
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write a note about this job..."
          className="rounded-xl text-sm min-h-24 resize-none"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !content.trim()}
            className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
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