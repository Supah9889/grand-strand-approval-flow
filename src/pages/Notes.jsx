import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, StickyNote, Check, Paperclip, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import AppLayout from '../components/AppLayout';
import { isAdmin as getIsAdmin } from '@/lib/adminAuth';
import { getNoteTypeConfig, NOTE_TYPE_OPTIONS, getNoteVisibilityConfig } from '@/lib/timelineHelpers';

// Filter options — "All" + one per note_type that has records
const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  ...NOTE_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label })),
];

function NoteCard({ note, onMarkRead, isAdmin }) {
  const [expanded, setExpanded] = useState(false);
  const ntCfg = getNoteTypeConfig(note.note_type);
  const visCfg = note.visibility && note.visibility !== 'internal'
    ? getNoteVisibilityConfig(note.visibility)
    : null;
  const isLong = (note.content || '').length > 200;

  return (
    <div className={`bg-card border rounded-2xl p-4 space-y-2.5 transition-colors ${
      !note.read ? 'border-primary/30 bg-primary/[0.02]' : 'border-border'
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          {/* Job address link */}
          {(note.job_address || note.job_title) && (
            <button
              onClick={() => note.job_id ? window.location.href = `/job-hub?jobId=${note.job_id}` : undefined}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline truncate"
            >
              <MapPin className="w-3 h-3 shrink-0" />
              {note.job_title || note.job_address}
            </button>
          )}

          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ntCfg.color}`}>
              {ntCfg.label}
            </span>
            {visCfg && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${visCfg.color}`}>
                {visCfg.label}
              </span>
            )}
            {!note.read && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            )}
          </div>
        </div>

        {/* Mark read */}
        {!note.read && isAdmin && (
          <button
            onClick={() => onMarkRead(note.id)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors shrink-0"
            title="Mark as read"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div>
        <p className={`text-sm text-foreground leading-relaxed whitespace-pre-wrap ${!expanded && isLong ? 'line-clamp-4' : ''}`}>
          {note.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[10px] text-primary hover:underline mt-0.5 flex items-center gap-0.5"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
          </button>
        )}
      </div>

      {/* Attachment */}
      {note.file_url && (
        <a
          href={note.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
        >
          <Paperclip className="w-3 h-3" />
          {note.file_name || 'Attachment'}
        </a>
      )}

      {/* Footer: author + time */}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
        {(note.author_name || note.author_role) && (
          <>
            <span className={`px-1.5 py-0.5 rounded-md font-medium ${
              note.author_role === 'admin'
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary text-secondary-foreground'
            }`}>
              {note.author_name || (note.author_role === 'admin' ? 'Admin' : 'Staff')}
            </span>
            <span className="text-muted-foreground/40">·</span>
          </>
        )}
        <span>
          {note.created_date
            ? format(parseISO(note.created_date), 'MMM d, yyyy · h:mm a')
            : 'Just now'}
        </span>
      </div>
    </div>
  );
}

export default function Notes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isAdmin = getIsAdmin();
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['job-notes'],
    queryFn: () => base44.entities.JobNote.list('-created_date', 200),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.JobNote.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-notes'] }),
  });

  const markAllRead = () => {
    notes.filter(n => !n.read).forEach(n => markReadMutation.mutate(n.id));
  };

  // Build active filter counts
  const typeCounts = useMemo(() => {
    const counts = {};
    notes.forEach(n => {
      const t = n.note_type || 'general';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [notes]);

  const filtered = useMemo(() => {
    if (typeFilter === 'all') return notes;
    return notes.filter(n => (n.note_type || 'general') === typeFilter);
  }, [notes, typeFilter]);

  const unread = notes.filter(n => !n.read).length;
  const activeFilters = TYPE_FILTERS.filter(f => f.value === 'all' || typeCounts[f.value] > 0);

  return (
    <AppLayout title="Notes">
      <div className="max-w-2xl mx-auto w-full px-4 py-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Notes</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unread > 0 ? `${unread} unread` : 'All caught up'} · {notes.length} total
            </p>
          </div>
          {unread > 0 && isAdmin && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Type filter strip */}
        {notes.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {activeFilters.map(f => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors
                  ${typeFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {f.label}
                {f.value !== 'all' && typeCounts[f.value] > 0 && (
                  <span className="ml-1 opacity-70">{typeCounts[f.value]}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <StickyNote className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {typeFilter === 'all' ? 'No notes yet. Add notes from any job.' : 'No notes with this type.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[10px] text-muted-foreground px-1">
              {filtered.length} note{filtered.length !== 1 ? 's' : ''} · newest first
            </p>
            {filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onMarkRead={(id) => markReadMutation.mutate(id)}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}