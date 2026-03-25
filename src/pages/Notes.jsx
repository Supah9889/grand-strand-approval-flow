import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, StickyNote, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import AppLayout from '../components/AppLayout';
import { getInternalRole, isAdmin as getIsAdmin } from '@/lib/adminAuth';

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'staff') return 'Staff';
  return 'Team';
}

export default function Notes() {
  const queryClient = useQueryClient();
  const role = getInternalRole();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['job-notes'],
    queryFn: () => base44.entities.JobNote.list('-created_date', 100),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.JobNote.update(id, { read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-notes'] }),
  });

  const unread = notes.filter(n => !n.read).length;

  return (
    <AppLayout title="Notes">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-foreground">Internal Notes</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {unread > 0 ? `${unread} unread note${unread !== 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
          {unread > 0 && (
            <button
              onClick={() => notes.filter(n => !n.read).forEach(n => markReadMutation.mutate(n.id))}
              className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <StickyNote className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notes yet. Add notes from calendar events.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notes.map(note => (
              <div
                key={note.id}
                className={`bg-card border rounded-xl p-4 space-y-2 transition-colors ${
                  !note.read ? 'border-primary/30 bg-primary/[0.02]' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    {(note.job_title || note.job_address) && (
                      <p className="text-xs font-semibold text-primary truncate">
                        {note.job_title || note.job_address}
                      </p>
                    )}
                    {note.event_title && (
                      <p className="text-xs text-muted-foreground truncate">Event: {note.event_title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!note.read && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                    {!note.read && role === 'admin' && (
                      <button
                        onClick={() => markReadMutation.mutate(note.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-foreground leading-relaxed">{note.content}</p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`px-1.5 py-0.5 rounded-md font-medium ${
                    note.author_role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {roleLabel(note.author_role)}
                  </span>
                  <span>·</span>
                  <span>
                    {note.created_date
                      ? format(parseISO(note.created_date), 'MMM d, yyyy · h:mm a')
                      : 'Just now'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}