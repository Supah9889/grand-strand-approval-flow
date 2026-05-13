import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, FileText, CheckCircle2 } from 'lucide-react';

const FILE_TYPES = [
  { key: 'jobsites',         label: 'Jobsites Export',      accept: '.xlsx,.xls,.csv', hint: 'Excel/CSV export from BT → Jobs list' },
  { key: 'daily_logs',       label: 'Daily Logs Export',    accept: '.txt,.csv',       hint: 'Text export from BT → Daily Logs' },
  { key: 'schedule_calendar',label: 'Schedule / Calendar',  accept: '.txt,.csv',       hint: 'Text export from BT → Schedule' },
];

export default function BTImportUploader({ onFilesReady, loading }) {
  const [files, setFiles] = useState({});

  const handleFile = (key, file) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, [key]: file }));
  };

  const removeFile = (key) => {
    setFiles(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const canSubmit = Object.keys(files).length > 0 && !loading;

  return (
    <div className="space-y-4">
      {FILE_TYPES.map(({ key, label, accept, hint }) => (
        <div key={key} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
              {files[key] && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="truncate max-w-xs">{files[key].name}</span>
                  <button onClick={() => removeFile(key)} className="text-muted-foreground hover:text-destructive ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept={accept}
                className="sr-only"
                onChange={e => handleFile(key, e.target.files?.[0] || null)}
              />
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                <FileText className="w-3.5 h-3.5" />
                {files[key] ? 'Replace' : 'Choose file'}
              </span>
            </label>
          </div>
        </div>
      ))}

      <Button
        disabled={!canSubmit}
        onClick={() => onFilesReady(files)}
        className="w-full h-11 gap-2"
      >
        <Upload className="w-4 h-4" />
        {loading ? 'Parsing…' : `Parse & Stage ${Object.keys(files).length} file${Object.keys(files).length !== 1 ? 's' : ''}`}
      </Button>
    </div>
  );
}