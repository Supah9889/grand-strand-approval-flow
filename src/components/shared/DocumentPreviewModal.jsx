/**
 * DocumentPreviewModal — In-app PDF/document viewer overlay.
 *
 * Props:
 *   open        boolean
 *   onClose     () => void
 *   url         string   — direct file URL
 *   title       string   — display name shown in header
 *   docType     string   — label shown as a badge (optional)
 *                          e.g. "Work Order (Original)", "Signed Work Order (Stamped)", "Approval Document"
 */

import React from 'react';
import { X, ExternalLink, Download } from 'lucide-react';

const DOC_TYPE_STYLES = {
  'Signed Work Order (Final)':    'bg-green-100 text-green-700',
  'Signed Work Order (Stamped)':  'bg-green-100 text-green-700',
  'Original Work Order':          'bg-blue-100 text-blue-700',
  'Work Order (Original)':        'bg-blue-100 text-blue-700',
  'Approval Document':            'bg-primary/10 text-primary',
};

export default function DocumentPreviewModal({ open, onClose, url, title, docType }) {
  if (!open || !url) return null;

  const badgeClass = DOC_TYPE_STYLES[docType] || 'bg-muted text-muted-foreground';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
        <button
          onClick={onClose}
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-foreground" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{title || 'Document Preview'}</p>
          {docType && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeClass}`}>
              {docType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href={url}
            download
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in tab
          </a>
        </div>
      </div>

      {/* PDF iframe */}
      <div className="flex-1 overflow-hidden bg-slate-100">
        <iframe
          src={url}
          title={title || 'Document'}
          className="w-full h-full border-0"
          allow="fullscreen"
        />
      </div>
    </div>
  );
}