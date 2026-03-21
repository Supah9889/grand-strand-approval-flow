import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TERMS_VERSION } from '@/lib/terms';

export default function TermsOfService() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-primary text-sm font-medium underline underline-offset-2 flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        View Terms of Service
        <span className="text-xs text-muted-foreground font-normal">({TERMS_VERSION})</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {expanded && (
        <div className="mt-3 p-4 bg-muted/50 rounded-xl text-xs text-muted-foreground leading-relaxed max-h-48 overflow-y-auto space-y-2">
          <p className="font-medium text-foreground text-sm">Terms of Service <span className="text-muted-foreground font-normal">({TERMS_VERSION})</span></p>
          <p>By signing this approval, you ("Customer") agree to the following terms with Grand Strand Custom Painting ("Company"):</p>
          <p><strong>1. Scope of Work:</strong> The Company will perform the painting services described in the job details above. Any changes to the scope must be agreed upon in writing by both parties.</p>
          <p><strong>2. Payment:</strong> The total price listed is due upon completion of the work unless otherwise agreed. Payment terms are net 30 days from invoice date.</p>
          <p><strong>3. Warranty:</strong> The Company warrants workmanship for a period of two (2) years from the date of completion. This warranty does not cover damage caused by neglect, abuse, or acts of nature.</p>
          <p><strong>4. Liability:</strong> The Company carries general liability insurance. The Company is not responsible for pre-existing conditions not disclosed prior to the start of work.</p>
          <p><strong>5. Cancellation:</strong> Either party may cancel with 48 hours written notice. Cancellation after work has begun may be subject to charges for work completed.</p>
          <p><strong>6. Customer Responsibilities:</strong> The Customer agrees to provide reasonable access to the work area and to remove or protect personal property in the work area.</p>
          <p><strong>7. Electronic Signature:</strong> By providing your electronic signature, you acknowledge that it carries the same legal weight as a handwritten signature.</p>
        </div>
      )}
    </div>
  );
}