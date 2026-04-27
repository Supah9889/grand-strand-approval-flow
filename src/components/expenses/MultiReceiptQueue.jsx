/**
 * MultiReceiptQueue — manages sequential review of multiple receipts
 * detected in a single uploaded file.
 *
 * Props:
 *   receipts    — array of parsed receipt objects
 *   fileUrl     — original uploaded file URL
 *   fileName    — original file name
 *   jobs        — job list
 *   onSaveOne   — (expenseData, index) => Promise<void>
 *   onDone      — () => void  (called after all receipts confirmed)
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import ExpenseEditScreen from './ExpenseEditScreen';

export default function MultiReceiptQueue({ receipts, fileUrl, fileName, jobs, onSaveOne, onDone }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState([]); // indices confirmed

  const total = receipts.length;
  const current = receipts[currentIndex];
  const allDone = confirmed.length === total;

  const handleSave = async (data) => {
    setSaving(true);
    await onSaveOne({
      ...data,
      source_file_url:      fileUrl,
      source_file_name:     fileName,
      source_receipt_index: currentIndex + 1,
      source_receipt_total: total,
    }, currentIndex);
    setSaving(false);
    setConfirmed(prev => [...prev, currentIndex]);
    if (currentIndex < total - 1) {
      setCurrentIndex(i => i + 1);
    }
  };

  if (allDone) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">All {total} receipts confirmed</p>
          <p className="text-xs text-muted-foreground mt-0.5">Each receipt has been saved as its own expense entry.</p>
        </div>
        <Button className="h-9 rounded-xl text-sm" onClick={onDone}>Return to Inbox</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">Receipt {currentIndex + 1} of {total}</span>
          <span className="text-muted-foreground">{confirmed.length} confirmed</span>
        </div>
        <div className="flex gap-1">
          {receipts.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${
              confirmed.includes(i) ? 'bg-green-500' :
              i === currentIndex ? 'bg-primary' : 'bg-border'
            }`} />
          ))}
        </div>
      </div>

      {/* Current receipt editor */}
      <ExpenseEditScreen
        key={currentIndex}
        initialData={current}
        fileUrl={fileUrl}
        fileName={fileName}
        jobs={jobs}
        onSave={handleSave}
        onCancel={onDone}
        saving={saving}
        progressLabel={`Receipt ${currentIndex + 1} of ${total} — ${fileName || 'uploaded file'}`}
      />
    </div>
  );
}