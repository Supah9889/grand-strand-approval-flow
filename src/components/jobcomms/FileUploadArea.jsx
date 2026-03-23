import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Upload, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  ['before_photo','Before Photo'], ['progress_photo','Progress Photo'], ['after_photo','After Photo'],
  ['jobsite_photo','Jobsite Photo'], ['punch_list_photo','Punch List Photo'], ['warranty_photo','Warranty Photo'],
  ['estimate','Estimate'], ['contract','Contract'], ['signed_doc','Signed Document'],
  ['proposal','Proposal'], ['change_order','Change Order'], ['invoice_support','Invoice Support'],
  ['receipt','Receipt'], ['permit','Permit'], ['vendor_document','Vendor Document'],
  ['internal','Internal'], ['other','Other'],
];

export default function FileUploadArea({ jobId, jobAddress, onUploaded, onClose }) {
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('other');
  const [visibility, setVisibility] = useState('internal');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  // Photo-only categories keep image-only; document categories allow PDF too
  const PHOTO_CATEGORIES = ['before_photo','progress_photo','after_photo','jobsite_photo','punch_list_photo','warranty_photo'];
  const isDocCategory = !PHOTO_CATEGORIES.includes(category);
  const accept = isDocCategory ? 'application/pdf,image/png,image/jpeg,image/jpg' : 'image/*';
  const acceptLabel = isDocCategory ? 'PDF, PNG, JPG' : 'Images only';

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.JobFile.create({
        job_id: jobId,
        job_address: jobAddress,
        file_url,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        category,
        visibility,
        description,
        archived: false,
      });
    }
    setUploading(false);
    toast.success(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
    setFiles([]);
    setDescription('');
    onUploaded?.();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Upload Files</p>
        {onClose && <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>}
      </div>

      <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-border rounded-xl px-4 py-6 hover:border-primary/40 transition-colors text-center">
        <Upload className="w-6 h-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {files.length ? `${files.length} file${files.length > 1 ? 's' : ''} selected` : 'Click to select files'}
        </span>
        <span className="text-xs text-muted-foreground/60">Accepted: {acceptLabel}</span>
        <input type="file" multiple accept={accept} className="hidden" onChange={handleFileChange} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Visibility</label>
          <Select value={visibility} onValueChange={setVisibility}>
            <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal Only</SelectItem>
              <SelectItem value="client">Share with Client</SelectItem>
              <SelectItem value="vendor">Share with Vendor</SelectItem>
              <SelectItem value="both">Share with Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Description / Caption (optional)</label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this file" className="h-9 rounded-lg text-sm" />
      </div>

      <Button className="w-full h-10 rounded-xl gap-2" onClick={handleUpload} disabled={!files.length || uploading}>
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        {uploading ? 'Uploading...' : `Upload ${files.length ? files.length + ' file' + (files.length > 1 ? 's' : '') : ''}`}
      </Button>
    </div>
  );
}