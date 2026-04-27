import React, { useState } from 'react';
import { X, AlertTriangle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validateRecord } from '@/lib/exportHelpers';
import { motion } from 'framer-motion';

export default function ExportPreviewModal({ typeCfg, records, format, batchId, onConfirm, onCancel }) {
  const [includeInvalid, setIncludeInvalid] = useState(false);

  // Validate each record
  const validated = records.map(r => ({
    ...r,
    _issues: validateRecord(r, typeCfg.key),
  }));

  const valid = validated.filter(r => r._issues.length === 0);
  const needsReview = validated.filter(r => r._issues.length > 0);

  // Top issues summary
  const issueCounts = {};
  needsReview.forEach(r => r._issues.forEach(i => { issueCounts[i] = (issueCounts[i] || 0) + 1; }));
  const topIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Sample preview rows (first 5 mapped columns)
  const sampleRows = records.slice(0, 3);
  const mapped = typeCfg.mapper(sampleRows);
  const previewCols = mapped.length > 0 ? Object.keys(mapped[0]).slice(0, 6) : [];

  const exportCount = includeInvalid ? validated.length : valid.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-foreground">Export Preview</p>
            <p className="text-xs text-muted-foreground">{typeCfg.label} · {format.toUpperCase()} · Batch {batchId}</p>
          </div>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/40 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{records.length}</p>
              <p className="text-xs text-muted-foreground">Total Records</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-green-700">{valid.length}</p>
              <p className="text-xs text-green-600">Valid</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${needsReview.length > 0 ? 'bg-orange-50' : 'bg-muted/40'}`}>
              <p className={`text-lg font-bold ${needsReview.length > 0 ? 'text-orange-700' : 'text-muted-foreground'}`}>{needsReview.length}</p>
              <p className={`text-xs ${needsReview.length > 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>Needs Review</p>
            </div>
          </div>

          {/* Issue summary */}
          {topIssues.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                <p className="text-xs font-semibold text-orange-800">Top Issues Found</p>
              </div>
              <div className="space-y-1">
                {topIssues.map(([issue, count]) => (
                  <div key={issue} className="flex items-center justify-between text-xs">
                    <span className="text-orange-700">{issue}</span>
                    <span className="bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data preview */}
          {mapped.length > 0 && previewCols.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Data Preview (first 3 rows, first 6 columns)</p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="text-xs w-full min-w-max">
                  <thead>
                    <tr className="bg-muted/60">
                      {previewCols.map(col => (
                        <th key={col} className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {previewCols.map(col => (
                          <td key={col} className="px-2 py-1.5 text-foreground whitespace-nowrap max-w-[120px] truncate">{String(row[col] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Include invalid toggle */}
          {needsReview.length > 0 && (
            <label className="flex items-start gap-3 p-3 rounded-xl border border-orange-200 bg-orange-50 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInvalid}
                onChange={e => setIncludeInvalid(e.target.checked)}
                className="mt-0.5 rounded"
              />
              <div>
                <p className="text-xs font-medium text-orange-800">Include {needsReview.length} records that need review</p>
                <p className="text-xs text-orange-700 mt-0.5">These records may have missing or incomplete data. Admin override required.</p>
              </div>
            </label>
          )}

          {/* Export info */}
          <div className="bg-muted/40 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Records to export</span>
              <span className="font-semibold text-foreground">{exportCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Format</span>
              <span className="font-semibold text-foreground">{format.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Batch ID</span>
              <span className="font-semibold text-foreground font-mono">{batchId}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Export date</span>
              <span className="font-semibold text-foreground">{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-10 rounded-xl text-sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="flex-1 h-10 rounded-xl text-sm"
              disabled={exportCount === 0}
              onClick={() => onConfirm({ includeInvalid, validRecords: valid, invalidRecords: needsReview })}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Export {exportCount} Records
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}