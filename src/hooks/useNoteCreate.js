/**
 * useNoteCreate — shared hook for creating a JobNote with optional file upload.
 * Used by JobAddNoteSheet, QuickAddNote (JobTimelineTab), and any future note entry point.
 */
import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { getInternalRole, isAdmin as checkAdmin } from '@/lib/adminAuth';

export function useNoteCreate({ job, onSuccess }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const isAdmin = checkAdmin();
  const fileInputRef = useRef(null);

  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [visibility, setVisibility] = useState('internal');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setContent('');
    setNoteType('general');
    setVisibility('internal');
    setFile(null);
  };

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
        visibility,
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
      queryClient.invalidateQueries({ queryKey: ['job-notes'] });
      toast.success('Note saved');
      reset();
      onSuccess?.();
    },
    onError: () => {
      setUploading(false);
      toast.error('Failed to save note');
    },
  });

  const canSave = !!content.trim() && !saveMut.isPending && !uploading;

  return {
    content, setContent,
    noteType, setNoteType,
    visibility, setVisibility,
    file, setFile,
    fileInputRef,
    uploading,
    isPending: saveMut.isPending,
    canSave,
    save: () => saveMut.mutate(),
    reset,
    isAdmin,
  };
}