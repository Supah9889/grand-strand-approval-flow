import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Pen, CheckCircle, Clock, AlertCircle, ExternalLink, Lock } from 'lucide-react';
import { format } from 'date-fns';

export default function JobSignatureTab({ job, isAdmin }) {
  const navigate = useNavigate();

  const isSigned = job.status === 'approved';
  const isPending = job.status === 'pending';
  const isDraft = !job.status || job.status === 'draft';

  return (
    <div className="space-y-3">
      {/* Status card */}
      <div className={`rounded-2xl p-4 border ${
        isSigned ? 'bg-green-50 border-green-200' :
        isPending ? 'bg-amber-50 border-amber-300' :
        'bg-card border-border'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isSigned ? 'bg-green-100' : isPending ? 'bg-amber-100' : 'bg-muted'
          }`}>
            {isSigned
              ? <CheckCircle className="w-5 h-5 text-green-600" />
              : isPending
                ? <Clock className="w-5 h-5 text-amber-600" />
                : <AlertCircle className="w-5 h-5 text-muted-foreground" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {isSigned ? 'Job Approved & Signed' : isPending ? 'Awaiting Signature' : 'Signature Not Yet Requested'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isSigned
                ? `Signed${job.approval_timestamp ? ` on ${format(new Date(job.approval_timestamp), 'MMM d, yyyy h:mm a')}` : ''}`
                : isPending
                  ? 'Customer has been sent a signature request'
                  : 'No signature has been collected for this job'
              }
            </p>
            {job.terms_version && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Terms version: {job.terms_version}</p>
            )}
          </div>
          {job.locked && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
              <Lock className="w-2.5 h-2.5" /> Locked
            </span>
          )}
        </div>

        {/* Approval statement if signed */}
        {isSigned && job.approval_statement && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <p className="text-xs text-green-800 italic">"{job.approval_statement}"</p>
          </div>
        )}

        {/* Signature image if available */}
        {isSigned && job.signature_url && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <p className="text-[10px] text-green-700 mb-1 font-medium">Signature on file</p>
            <img src={job.signature_url} alt="Customer signature" className="max-h-16 rounded border border-green-200" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => navigate(`/approve?jobId=${job.id}`)}
          className="w-full flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Pen className="w-4 h-4 text-primary" />
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">Open Approval / Signature Page</p>
              <p className="text-xs text-muted-foreground">View contract and collect signature</p>
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
        </button>

        {isAdmin && (
          <button
            onClick={() => navigate(`/notes`)}
            className="w-full flex items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">View Job Notes</p>
                <p className="text-xs text-muted-foreground">Internal notes and communications</p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          </button>
        )}
      </div>

      {/* Signature status info */}
      {isAdmin && (
        <div className="bg-muted/40 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Approval Record</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Status: <span className="text-foreground font-medium">{job.status || 'not set'}</span></p>
            {job.approval_timestamp && <p>Signed: <span className="text-foreground font-medium">{format(new Date(job.approval_timestamp), 'PPpp')}</span></p>}
            {job.review_rating && <p>Review rating: <span className="text-foreground font-medium">{job.review_rating}</span></p>}
            {job.review_prompt_shown && <p className="text-muted-foreground/70">Review prompt shown</p>}
          </div>
        </div>
      )}
    </div>
  );
}