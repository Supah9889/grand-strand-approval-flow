import React, { useState } from 'react';
import { Copy, Download, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Renders parse warnings / diagnostics in a copy-friendly way.
 * Props:
 *   lines    {string[]}  — array of warning/diagnostic strings
 *   label    {string}    — section title
 *   fileName {string}    — optional: used as download filename prefix
 */
export default function BTDiagnosticsPanel({ lines = [], label = 'Parse diagnostics', fileName = 'bt-diagnostics' }) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!lines.length) return null;

  const fullText = lines.join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([fullText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-200">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 flex-1 text-left"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {label} ({lines.length})
        </button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
          onClick={handleCopy}
        >
          {copied ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-[11px] gap-1 border-amber-300 text-amber-800 hover:bg-amber-100"
          onClick={handleDownload}
        >
          <Download className="w-3 h-3" />
          Download
        </Button>
      </div>

      {/* Selectable pre block */}
      {expanded && (
        <pre
          className="px-4 py-3 text-xs text-amber-900 whitespace-pre-wrap break-words max-h-72 overflow-y-auto leading-relaxed"
          style={{ userSelect: 'text', WebkitUserSelect: 'text', cursor: 'text' }}
        >
          {fullText}
        </pre>
      )}
    </div>
  );
}