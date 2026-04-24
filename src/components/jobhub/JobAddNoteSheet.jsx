import React from 'react';
import { StickyNote, Loader2, X, Paperclip, Lock, Eye, ShieldAlert } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { NOTE_TYPE_OPTIONS } from '@/lib/timelineHelpers';
import { useNoteCreate } from '@/hooks/useNoteCreate';

const VISIBILITY_OPTIONS = [
  { value: 'internal',        label: 'Internal',   icon: Lock,       hint: 'Team only' },
  { value: 'shareable',       label: 'Shareable',  icon: Eye,        hint: 'OK for summaries' },
  { value: 'admin_sensitive', label: 'Admin Only', icon: ShieldAlert, hint: 'Admins only' },
];

export default function JobAddNoteSheet({ job, onClose, onSuccess }) {
  const {
    content, setContent,
    noteType, setNoteType,
    visibility, setVisibility,
    file, setFile,
    fileInputRef,
    uploading,
    isPending,
    canSave,
    save,
    isAdmin,
  } = useNoteCreate({ job, onSuccess: () => { onSuccess?.(); onClose?.(); } });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 space-y-3">

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

        <p className="text-xs text-muted-foreground truncate">{job.address}</p>

        {/* Type + visibility row */}
        <div className="flex gap-2">
          <Select value={noteType} onValueChange={setNoteType}>
            <SelectTrigger className="h-9 rounded-xl text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTE_TYPE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="h-9 rounded-xl text-xs w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map(o => {
                  const Icon = o.icon;
                  return (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3" />
                        {o.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Content */}
        <Textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write a note — calls, texts, field updates, access info, homeowner contact..."
          className="rounded-xl text-sm min-h-[96px] resize-none"
          autoFocus
        />

        {/* Attach + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5" />
            {file ? <span className="text-foreground font-medium max-w-[120px] truncate">{file.name}</span> : 'Attach file'}
          </button>
          {file && (
            <button onClick={() => setFile(null)} className="text-xs text-destructive hover:underline">Remove</button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />

          <div className="ml-auto flex items-center gap-2">
            <button onClick={onClose} className="text-sm text-muted-foreground px-4 py-2.5 rounded-xl hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-5 py-2.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {(isPending || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}