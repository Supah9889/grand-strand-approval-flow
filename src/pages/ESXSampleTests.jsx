import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getCurrentCompany } from '@/lib/permissions';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { audit } from '@/lib/audit';
import { inspectEsxFile, summarizeExtraction } from '@/lib/safeEsxInspector';
import {
  Upload, Loader2, CheckCircle2, AlertTriangle, Eye, Archive, Trash2, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  uploaded: { label: 'Uploaded', color: 'bg-blue-100 text-blue-700' },
  parsed: { label: 'Parsed', color: 'bg-green-100 text-green-700' },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-700' },
  mapping_approved: { label: 'Mapping Approved', color: 'bg-emerald-100 text-emerald-700' },
  parser_failed: { label: 'Parser Failed', color: 'bg-red-100 text-red-700' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-700' },
};

export default function ESXSampleTests() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();
  const fileRef = React.useRef(null);
  const [uploading, setUploading] = useState(false);
  const [viewTarget, setViewTarget] = useState(null);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['esx-sample-tests', company?.id],
    queryFn: () => base44.entities.ESXSampleTest.filter(
      { company_id: company?.id },
      '-uploaded_at',
      100
    ),
    enabled: !!company?.id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploading(true);
      try {
        // Upload file
        const { file_url } = await base44.integrations.Core.UploadFile({ file });

        // Read file content for inspection
        const fileContent = await file.text();

        // Run safe inspection
        const inspection = inspectEsxFile(fileContent);

        // Create sample test record
        const test = await base44.entities.ESXSampleTest.create({
          company_id: company.id,
          company_slug: company.slug,
          file_name: file.name,
          file_url,
          uploaded_by: user?.full_name,
          uploaded_at: new Date().toISOString(),
          parser_status: inspection.extractedLineItems.length > 0 ? 'parsed' : 'parser_failed',
          readable_fields: JSON.stringify(inspection.readableFields),
          unreadable_fields: JSON.stringify(inspection.unreadableFields),
          extracted_line_items: JSON.stringify(inspection.extractedLineItems),
          extraction_notes: inspection.extractionNotes.join('\n'),
          classifier_result_summary: JSON.stringify(summarizeExtraction(inspection)),
        });

        audit.system.settingsChanged(user?.full_name, `ESX sample test uploaded: ${file.name}`, {
          module: 'esx',
          action: 'esx_sample_uploaded',
          record_id: test.id,
          company: company.id,
        });

        qc.invalidateQueries(['esx-sample-tests', company?.id]);
        toast.success(`${file.name} inspected and ready for review`);
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
  });

  const approveMappingMutation = useMutation({
    mutationFn: async ({ test, mapping }) => {
      await base44.entities.ESXSampleTest.update(test.id, {
        parser_status: 'mapping_approved',
        approved_mapping_changes: JSON.stringify(mapping),
      });
      audit.system.settingsChanged(user?.full_name, `ESX sample mapping approved: ${test.file_name}`, {
        module: 'esx',
        action: 'esx_sample_mapping_approved',
        record_id: test.id,
        company: company.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-sample-tests', company?.id]);
      setViewTarget(null);
      toast.success('Mapping approved');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (test) => {
      await base44.entities.ESXSampleTest.update(test.id, { status: 'archived' });
      audit.system.settingsChanged(user?.full_name, `ESX sample archived: ${test.file_name}`, {
        module: 'esx',
        action: 'esx_sample_archived',
        record_id: test.id,
        company: company.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-sample-tests', company?.id]);
      toast.success('Test archived');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (test) => {
      await base44.entities.ESXSampleTest.delete(test.id);
    },
    onSuccess: () => {
      qc.invalidateQueries(['esx-sample-tests', company?.id]);
      toast.success('Test deleted');
    },
  });

  const activeTests = tests.filter(t => t.status !== 'archived');

  return (
    <AppLayout title="ESX Sample Tests">
      <div className="app-page max-w-6xl space-y-4">

        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">ESX Sample Testing</h1>
            <p className="app-page-subtitle">Upload and inspect real ESX files before relying on automatic classification</p>
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".esx,.xml,.csv"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
              }}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || uploadMutation.isPending}
              className="gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload ESX File
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-blue-900">Safe Inspection Only</p>
          <p className="text-xs text-blue-700">
            This tool safely inspects exported ESX files from Xactimate to identify readable fields.
            It does not decrypt, modify, or access proprietary pricing libraries. Reviewers can manually map extracted content to work orders.
          </p>
        </div>

        {/* Tests List */}
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : activeTests.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No ESX sample tests yet. Upload a file to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {activeTests.map(test => {
              const cfg = STATUS_CONFIG[test.parser_status];
              const summary = (() => {
                try { return JSON.parse(test.classifier_result_summary || '{}'); } catch { return {}; }
              })();

              return (
                <div
                  key={test.id}
                  className="bg-card border border-border rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <p className="font-semibold text-foreground">{test.file_name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uploaded by {test.uploaded_by} on {format(new Date(test.uploaded_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {test.parser_status !== 'archived' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewTarget(test)}
                            className="h-8 px-2"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => archiveMutation.mutate(test)}
                            className="h-8 px-2 text-amber-700"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(test)}
                        className="h-8 px-2 text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-xs font-semibold text-muted-foreground">Line Items</p>
                      <p className="text-lg font-bold text-foreground">{summary.totalLineItems || 0}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-xs font-semibold text-muted-foreground">Readable Fields</p>
                      <p className="text-lg font-bold text-green-600">{summary.readableFieldCount || 0}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-xs font-semibold text-muted-foreground">Unreadable</p>
                      <p className="text-lg font-bold text-orange-600">{summary.unreadableFieldCount || 0}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2">
                      <p className="text-xs font-semibold text-muted-foreground">Encrypted</p>
                      <p className="text-lg font-bold">{summary.hasEncryption ? '⚠️' : '—'}</p>
                    </div>
                  </div>

                  {/* Notes */}
                  {test.extraction_notes && (
                    <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                      {test.extraction_notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Detail Modal */}
      {viewTarget && (
        <ESXSampleTestModal
          test={viewTarget}
          onClose={() => setViewTarget(null)}
          onApproveMapping={(mapping) => approveMappingMutation.mutate({ test: viewTarget, mapping })}
          user={user}
        />
      )}
    </AppLayout>
  );
}

/**
 * Detail view modal with mapping review
 */
function ESXSampleTestModal({ test, onClose, onApproveMapping, user }) {
  const [mapping, setMapping] = useState({
    title_field: '',
    description_field: '',
    service_line_field: '',
    company_field: '',
    labor_category_field: '',
  });

  const readableFields = (() => {
    try { return JSON.parse(test.readable_fields || '[]'); } catch { return []; }
  })();
  const lineItems = (() => {
    try { return JSON.parse(test.extracted_line_items || '[]'); } catch { return []; }
  })();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">ESX Sample Test: {test.file_name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Readable Fields */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Readable Fields</p>
            <div className="space-y-1">
              {readableFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                readableFields.map(field => (
                  <div key={field} className="bg-green-50 border border-green-200 rounded px-2 py-1 text-xs">
                    {field}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sample Line Item */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Sample Line Item</p>
            {lineItems.length > 0 ? (
              <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1">
                {Object.entries(lineItems[0]).map(([k, v]) => (
                  <div key={k}>
                    <strong>{k}:</strong> {String(v).substring(0, 60)}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No line items extracted</p>
            )}
          </div>
        </div>

        {/* Mapping Review */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-sm font-semibold">Map Fields to Work Order Template</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'title_field', label: 'Title Field' },
              { key: 'description_field', label: 'Description Field' },
              { key: 'service_line_field', label: 'Service Line Field' },
              { key: 'company_field', label: 'Company Field' },
              { key: 'labor_category_field', label: 'Labor Category Field' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-semibold text-muted-foreground">{label}</label>
                <select
                  value={mapping[key]}
                  onChange={e => setMapping(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full h-9 px-2 rounded-lg border border-input bg-card text-sm mt-1"
                >
                  <option value="">—</option>
                  {readableFields.map(field => (
                    <option key={field} value={field}>{field}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => onApproveMapping(mapping)}>Approve Mapping</Button>
        </div>
      </div>
    </div>
  );
}