import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FolderOpen, Upload, Image, FileText, File, Loader2, Plus, ExternalLink, X
} from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';
import { getInternalRole } from '@/lib/adminAuth';

const CATEGORY_OPTIONS = [
  'estimate','contract','signed_doc','proposal','change_order','invoice_support',
  'receipt','permit','before_photo','progress_photo','after_photo','punch_list_photo',
  'warranty_photo','jobsite_photo','vendor_document','internal','other'
];

const CATEGORY_COLORS = {
  before_photo:     'bg-amber-50 text-amber-700',
  progress_photo:   'bg-blue-50 text-blue-700',
  after_photo:      'bg-green-50 text-green-700',
  punch_list_photo: 'bg-orange-50 text-orange-700',
  jobsite_photo:    'bg-cyan-50 text-cyan-700',
  warranty_photo:   'bg-violet-50 text-violet-700',
  receipt:          'bg-amber-50 text-amber-700',
  contract:         'bg-primary/10 text-primary',
  estimate:         'bg-indigo-50 text-indigo-700',
  signed_doc:       'bg-green-50 text-green-700',
  internal:         'bg-muted text-muted-foreground',
};

function fileIcon(name, type) {
  if (!name && !type) return File;
  const ext = (name || '').split('.').pop().toLowerCase();
  const t = type || '';
  if (['jpg','jpeg','png','gif','webp','heic'].includes(ext) || t.startsWith('image/')) return Image;
  if (['pdf'].includes(ext) || t === 'application/pdf') return FileText;
  return File;
}

function FileCard({ file, onClick }) {
  const Icon = fileIcon(file.file_name, file.file_type);
  const catStyle = CATEGORY_COLORS[file.category] || 'bg-muted text-muted-foreground';
  const isImage = ['jpg','jpeg','png','gif','webp','heic'].includes((file.file_name || '').split('.').pop().toLowerCase()) || (file.file_type || '').startsWith('image/');

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-colors text-left group"
    >
      {isImage && file.file_url ? (
        <img
          src={file.file_url}
          alt={file.file_name}
          className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
          onError={e => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{file.file_name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${catStyle}`}>
            {file.category?.replace(/_/g, ' ')}
          </span>
          {file.uploaded_by_name && <span className="text-[10px] text-muted-foreground">{file.uploaded_by_name}</span>}
          {file.created_date && <span className="text-[10px] text-muted-foreground">{format(new Date(file.created_date), 'MMM d')}</span>}
        </div>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
    </button>
  );
}

export default function JobFilesTab({ job, isAdmin }) {
  const queryClient = useQueryClient();
  const actorName = getInternalRole();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('jobsite_photo');

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['hub-files-tab', job.id],
    queryFn: () => base44.entities.JobFile.filter({ job_id: job.id }, '-created_date'),
    enabled: !!job.id,
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.JobFile.create({
        job_id: job.id,
        job_address: job.address,
        job_title: job.title || job.address,
        file_url,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        category: selectedCategory,
        uploaded_by_name: actorName || 'admin',
        visibility: 'internal',
      });
      queryClient.invalidateQueries({ queryKey: ['hub-files-tab', job.id] });
      toast.success('File uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Group by category
  const grouped = files.reduce((acc, f) => {
    const cat = f.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  if (isLoading) return (
    <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-4">
      {/* Upload controls */}
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-9 rounded-xl text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map(c => (
                <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 h-9 px-4 bg-primary text-primary-foreground text-xs font-medium rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </button>
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileChange} />
        </div>
      )}

      {files.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No files uploaded yet</p>
          {isAdmin && <p className="text-xs text-muted-foreground mt-1">Upload photos, contracts, or documents above</p>}
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catFiles]) => (
          <div key={cat} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              {cat.replace(/_/g, ' ')} ({catFiles.length})
            </p>
            {catFiles.map(f => (
              <FileCard key={f.id} file={f} onClick={() => window.open(f.file_url, '_blank')} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}