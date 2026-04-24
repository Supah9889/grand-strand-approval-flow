import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseCSV } from '@/lib/csvParser';

export default function CsvUploader({ onParsed }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const processFile = (file) => {
    setError('');
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a valid .csv file.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      if (rows.length === 0) {
        setError('CSV is empty or could not be parsed.');
        return;
      }
      onParsed({ headers, rows, fileName: file.name });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
          dragging ? 'border-primary bg-secondary/50' : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => processFile(e.target.files[0])}
        />
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <Upload className="w-7 h-7 text-primary" />
        </div>
        <p className="font-medium text-foreground text-sm">
          {fileName ? fileName : 'Drop CSV here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Supports Buildertrend CSV exports
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 rounded-xl px-4 py-3">
          <X className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}