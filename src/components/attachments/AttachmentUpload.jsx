/**
 * AttachmentUpload — drop-in upload widget that saves to the Attachment entity.
 * Preserves existing DocUpload behavior; adds metadata tracking on top.
 *
 * Props:
 *   recordType   — 'job' | 'expense' | 'invoice' | 'estimate' | 'bill' | etc.
 *   recordId     — ID of the parent record
 *   jobId        — optional, for cross-reference
 *   category     — default category (can be overridden by user)
 *   visibility   — default visibility ('internal' | 'client' | 'vendor' | 'both')
 *   onUploaded   — callback after successful upload (optional)
 *   label        — button label
 *   compact      — boolean — if true, renders minimal trigger only (no category/vis pickers)
 *   allowedTypes — mime string, defaults to 'application/pdf,image/png,image/jpeg,image/jpg'
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Upload, Loader2, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const DOC_ACCEPT = 'application/pdf,image/png,image/jpeg,image/jpg';

const CATEGORIES = [
  ['receipt', 'Receipt'],
  ['invoice_support', 'Invoice Support'],
  ['contract', 'Contract'],
  ['signed_doc', 'Signed Document'],
  ['estimate', 'Estimate'],
  ['proposal', 'Proposal'],
  ['change_order', 'Change Order'],
  ['permit', 'Permit'],
  ['vendor_document', 'Vendor Document'],
  ['photo', 'Photo'],
  ['internal', 'Internal'],
  ['agreement', 'Agreement'],
  ['supporting_doc', 'Supporting Document'],
  ['other', 'Other'],
];

export default function AttachmentUpload({
  recordType,
  recordId,
  jobId,
  category: defaultCategory = 'other',
  visibility: defaultVisibility = 'internal',
  onUploaded,
  label = 'Attach File',
  compact = false,
  allowedTypes = DOC_ACCEPT,
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState(defaultCategory);
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [description, setDescription] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const user = await base44.auth.me().catch(() => null);

      await base44.entities.Attachment.create({
        record_type: recordType,
        record_id: recordId,
        job_id: jobId || null,
        file_url,
        file_name: file.name,
        original_file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        category,
        visibility,
        description: description.trim() || null,
        uploaded_by: user?.email || null,
        uploaded_by_name: user?.full_name || null,
        upload_date: new Date().toISOString(),
        archived: false,
        version: 1,
      });

      queryClient.invalidateQueries({ queryKey: ['attachments', recordType, recordId] });
      toast.success('File attached');
      setDescription('');
      setExpanded(false);
      onUploaded?.({ file_url, file_name: file.name, file_type: file.type });
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (compact) {
    return (
      <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer text-primary hover:underline ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
        {uploading ? 'Uploading…' : label}
        <input type="file" accept={allowedTypes} className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2 w-full hover:border-primary/40 hover:text-foreground transition-colors"
      >
        <Paperclip className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground block mb-1">Visibility</label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal Only</SelectItem>
                  <SelectItem value="client">Share with Client</SelectItem>
                  <SelectItem value="vendor">Share with Vendor</SelectItem>
                  <SelectItem value="both">Share with Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="h-8 rounded-lg text-xs"
          />
          <label className={`flex items-center justify-center gap-2 w-full h-9 rounded-xl text-sm font-medium cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading…' : 'Choose File & Upload'}
            <input type="file" accept={allowedTypes} className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
          <button type="button" onClick={() => setExpanded(false)} className="w-full text-xs text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      )}
    </div>
  );
}