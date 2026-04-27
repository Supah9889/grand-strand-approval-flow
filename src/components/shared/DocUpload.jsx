import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Paperclip, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

export const DOC_ACCEPT = 'application/pdf,image/png,image/jpeg,image/jpg';
export const DOC_ACCEPT_LABEL = 'PDF, PNG, JPG';

/**
 * Shared document upload row used across Bills, Expenses, Invoices, etc.
 *
 * Props:
 *   fileUrl      — current stored file URL string
 *   fileName     — current stored file name string (optional, for display)
 *   onUploaded   — (file_url, file_name, file_type) => void
 *   label        — display label (default: "Attach Document")
 *   disabled     — boolean
 *   className    — extra wrapper class
 */
export default function DocUpload({ fileUrl, fileName, onUploaded, label = 'Attach Document', disabled = false, className = '' }) {
  const [uploading, setUploading] = useState(false);

  const isPDF = fileUrl && (fileUrl.includes('.pdf') || (fileName && fileName.toLowerCase().endsWith('.pdf')));

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|png|jpg|jpeg)$/i)) {
      toast.error(`Unsupported file type. Accepted: ${DOC_ACCEPT_LABEL}`);
      return;
    }

    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setUploading(false);
    onUploaded(file_url, file.name, file.type);
    toast.success('File attached');
  };

  return (
    <div className={className}>
      <label className={`flex items-center gap-2 cursor-pointer border border-dashed rounded-lg px-3 py-2 text-xs transition-colors
        ${disabled || uploading ? 'opacity-60 pointer-events-none' : 'border-border hover:border-primary/40 hover:text-foreground'}
        text-muted-foreground`}
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Paperclip className="w-3.5 h-3.5 shrink-0" />}
        <span className="flex-1 truncate">
          {uploading ? 'Uploading…' : fileUrl ? (fileName || 'File attached — change file') : label}
        </span>
        <span className="text-muted-foreground/50 shrink-0">PDF, PNG, JPG</span>
        <input type="file" accept={DOC_ACCEPT} className="hidden" onChange={handleChange} disabled={disabled || uploading} />
      </label>

      {fileUrl && !uploading && (
        <div className="flex items-center gap-2 mt-1.5">
          {isPDF ? (
            <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-mono">
              <FileText className="w-3 h-3" /> PDF
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">
              IMG
            </span>
          )}
          <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate">
            {fileName || 'View attached file'}
          </a>
        </div>
      )}
    </div>
  );
}