import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Activity, Loader2, Plus, StickyNote, ChevronDown, ChevronUp,
  Paperclip, ExternalLink, X
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  NOTE_TYPE_OPTIONS, getNoteTypeConfig, getEventTypeConfig,
  buildNoteItem, buildLogItem, buildChangeOrderItem, buildInvoiceItem,
  buildExpenseItem, buildTaskItem, buildWarrantyItem, buildFileItem,
  buildTimeEntryItem, buildScheduleItem, buildSignatureItem, sortFeed, getNoteVisibilityConfig,
} from '@/lib/timelineHelpers';
import { useNoteCreate } from '@/hooks/useNoteCreate';
import { Lock, Eye, ShieldAlert } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeRelative(ts) {
  if (!ts) return null;
  try { return formatDistanceToNow(new Date(ts), { addSuffix: true }); }
  catch { return null; }
}

function safeDate(ts) {
  if (!ts) return null;
  try { return format(new Date(ts), 'MMM d, yyyy · h:mm a'); }
  catch { return null; }
}

// ── Filter options ────────────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { value: 'all',          label: 'All' },
  { value: 'note',         label: 'Notes' },
  { value: 'daily_log',    label: 'Daily Logs' },
  { value: 'invoice',      label: 'Invoices' },
  { value: 'change_order', label: 'Change Orders' },
  { value: 'expense',      label: 'Costs' },
  { value: 'task',         label: 'Tasks' },
  { value: 'file',         label: 'Files' },
  { value: 'time_entry',   label: 'Time' },
  { value: 'schedule',     label: 'Schedule' },
  { value: 'warranty',     label: 'Warranty' },
  { value: 'signature',    label: 'Approvals' },
];

// ── Timeline Item Card ────────────────────────────────────────────────────────
function TimelineCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = item.canExpand;
  const isNote = item.type === 'note';
  const isClickable = !isNote || !!item.fileUrl;

  const relative = safeRelative(item.ts);
  const absolute = safeDate(item.ts);

  const bodyText = item.body || item.title || '';
  const displayBody = isNote ? bodyText : null;
  const displayTitle = isNote ? null : item.title;

  return (
    <div className={`relative flex gap-3 group ${isNote ? 'py-0' : ''}`}>
      {/* Timeline dot + vertical connector */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ring-2 ring-background ${item.dotColor || 'bg-muted-foreground'}`} />
        <div className="w-px flex-1 bg-border/40 mt-1" />
      </div>

      {/* Card */}
      <div
        className={`flex-1 min-w-0 pb-4 ${isClickable && !isNote ? 'cursor-pointer' : ''}`}
        onClick={isClickable && !isNote ? item.onClick : undefined}
      >
        {/* Meta row: badge + author + time */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${item.badgeColor || 'bg-muted text-muted-foreground'}`}>
                {item.displayType}
              </span>
              {item.actor && (
                <span className="text-[10px] text-muted-foreground">{item.actor}</span>
              )}
              {item.isUnread && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
              {item.type === 'note' && item.visibility && item.visibility !== 'internal' && (() => {
                const vcfg = getNoteVisibilityConfig(item.visibility);
                return (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${vcfg.color}`}>
                    {vcfg.label}
                  </span>
                );
              })()}
            </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground/60" title={absolute || ''}>
              {relative || absolute || '—'}
            </span>
            {isClickable && !isNote && (
              <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
            )}
          </div>
        </div>

        {/* Title (non-note entities) */}
        {displayTitle && (
          <p className="text-sm font-medium text-foreground leading-snug mb-0.5">{displayTitle}</p>
        )}

        {/* Body / note content */}
        {displayBody && (
          <div>
            <p className={`text-sm text-foreground leading-relaxed whitespace-pre-wrap ${!expanded && canExpand ? 'line-clamp-3' : ''}`}>
              {displayBody}
            </p>
            {canExpand && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                className="text-[10px] text-primary hover:underline mt-0.5 flex items-center gap-0.5"
              >
                {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
              </button>
            )}
          </div>
        )}

        {/* Sub / secondary info */}
        {item.sub && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
        )}

        {/* Body for non-note items (description/notes field) */}
        {!isNote && item.body && (
          <p className="text-xs text-muted-foreground/80 mt-0.5 italic line-clamp-2">{item.body}</p>
        )}

        {/* Attachment indicator */}
        {item.hasFile && item.fileUrl && (
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-primary hover:underline"
          >
            <Paperclip className="w-3 h-3" />
            {item.fileName || 'Attachment'}
          </a>
        )}
      </div>
    </div>
  );
}

const VISIBILITY_OPTIONS = [
  { value: 'internal',        label: 'Internal' },
  { value: 'shareable',       label: 'Shareable' },
  { value: 'admin_sensitive', label: 'Admin Only' },
];

// ── Quick Add Note inline form ────────────────────────────────────────────────
function QuickAddNote({ job, onAdded, isAdmin }) {
  const [open, setOpen] = useState(false);

  const noteState = useNoteCreate({
    job,
    onSuccess: () => { setOpen(false); onAdded?.(); },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 h-10 px-4 border border-dashed border-primary/30 text-primary text-sm rounded-xl hover:border-primary/60 hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add note, update, or contact record...
      </button>
    );
  }

  const { content, setContent, noteType, setNoteType, visibility, setVisibility,
          file, setFile, fileInputRef, uploading, isPending, canSave, save } = noteState;

  return (
    <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-3">
      {/* Type + visibility */}
      <div className="flex items-center gap-2">
        <Select value={noteType} onValueChange={setNoteType}>
          <SelectTrigger className="h-8 rounded-xl text-xs flex-1 max-w-52">
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
            <SelectTrigger className="h-8 rounded-xl text-xs w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <button onClick={() => { setOpen(false); noteState.reset(); }} className="ml-auto text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <Textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Type your note — calls, texts, field updates, access info, completion notes..."
        className="rounded-xl text-sm min-h-20 resize-none"
        autoFocus
      />

      {/* File + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Paperclip className="w-3.5 h-3.5" />
          {file ? <span className="max-w-[100px] truncate">{file.name}</span> : 'Attach file'}
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
          <button
            onClick={() => { setOpen(false); noteState.reset(); }}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {(isPending || uploading) && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <StickyNote className="w-3.5 h-3.5" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function JobTimelineTab({ job, isAdmin }) {
  const navigate = useNavigate();
  const [limit, setLimit] = useState(30);
  const [typeFilter, setTypeFilter] = useState('all');

  // ── Data queries ────────────────────────────────────────────────
  const { data: notes = [], isLoading: ln } = useQuery({
    queryKey: ['hub-tl-notes', job.id],
    queryFn: () => base44.entities.JobNote.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: logs = [], isLoading: ll } = useQuery({
    queryKey: ['hub-tl-logs', job.id],
    queryFn: () => base44.entities.DailyLog.filter({ job_id: job.id }, '-log_date'),
    enabled: !!job.id && isAdmin,
  });
  const { data: cos = [], isLoading: lc } = useQuery({
    queryKey: ['hub-tl-cos', job.id],
    queryFn: () => base44.entities.ChangeOrder.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id && isAdmin,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['hub-tl-invoices', job.id],
    queryFn: () => base44.entities.Invoice.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id && isAdmin,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['hub-tl-expenses', job.id],
    queryFn: () => base44.entities.Expense.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id && isAdmin,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ['hub-tl-tasks', job.id],
    queryFn: () => base44.entities.Task.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: warrantyItems = [] } = useQuery({
    queryKey: ['hub-tl-warranty', job.id],
    queryFn: () => base44.entities.WarrantyItem.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: files = [] } = useQuery({
    queryKey: ['hub-tl-files', job.id],
    queryFn: () => base44.entities.JobFile.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });
  const { data: timeEntries = [] } = useQuery({
    queryKey: ['hub-tl-time', job.id],
    queryFn: () => base44.entities.TimeEntry.filter({ job_id: job.id }, '-clock_in'),
    enabled: !!job.id && isAdmin,
  });
  const { data: scheduleEvents = [] } = useQuery({
    queryKey: ['hub-tl-schedule', job.id],
    queryFn: () => base44.entities.CalendarEvent.filter({ job_id: job.id }, '-start_date'),
    enabled: !!job.id,
  });
  const { data: signatureRecords = [] } = useQuery({
    queryKey: ['hub-sig-records', job.id],
    queryFn: () => base44.entities.SignatureRecord.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });

  const coreLoading = ln || ll || lc;

  // ── Build unified feed ──────────────────────────────────────────
  const feed = useMemo(() => {
    const items = [
      ...notes.map(n => buildNoteItem(n, navigate)),
      ...logs.map(l => buildLogItem(l, navigate)),
      ...cos.map(co => buildChangeOrderItem(co, navigate)),
      ...invoices.map(i => buildInvoiceItem(i, navigate)),
      ...expenses.map(e => buildExpenseItem(e, navigate)),
      ...tasks.map(t => buildTaskItem(t, navigate)),
      ...warrantyItems.map(w => buildWarrantyItem(w, navigate)),
      ...files.map(f => buildFileItem(f)),
      ...timeEntries.map(e => buildTimeEntryItem(e, navigate)),
      ...scheduleEvents.map(ev => buildScheduleItem(ev, navigate)),
      ...signatureRecords.map(r => buildSignatureItem(r, navigate)),
    ];
    return sortFeed(items);
  }, [notes, logs, cos, invoices, expenses, tasks, warrantyItems, files, timeEntries, scheduleEvents, signatureRecords]);

  const filtered = typeFilter === 'all' ? feed : feed.filter(i => i.type === typeFilter);
  const visible = filtered.slice(0, limit);
  const noteCount = notes.length;
  const hasFilter = typeFilter !== 'all';

  return (
    <div className="space-y-3">
      {/* Quick add note */}
      {isAdmin && <QuickAddNote job={job} isAdmin={isAdmin} />}

      {/* Filter strip — only shown when there's content */}
      {feed.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setTypeFilter(opt.value); setLimit(30); }}
              className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors
                ${typeFilter === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {opt.label}
              {opt.value !== 'all' && feed.filter(i => i.type === opt.value).length > 0 && (
                <span className="ml-1 opacity-70">
                  {feed.filter(i => i.type === opt.value).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {coreLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          {hasFilter
            ? <p className="text-sm text-muted-foreground">No {FILTER_OPTIONS.find(o => o.value === typeFilter)?.label?.toLowerCase()} entries yet</p>
            : <>
                <p className="text-sm text-muted-foreground">No activity yet on this job</p>
                <p className="text-xs text-muted-foreground mt-1">Add a note above to start building the history</p>
              </>
          }
        </div>
      ) : (
        <>
          {/* Feed count */}
          <p className="text-[10px] text-muted-foreground px-1">
            {filtered.length} {hasFilter ? FILTER_OPTIONS.find(o => o.value === typeFilter)?.label?.toLowerCase() : 'events'} · newest first
          </p>

          {/* Timeline */}
          <div className="pl-1">
            {visible.map(item => (
              <TimelineCard key={item.id} item={item} />
            ))}
          </div>

          {/* Load more */}
          {filtered.length > limit && (
            <button
              onClick={() => setLimit(l => l + 30)}
              className="w-full text-xs text-primary py-3 hover:underline"
            >
              Load {Math.min(30, filtered.length - limit)} more · {filtered.length - limit} remaining
            </button>
          )}
        </>
      )}
    </div>
  );
}