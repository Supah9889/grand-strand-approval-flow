import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CsvUploader from './CsvUploader';
import ColumnMapper from './ColumnMapper';
import ImportPreview from './ImportPreview';
import { autoMapColumns, applyMapping, detectDuplicates } from '@/lib/csvParser';

const STEPS = ['upload', 'map', 'preview', 'done'];

export default function CsvImportFlow({ existingJobs }) {
  const [step, setStep] = useState('upload');
  const [csvData, setCsvData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [mappedRows, setMappedRows] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const queryClient = useQueryClient();

  const handleParsed = (data) => {
    setCsvData(data);
    setMapping(autoMapColumns(data.headers));
    setStep('map');
  };

  const handleMappingConfirm = () => {
    const rows = applyMapping(csvData.rows, mapping);
    const dupes = detectDuplicates(rows, existingJobs);
    setMappedRows(rows);
    setDuplicates(dupes);
    setStep('preview');
  };

  const handleImport = async (decisions) => {
    setImporting(true);
    let created = 0, updated = 0, skipped = 0;

    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      const dup = duplicates[i];
      const decision = decisions[i];

      if (decision === 'skip') {
        skipped++;
      } else if (decision === 'update' && dup) {
        await base44.entities.Job.update(dup.id, row);
        updated++;
      } else {
        await base44.entities.Job.create(row);
        created++;
      }
    }

    setImporting(false);
    setImportSummary({ created, updated, skipped });
    queryClient.invalidateQueries({ queryKey: ['admin-jobs'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    setStep('done');
    toast.success(`Import complete: ${created} created, ${updated} updated, ${skipped} skipped`);
  };

  const reset = () => {
    setStep('upload');
    setCsvData(null);
    setMapping({});
    setMappedRows([]);
    setDuplicates([]);
    setImportSummary(null);
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      {step !== 'done' && (
        <div className="flex items-center gap-1.5">
          {['Upload', 'Map', 'Preview'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`h-1.5 rounded-full flex-1 transition-all ${
                i <= stepIndex - (step === 'done' ? 0 : 0)
                  ? 'bg-primary'
                  : i === stepIndex
                  ? 'bg-primary'
                  : 'bg-border'
              } ${i < stepIndex ? 'bg-primary' : i === stepIndex ? 'bg-primary' : 'bg-border'}`} />
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Back button */}
      {(step === 'map' || step === 'preview') && (
        <button
          onClick={() => setStep(step === 'preview' ? 'map' : 'upload')}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      )}

      <AnimatePresence mode="wait">
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CsvUploader onParsed={handleParsed} />
          </motion.div>
        )}
        {step === 'map' && csvData && (
          <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ColumnMapper
              csvHeaders={csvData.headers}
              mapping={mapping}
              onMappingChange={setMapping}
              onConfirm={handleMappingConfirm}
            />
          </motion.div>
        )}
        {step === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ImportPreview
              rows={mappedRows}
              duplicates={duplicates}
              onImport={handleImport}
              importing={importing}
            />
          </motion.div>
        )}
        {step === 'done' && importSummary && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8 space-y-4"
          >
            <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
            <h3 className="font-semibold text-foreground text-lg">Import Complete</h3>
            <div className="flex justify-center gap-4 text-sm">
              <span className="text-primary font-medium">{importSummary.created} created</span>
              <span className="text-muted-foreground">{importSummary.updated} updated</span>
              <span className="text-muted-foreground">{importSummary.skipped} skipped</span>
            </div>
            <Button variant="outline" className="rounded-xl" onClick={reset}>
              Import Another File
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}