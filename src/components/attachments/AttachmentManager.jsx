/**
 * AttachmentManager — displays, manages, and allows actions on Attachment records
 * for any record type. Supports view, download, rename, replace, and archive.
 *
 * Props:
 *   recordType   — 'job' | 'expense' | 'invoice' | 'estimate' | 'bill' | etc.
 *   recordId     — ID of the parent record
 *   jobId        — optional job cross-ref
 *   isAdmin      — boolean — controls rename/replace/archive access
 *   defaultCategory — default category passed to upload widget
 *   defaultVisibility — default visibility passed to upload widget
 *   showUpload   — boolean (default true) — show upload widget inline
 *   title        — section heading (default 'Attachments')
 */
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  FileText, Image, Download, Archive, MoreVertical,
  Pencil, RefreshCw, Loader2, Lock, Eye, Users, Paperclip, Trash2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import AttachmentUpload from './AttachmentUpload';
import PhotoLightbox from '../dailylogs/PhotoLightbox';

const DOC_ACCEPT = 'application/pdf,image/png,image/jpeg,image/jpg';

const VISIBILITY_CONFIG = {
  internal: { label: 'Internal', color: 'bg-slate-100 text-slate-600', Icon: Lock },
  client:   { label: 'Client',   color: 'bg-blue-100 text-blue-700',   Icon: Eye },
  vendor:   { label: 'Vendor',   color: 'bg-amber-100 text-amber-700', Icon: Users },
  both:     { label: 'Both',     color: 'bg-green-100 text-green-700', Icon: Users },
};

const CATEGORY_LABEL = {
  receipt: 'Receipt', invoice_support: 'Invoice', contract: 'Contract',
  signed_doc: 'Signed', estimate: 'Estimate', proposal: 'Proposal',
  change_order: 'Change Order', permit: 'Permit', vendor_document: 'Vendor Doc',
  photo: 'Photo', internal: 'Internal', agreement: 'Agreement',
  supporting_doc: 'Support Doc', other: 'Other',
};

function isImageFile(att) {
  return /image\/(jpeg|jpg|png|webp|gif)/.test(att.file_type || '') ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(att.file_name || '');
}
function isPDFFile(att) {
  return att.file_type === 'application/pdf' || /\.pdf$/i.test(att.file_name || '');
}
function fmtBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function AttachmentRow({ att, isAdmin, onArchive, onRename, onReplace, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(att.file_name);
  const [replacing, setReplacing] = useState(false);

  const vis = VISIBILITY_CONFIG[att.visibility] || VISIBILITY_CONFIG.internal;
  const VisIcon = vis.Icon;
  const isImg = isImageFile(att);
  const isPdf = isPDFFile(att);

  const submitRename = () => {
    const trimmed = nameVal.trim();
    if (!trimmed || trimmed === att.file_name) { setRenaming(false); return; }
    onRename(att.id, trimmed);
    setRenaming(false);
  };

  const handleReplaceFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setReplacing(true);
    try {
      await onReplace(att, file);
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors group">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isImg ? 'bg-blue-50' : isPdf ? 'bg-red-50' : 'bg-muted'}`}>
        {isImg ? (
          <Image className="w-4.5 h-4.5 text-blue-500" />
        ) : (
          <FileText className={`w-4 h-4 ${isPdf ? 'text-red-500' : 'text-muted-foreground'}`} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {renaming ? (
          <div className="flex items-center gap-1.5">
            <Input value={nameVal} onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(false); }}
              className="h-7 rounded-md text-xs flex-1" autoFocus />
            <Button size="sm" className="h-7 px-2 text-xs rounded-md" onClick={submitRename}>Save</Button>
            <button onClick={() => { setRenaming(false); setNameVal(att.file_name); }}
              className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>
        ) : (
          <a href={att.file_url} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-foreground hover:text-primary hover:underline truncate block leading-snug">
            {att.file_name}
          </a>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {att.category && (
            <span className="text-[10px] bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">
              {CATEGORY_LABEL[att.category] || att.category}
            </span>
          )}
          <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded ${vis.color}`}>
            <VisIcon className="w-2.5 h-2.5" /> {vis.label}
          </span>
          {att.file_size ? <span className="text-[10px] text-muted-foreground">{fmtBytes(att.file_size)}</span> : null}
          {att.version > 1 && <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">v{att.version}</span>}
        </div>

        {att.description && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{att.description}</p>
        )}

        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {att.uploaded_by_name ? `${att.uploaded_by_name} · ` : ''}
          {att.upload_date ? format(parseISO(att.upload_date), 'MMM d, yyyy h:mm a') : att.created_date ? format(parseISO(att.created_date), 'MMM d, yyyy') : ''}
        </p>
      </div>

      {/* Actions */}
      <div className="relative shrink-0">
        <div className="flex items-center gap-1">
          <a href={att.file_url} target="_blank" rel="noopener noreferrer" download
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors opacity-0 group-hover:opacity-100">
            <Download className="w-3.5 h-3.5" />
          </a>
          {isAdmin && (
            <button onClick={() => setShowMenu(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {showMenu && isAdmin && (
          <>
            <div className="absolute right-0 top-8 z-30 bg-popover border border-border rounded-xl shadow-xl w-44 py-1 text-xs">
              <button onClick={() => { setRenaming(true); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left">
                <Pencil className="w-3.5 h-3.5" /> Rename
              </button>
              <label className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors cursor-pointer ${replacing ? 'opacity-50 pointer-events-none' : ''}`}>
                {replacing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Replace file
                <input type="file" accept={DOC_ACCEPT} className="hidden" onChange={handleReplaceFile} />
              </label>
              <button onClick={() => { onArchive(att.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-left">
                <Archive className="w-3.5 h-3.5" /> Archive
              </button>
              <button onClick={() => { onDelete(att.id); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-destructive hover:text-destructive transition-colors text-left">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
            <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
          </>
        )}
      </div>
    </div>
  );
}

export default function AttachmentManager({
  recordType,
  recordId,
  jobId,
  isAdmin = false,
  defaultCategory = 'other',
  defaultVisibility = 'internal',
  showUpload = true,
  title = 'Attachments',
}) {
  const queryClient = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: allAttachments = [], isLoading } = useQuery({
    queryKey: ['attachments', recordType, recordId],
    queryFn: () => base44.entities.Attachment.filter({ record_type: recordType, record_id: recordId }),
    enabled: !!recordType && !!recordId,
  });

  const active   = allAttachments.filter(a => !a.archived);
  const archived = allAttachments.filter(a => a.archived);
  const images   = active.filter(isImageFile);

  const handleArchive = async (id) => {
    const user = await base44.auth.me().catch(() => null);
    await base44.entities.Attachment.update(id, {
      archived: true,
      archived_by: user?.email || 'admin',
      archived_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['attachments', recordType, recordId] });
    toast.success('File archived');
  };

  const handleRename = async (id, newName) => {
    await base44.entities.Attachment.update(id, { file_name: newName });
    queryClient.invalidateQueries({ queryKey: ['attachments', recordType, recordId] });
    toast.success('Renamed');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this file? This cannot be undone.')) return;
    await base44.entities.Attachment.delete(id);
    queryClient.invalidateQueries({ queryKey: ['attachments', recordType, recordId] });
    toast.success('File deleted');
  };

  const handleReplace = async (oldAtt, newFile) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file: newFile });
    const user = await base44.auth.me().catch(() => null);

    // Create new version record
    const newAtt = await base44.entities.Attachment.create({
      record_type: oldAtt.record_type,
      record_id: oldAtt.record_id,
      job_id: oldAtt.job_id,
      file_url,
      file_name: oldAtt.file_name, // keep same display name
      original_file_name: newFile.name,
      file_type: newFile.type,
      file_size: newFile.size,
      category: oldAtt.category,
      visibility: oldAtt.visibility,
      description: oldAtt.description,
      uploaded_by: user?.email || null,
      uploaded_by_name: user?.full_name || null,
      upload_date: new Date().toISOString(),
      archived: false,
      version: (oldAtt.version || 1) + 1,
    });

    // Archive old version, mark replaced
    await base44.entities.Attachment.update(oldAtt.id, {
      archived: true,
      archived_by: user?.email || 'system',
      archived_at: new Date().toISOString(),
      replaced_by_id: newAtt.id,
    });

    queryClient.invalidateQueries({ queryKey: ['attachments', recordType, recordId] });
    toast.success('File replaced');
  };

  if (!recordId) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          {title}
          {active.length > 0 && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-normal">{active.length}</span>}
        </p>
        {archived.length > 0 && isAdmin && (
          <button onClick={() => setShowArchived(v => !v)} className="text-[10px] text-muted-foreground hover:text-foreground">
            {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
          </button>
        )}
      </div>

      {showUpload && (
        <AttachmentUpload
          recordType={recordType}
          recordId={recordId}
          jobId={jobId}
          defaultCategory={defaultCategory}
          defaultVisibility={defaultVisibility}
          label="Attach File"
          onUploaded={() => queryClient.invalidateQueries({ queryKey: ['attachments', recordType, recordId] })}
        />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Loading attachments…</span>
        </div>
      ) : active.length === 0 && !showUpload ? (
        <p className="text-xs text-muted-foreground py-2">No attachments yet.</p>
      ) : (
        <div className="space-y-1.5">
          {active.map((att) => (
            <AttachmentRow
              key={att.id}
              att={att}
              isAdmin={isAdmin}
              onArchive={handleArchive}
              onRename={handleRename}
              onReplace={handleReplace}
              onDelete={handleDelete}
            />
          ))}

          {showArchived && archived.map((att) => (
            <div key={att.id} className="opacity-50">
              <AttachmentRow
                att={att}
                isAdmin={false}
                onArchive={() => {}}
                onRename={() => {}}
                onReplace={() => {}}
              />
            </div>
          ))}
        </div>
      )}

      <PhotoLightbox
        photos={images.map(f => f.file_url)}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNav={dir => setLightboxIndex(i => (i + dir + images.length) % images.length)}
      />
    </div>
  );
}