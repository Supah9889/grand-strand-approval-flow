import React, { useRef, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FolderOpen, Upload, Image, FileText, File, Loader2,
  ExternalLink, Paperclip, StickyNote, Calendar, Receipt,
  FileSignature, X
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';
import { useNavigate } from 'react-router-dom';

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  photo:               { label: 'Photo',               color: 'bg-sky-50 text-sky-700',      group: 'Photos' },
  before_photo:        { label: 'Before',              color: 'bg-amber-50 text-amber-700',  group: 'Photos' },
  progress_photo:      { label: 'Progress',            color: 'bg-blue-50 text-blue-700',    group: 'Photos' },
  after_photo:         { label: 'After',               color: 'bg-green-50 text-green-700',  group: 'Photos' },
  punch_list_photo:    { label: 'Punch List',          color: 'bg-orange-50 text-orange-700',group: 'Photos' },
  jobsite_photo:       { label: 'Jobsite',             color: 'bg-cyan-50 text-cyan-700',    group: 'Photos' },
  warranty_photo:      { label: 'Warranty Photo',      color: 'bg-violet-50 text-violet-700',group: 'Photos' },
  field_documentation: { label: 'Field Doc',           color: 'bg-teal-50 text-teal-700',    group: 'Field' },
  homeowner_reference: { label: 'Homeowner Ref',       color: 'bg-indigo-50 text-indigo-700',group: 'Field' },
  signed_doc:          { label: 'Signed Doc',          color: 'bg-green-50 text-green-700',  group: 'Documents' },
  contract:            { label: 'Contract',            color: 'bg-primary/10 text-primary',  group: 'Documents' },
  estimate:            { label: 'Estimate',            color: 'bg-indigo-50 text-indigo-700',group: 'Documents' },
  proposal:            { label: 'Proposal',            color: 'bg-indigo-50 text-indigo-700',group: 'Documents' },
  change_order:        { label: 'Change Order',        color: 'bg-orange-50 text-orange-700',group: 'Documents' },
  invoice_support:     { label: 'Invoice Support',     color: 'bg-emerald-50 text-emerald-700', group: 'Finance' },
  bill_attachment:     { label: 'Bill Attachment',     color: 'bg-amber-50 text-amber-700',  group: 'Finance' },
  receipt:             { label: 'Receipt',             color: 'bg-amber-50 text-amber-700',  group: 'Finance' },
  vendor_document:     { label: 'Vendor Doc',          color: 'bg-slate-100 text-slate-700', group: 'Vendors' },
  permit:              { label: 'Permit',              color: 'bg-red-50 text-red-700',      group: 'Documents' },
  internal:            { label: 'Internal',            color: 'bg-muted text-muted-foreground', group: 'Other' },
  other:               { label: 'Other',               color: 'bg-muted text-muted-foreground', group: 'Other' },
};

const UPLOAD_CATEGORY_OPTIONS = [
  'photo', 'before_photo', 'progress_photo', 'after_photo', 'jobsite_photo',
  'punch_list_photo', 'field_documentation', 'homeowner_reference',
  'signed_doc', 'contract', 'estimate', 'proposal', 'change_order',
  'invoice_support', 'bill_attachment', 'receipt', 'vendor_document',
  'permit', 'internal', 'other',
];

// Source module icon/label lookup
const MODULE_CONFIG = {
  note:         { label: 'Note',          icon: StickyNote,     color: 'text-amber-600' },
  invoice:      { label: 'Invoice',       icon: Receipt,        color: 'text-green-600' },
  bill:         { label: 'Bill',          icon: Receipt,        color: 'text-amber-600' },
  schedule:     { label: 'Schedule',      icon: Calendar,       color: 'text-cyan-600' },
  signature:    { label: 'Signature',     icon: FileSignature,  color: 'text-primary' },
  estimate:     { label: 'Estimate',      icon: FileText,       color: 'text-indigo-600' },
  change_order: { label: 'Change Order',  icon: FileText,       color: 'text-orange-600' },
  expense:      { label: 'Expense',       icon: Receipt,        color: 'text-orange-600' },
  daily_log:    { label: 'Daily Log',     icon: FileText,       color: 'text-orange-500' },
  job:          { label: 'Job',           icon: FolderOpen,     color: 'text-muted-foreground' },
};

function getCatConfig(cat) {
  return CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.other;
}

function fileIcon(name, type) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const t = type || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext) || t.startsWith('image/')) return Image;
  if (['pdf'].includes(ext) || t === 'application/pdf') return FileText;
  return File;
}

function isImageFile(name, type) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext) || (type || '').startsWith('image/');
}

function safeDate(d) {
  if (!d) return null;
  try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return null; }
}

// ── Source context chip ───────────────────────────────────────────────────────
function SourceChip({ module, label, onClick }) {
  const cfg = MODULE_CONFIG[module] || MODULE_CONFIG.job;
  const Icon = cfg.icon;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-muted
        ${onClick ? 'hover:bg-muted/70 cursor-pointer' : 'cursor-default'}
        ${cfg.color} font-medium`}
      title={label || cfg.label}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate max-w-[120px]">{label || cfg.label}</span>
    </button>
  );
}

// ── Individual file card ──────────────────────────────────────────────────────
function FileCard({ file, onSourceClick }) {
  const [imgError, setImgError] = useState(false);
  const catCfg = getCatConfig(file.category);
  const Icon = fileIcon(file.file_name, file.file_type);
  const isImg = isImageFile(file.file_name, file.file_type) && !imgError;
  const dateStr = safeDate(file.created_date);

  return (
    <div className="flex items-start gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/20 transition-colors group">
      {/* Thumbnail or icon */}
      <div className="shrink-0">
        {isImg ? (
          <img
            src={file.file_url}
            alt={file.file_name}
            className="w-12 h-12 rounded-lg object-cover border border-border"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* File name + open link */}
        <div className="flex items-start justify-between gap-2">
          <a
            href={file.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground hover:text-primary truncate leading-tight flex items-center gap-1 group/link"
          >
            <span className="truncate">{file.file_name}</span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/link:opacity-60 transition-opacity" />
          </a>
        </div>

        {/* Category + meta row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${catCfg.color}`}>
            {catCfg.label}
          </span>
          {file.uploaded_by_name && (
            <span className="text-[10px] text-muted-foreground">{file.uploaded_by_name}</span>
          )}
          {dateStr && (
            <span className="text-[10px] text-muted-foreground/60">{dateStr}</span>
          )}
        </div>

        {/* Source context */}
        {file.related_module && file.related_module !== 'job' && (
          <div>
            <SourceChip
              module={file.related_module}
              label={file.related_module_label || null}
              onClick={onSourceClick}
            />
          </div>
        )}

        {/* Internal notes */}
        {file.description && (
          <p className="text-[11px] text-muted-foreground/70 italic leading-snug line-clamp-2">{file.description}</p>
        )}
      </div>
    </div>
  );
}

// ── Upload form ───────────────────────────────────────────────────────────────
function UploadForm({ job, onUploaded }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const fileInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('photo');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const reset = () => { setSelectedFile(null); setNotes(''); setCategory('photo'); setOpen(false); };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      await base44.entities.JobFile.create({
        job_id: job.id,
        job_address: job.address,
        job_title: job.title || job.address,
        file_url,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
        category,
        description: notes.trim() || null,
        uploaded_by_name: actorName || 'admin',
        related_module: 'job',
        visibility: 'internal',
      });
      queryClient.invalidateQueries({ queryKey: ['hub-files-tab', job.id] });
      queryClient.invalidateQueries({ queryKey: ['hub-tl-files', job.id] });
      toast.success('File uploaded');
      reset();
      onUploaded?.();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 h-10 px-4 border border-dashed border-primary/30 text-primary text-sm rounded-xl hover:border-primary/60 hover:bg-primary/5 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Upload photo or document...
      </button>
    );
  }

  return (
    <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Upload file</p>
        <button onClick={reset} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* File picker */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className={`w-full flex items-center justify-center gap-2 h-20 border-2 border-dashed rounded-xl transition-colors text-sm
          ${selectedFile ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'}`}
      >
        {selectedFile ? (
          <><Paperclip className="w-4 h-4" />{selectedFile.name}</>
        ) : (
          <><Upload className="w-4 h-4" />Tap to choose file</>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        onChange={e => setSelectedFile(e.target.files?.[0] || null)}
      />

      {/* Category */}
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="h-9 rounded-xl text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UPLOAD_CATEGORY_OPTIONS.map(c => (
            <SelectItem key={c} value={c}>{getCatConfig(c).label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Optional notes */}
      <Input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Internal notes (optional)"
        className="h-9 rounded-xl text-sm"
      />

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <button onClick={reset} className="text-xs text-muted-foreground px-3 py-2 rounded-lg hover:bg-muted transition-colors">
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Upload
        </button>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function JobFilesTab({ job, isAdmin }) {
  const navigate = useNavigate();
  const [catFilter, setCatFilter] = useState('all');

  // Direct job files
  const { data: jobFiles = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['hub-files-tab', job.id],
    queryFn: () => base44.entities.JobFile.filter({ job_id: job.id, archived: false }, '-created_date'),
    enabled: !!job.id,
  });

  // Notes that have file attachments — surface as virtual file entries
  const { data: notes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ['hub-files-notes', job.id],
    queryFn: () => base44.entities.JobNote.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });

  const noteFiles = useMemo(() =>
    notes
      .filter(n => n.file_url && n.file_name)
      .map(n => ({
        id: `note-file-${n.id}`,
        _virtual: true,
        _source_id: n.id,
        _source_type: 'note',
        _source_label: n.note_type ? n.note_type.replace(/_/g, ' ') : 'Note',
        job_id: n.job_id,
        file_url: n.file_url,
        file_name: n.file_name,
        file_type: null,
        category: 'photo_file_note', // internal marker — rendered as 'Note Attachment'
        description: n.content ? n.content.slice(0, 120) : null,
        uploaded_by_name: n.author_name || n.author_role || null,
        created_date: n.created_date,
        related_module: 'note',
        related_module_label: n.note_type ? n.note_type.replace(/_/g, ' ') : 'Note',
      })),
    [notes]
  );

  // Combined file list
  const allFiles = useMemo(() => {
    const combined = [
      ...jobFiles,
      ...noteFiles,
    ];
    // Sort newest first
    return [...combined].sort((a, b) => {
      const at = a.created_date ? new Date(a.created_date).getTime() : 0;
      const bt = b.created_date ? new Date(b.created_date).getTime() : 0;
      return bt - at;
    });
  }, [jobFiles, noteFiles]);

  // Build category filter options from actual data
  const catCounts = useMemo(() => {
    const counts = {};
    allFiles.forEach(f => {
      const key = f._virtual ? 'note_attachment' : (f.category || 'other');
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [allFiles]);

  // Determine which groups have photos (for a Photos shortcut)
  const photoKeys = new Set(['photo','before_photo','progress_photo','after_photo','jobsite_photo','punch_list_photo','warranty_photo']);
  const hasPhotos = allFiles.some(f => photoKeys.has(f.category));

  const FILTER_OPTIONS = [
    { value: 'all', label: 'All' },
    ...(hasPhotos ? [{ value: 'photos', label: 'Photos' }] : []),
    ...(catCounts['field_documentation'] || catCounts['homeowner_reference'] ? [{ value: 'field', label: 'Field' }] : []),
    ...(catCounts['signed_doc'] || catCounts['contract'] || catCounts['estimate'] || catCounts['proposal'] ? [{ value: 'docs', label: 'Documents' }] : []),
    ...(catCounts['invoice_support'] || catCounts['bill_attachment'] || catCounts['receipt'] ? [{ value: 'finance', label: 'Finance' }] : []),
    ...(catCounts['vendor_document'] ? [{ value: 'vendors', label: 'Vendors' }] : []),
    ...(catCounts['note_attachment'] ? [{ value: 'note_attachment', label: 'Note Attachments' }] : []),
  ];

  const filtered = useMemo(() => {
    if (catFilter === 'all') return allFiles;
    if (catFilter === 'photos') return allFiles.filter(f => photoKeys.has(f.category));
    if (catFilter === 'field') return allFiles.filter(f => ['field_documentation','homeowner_reference'].includes(f.category));
    if (catFilter === 'docs') return allFiles.filter(f => ['signed_doc','contract','estimate','proposal','change_order','permit'].includes(f.category));
    if (catFilter === 'finance') return allFiles.filter(f => ['invoice_support','bill_attachment','receipt'].includes(f.category));
    if (catFilter === 'vendors') return allFiles.filter(f => f.category === 'vendor_document');
    if (catFilter === 'note_attachment') return allFiles.filter(f => f._virtual);
    return allFiles;
  }, [allFiles, catFilter]);

  // Photo grid vs list view toggle
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const isPhotoView = catFilter === 'photos' || catFilter === 'all';
  const photosInView = filtered.filter(f => isImageFile(f.file_name, f.file_type));
  const showGridToggle = photosInView.length >= 3;

  const isLoading = loadingFiles || loadingNotes;

  const getSourceNavHandler = (file) => {
    if (!file._virtual) return null;
    if (file._source_type === 'note') {
      return () => navigate(`/job-hub?jobId=${job.id}&tab=timeline`);
    }
    return null;
  };

  return (
    <div className="space-y-4">

      {/* Upload form */}
      {isAdmin && <UploadForm job={job} />}

      {/* Filter strip */}
      {allFiles.length > 0 && FILTER_OPTIONS.length > 1 && (
        <div className="flex items-center gap-1.5">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1 pb-0.5">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setCatFilter(opt.value)}
                className={`shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full transition-colors
                  ${catFilter === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              >
                {opt.label}
                {opt.value !== 'all' && catCounts[
                  opt.value === 'photos' ? 'photo' :
                  opt.value === 'note_attachment' ? 'note_attachment' : opt.value
                ] > 0 && (
                  <span className="ml-1 opacity-70">
                    {opt.value === 'photos'
                      ? allFiles.filter(f => photoKeys.has(f.category)).length
                      : opt.value === 'note_attachment'
                      ? catCounts['note_attachment']
                      : null}
                  </span>
                )}
              </button>
            ))}
          </div>
          {showGridToggle && (
            <button
              onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
              className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-full bg-muted transition-colors"
            >
              {viewMode === 'grid' ? 'List' : 'Grid'}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-14">
          <FolderOpen className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {catFilter === 'all' ? 'No files yet' : `No ${FILTER_OPTIONS.find(o => o.value === catFilter)?.label?.toLowerCase() || 'files'} yet`}
          </p>
          {isAdmin && catFilter === 'all' && (
            <p className="text-xs text-muted-foreground mt-1">Use the upload form above to add photos or documents</p>
          )}
        </div>
      ) : viewMode === 'grid' && photosInView.length > 0 ? (
        // Photo grid
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground px-1">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-3 gap-2">
            {photosInView.map(f => (
              <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-colors">
                <img src={f.file_url} alt={f.file_name} className="w-full h-full object-cover" onError={e => { e.target.parentElement.style.display = 'none'; }} />
              </a>
            ))}
          </div>
          {/* List any non-photo files in this filter */}
          {filtered.filter(f => !isImageFile(f.file_name, f.file_type)).map(f => (
            <FileCard key={f.id} file={f} onSourceClick={getSourceNavHandler(f)} />
          ))}
        </div>
      ) : (
        // List view
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground px-1">{filtered.length} file{filtered.length !== 1 ? 's' : ''} · newest first</p>
          {filtered.map(f => (
            <FileCard key={f.id} file={f} onSourceClick={getSourceNavHandler(f)} />
          ))}
        </div>
      )}
    </div>
  );
}