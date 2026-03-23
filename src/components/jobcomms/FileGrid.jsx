import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { FileText, Image, Lock, Users, Eye, Archive, MoreVertical, Download, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import PhotoLightbox from '../dailylogs/PhotoLightbox';

const IMAGE_TYPES = ['image/jpeg','image/png','image/webp','image/gif','image/jpg'];
const isImage = (f) => IMAGE_TYPES.includes(f.file_type) || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.file_name || '');
const isPDF = (f) => f.file_type === 'application/pdf' || /\.pdf$/i.test(f.file_name || '') || /\.pdf/i.test(f.file_url || '');

const VISIBILITY_BADGE = {
  internal: { label: 'Internal', color: 'bg-slate-100 text-slate-600', icon: Lock },
  client:   { label: 'Client',   color: 'bg-blue-100 text-blue-700',   icon: Eye },
  vendor:   { label: 'Vendor',   color: 'bg-amber-100 text-amber-700', icon: Users },
  both:     { label: 'Both',     color: 'bg-green-100 text-green-700', icon: Users },
};

const CATEGORY_LABEL = {
  before_photo: 'Before', progress_photo: 'Progress', after_photo: 'After',
  jobsite_photo: 'Jobsite', punch_list_photo: 'Punch List', warranty_photo: 'Warranty',
  estimate: 'Estimate', contract: 'Contract', signed_doc: 'Signed', proposal: 'Proposal',
  change_order: 'Change Order', invoice_support: 'Invoice', receipt: 'Receipt',
  permit: 'Permit', vendor_document: 'Vendor Doc', internal: 'Internal', other: 'Other',
};

function FileCard({ file, onImageClick }) {
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  const vis = VISIBILITY_BADGE[file.visibility] || VISIBILITY_BADGE.internal;
  const VisIcon = vis.icon;
  const isImg = isImage(file);

  const archive = async () => {
    await base44.entities.JobFile.update(file.id, { archived: true });
    queryClient.invalidateQueries({ queryKey: ['job-files', file.job_id] });
    toast.success('File archived');
    setShowMenu(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden group relative">
      {/* Preview area */}
      {isImg ? (
        <button onClick={onImageClick} className="block w-full aspect-video bg-muted hover:opacity-90 transition-opacity overflow-hidden">
          <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
        </button>
      ) : (
        <a href={file.file_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center aspect-video bg-muted hover:bg-muted/80 transition-colors">
          <FileText className="w-10 h-10 text-muted-foreground/50" />
        </a>
      )}

      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-foreground truncate flex-1">{file.file_name}</p>
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:bg-muted">
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-7 z-20 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[120px]">
                <a href={file.file_url} target="_blank" rel="noopener noreferrer" download
                  className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <button onClick={archive} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left">
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {file.category && (
            <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded-md">
              {CATEGORY_LABEL[file.category] || file.category}
            </span>
          )}
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${vis.color}`}>
            <VisIcon className="w-3 h-3" />{vis.label}
          </span>
        </div>

        {file.description && <p className="text-xs text-muted-foreground line-clamp-1">{file.description}</p>}
        <p className="text-xs text-muted-foreground/60">
          {file.uploaded_by_name ? `${file.uploaded_by_name} · ` : ''}
          {file.created_date ? format(parseISO(file.created_date), 'MMM d, yyyy') : ''}
        </p>
      </div>
    </div>
  );
}

export default function FileGrid({ files }) {
  const images = files.filter(isImage);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  return (
    <>
      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No files uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f) => (
            <FileCard
              key={f.id}
              file={f}
              onImageClick={() => {
                const imgIdx = images.findIndex(i => i.id === f.id);
                if (imgIdx >= 0) setLightboxIndex(imgIdx);
              }}
            />
          ))}
        </div>
      )}
      <PhotoLightbox
        photos={images.map(f => f.file_url)}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNav={dir => setLightboxIndex(i => (i + dir + images.length) % images.length)}
      />
    </>
  );
}