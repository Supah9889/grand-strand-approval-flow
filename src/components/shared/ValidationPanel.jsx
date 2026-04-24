/**
 * ValidationPanel — reusable component to display validation issues inline.
 *
 * Props:
 *   issues     — array of { field, message, level }  from lib/validation.js
 *   title      — optional heading override
 *   className  — extra wrapper class
 *   compact    — boolean, show single-line compact mode
 */
import React, { useState } from 'react';
import { AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function ValidationPanel({ issues = [], title, className = '', compact = false }) {
  const [expanded, setExpanded] = useState(true);

  if (!issues || issues.length === 0) return null;

  const errors   = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  if (compact) {
    return (
      <div className={`flex flex-wrap gap-1.5 ${className}`}>
        {errors.map((issue, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
            <XCircle className="w-2.5 h-2.5 shrink-0" /> {issue.message}
          </span>
        ))}
        {warnings.map((issue, i) => (
          <span key={i} className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> {issue.message}
          </span>
        ))}
      </div>
    );
  }

  const headingColor = errors.length > 0 ? 'text-red-700' : 'text-amber-700';
  const borderColor  = errors.length > 0 ? 'border-red-200' : 'border-amber-200';
  const bgColor      = errors.length > 0 ? 'bg-red-50' : 'bg-amber-50';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden ${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-2.5 ${headingColor}`}
      >
        <div className="flex items-center gap-2">
          {errors.length > 0
            ? <XCircle className="w-3.5 h-3.5 shrink-0" />
            : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          <span className="text-xs font-semibold">
            {title || (errors.length > 0
              ? `${errors.length} issue${errors.length > 1 ? 's' : ''} must be fixed`
              : `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`)}
          </span>
          {(errors.length > 0 && warnings.length > 0) && (
            <span className="text-[10px] opacity-70">+ {warnings.length} warning{warnings.length > 1 ? 's' : ''}</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1">
          {errors.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700">
              <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
          {warnings.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}