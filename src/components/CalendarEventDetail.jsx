import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, MapPin, CalendarDays, Clock, User, Loader2, StickyNote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

function formatTime(isoString) {
  if (!isoString || !isoString.includes('T')) return null;
  return format(parseISO(isoString), 'h:mm a');
}

function formatDate(isoString) {
  if (!isoString) return '';
  return format(parseISO(isoString.split('T')[0]), 'EEEE, MMMM d, yyyy');
}

export default function CalendarEventDetail({ event, job, open, onClose }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const role = getInternalRole();

  if (!event) return null;

  const color = event.color || '#2563eb';
  const startTime = formatTime(event.start_date);
  const endTime = formatTime(event.end_date);

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    await base44.entities.JobNote.create({
      job_id: event.job_id || '',
      job_address: event.job_address || '',
      job_title: job?.title || job?.address || '',
      event_id: event.id,
      event_title: event.title,
      content: note.trim(),
      author_role: role || 'staff',
      read: false,
    });
    queryClient.invalidateQueries({ queryKey: ['job-notes'] });
    toast.success('Note saved');
    setNote('');
    setSaving(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ced-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="ced-panel"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto overflow-y-auto max-h-[90vh]">

              {/* Color strip + header */}
              <div className="h-1.5 rounded-t-2xl" style={{ backgroundColor: color }} />
              <div className="flex items-start justify-between px-5 pt-4 pb-3">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="text-base font-semibold text-foreground leading-snug">{event.title}</p>
                  {(job?.title || job?.address) && (
                    <p className="text-xs font-medium mt-0.5" style={{ color }}>
                      {job?.title || job?.address}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Details */}
              <div className="px-5 pb-4 space-y-3">
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-foreground">{formatDate(event.start_date)}</p>
                  </div>

                  {(startTime || endTime) && (
                    <div className="flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">
                        {startTime}{endTime ? ` – ${endTime}` : ''}
                      </p>
                    </div>
                  )}

                  {event.job_address && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{event.job_address}</p>
                    </div>
                  )}

                  {event.assigned_to && (
                    <div className="flex items-start gap-2.5">
                      <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{event.assigned_to}</p>
                    </div>
                  )}
                </div>

                {event.notes && (
                  <div className="bg-muted/50 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-1">Event Notes</p>
                    <p className="text-sm text-foreground">{event.notes}</p>
                  </div>
                )}

                {/* Add note */}
                <div className="border-t border-border pt-4 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium text-muted-foreground">Add a Note</p>
                  </div>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Type a note for this event..."
                    rows={3}
                    className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                  <button
                    onClick={saveNote}
                    disabled={!note.trim() || saving}
                    className="w-full h-9 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Note'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}