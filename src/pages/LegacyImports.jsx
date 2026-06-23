import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { getCurrentCompany } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Upload, FileText, AlertCircle, CheckCircle2, Clock, Archive, Loader2, Plus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import AppLayout from '@/components/AppLayout';

const STATUS_CONFIG = {
  uploaded:     { label: 'Uploaded',     color: 'bg-blue-100 text-blue-800' },
  processing:   { label: 'Processing',   color: 'bg-yellow-100 text-yellow-800' },
  imported:     { label: 'Imported',     color: 'bg-green-100 text-green-800' },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-800' },
  error:        { label: 'Error',        color: 'bg-red-100 text-red-800' },
  archived:     { label: 'Archived',     color: 'bg-muted text-muted-foreground' },
};

const IMPORT_TYPES = [
  { value: 'csv',    label: 'CSV Export' },
  { value: 'zip',    label: 'ZIP Archive' },
  { value: 'pdf',    label: 'PDF Report' },
  { value: 'manual', label: 'Manual Entry' },
];

export default function LegacyImports() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const company = getCurrentCompany();
  const fileRef = useRef(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ import_type: 'csv', source_system: 'Proven Jobs', notes: '' });
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ['legacy-imports', company?.id],
    queryFn: () => base44.entities.LegacyImport.filter({ company_id: company?.id }, '-created_date', 50),
    enabled: !!company?.id,
  });

  const createImport = useMutation({
    mutationFn: async (data) => base44.entities.LegacyImport.create(data),
    onSuccess: (record) => {
      logAudit('legacy_import_uploaded', 'LegacyImport', record.id, {
        source_system: record.source_system,
        import_type: record.import_type,
      });
      qc.invalidateQueries(['legacy-imports']);
      setShowForm(false);
      setForm({ import_type: 'csv', source_system: 'Proven Jobs', notes: '' });
      setSelectedFile(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.LegacyImport.update(id, { status }),
    onSuccess: () => qc.invalidateQueries(['legacy-imports']),
  });

  const handleSubmit = async () => {
    if (!company?.id) return;
    setUploading(true);
    try {
      let file_url = null;
      let file_name = null;
      if (selectedFile && form.import_type !== 'manual') {
        const { file_url: url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
        file_url = url;
        file_name = selectedFile.name;
      }
      await createImport.mutateAsync({
        company_id: company.id,
        company_slug: company.slug,
        source_system: form.source_system || 'Proven Jobs',
        import_type: form.import_type,
        original_file: file_url,
        original_file_name: file_name,
        uploaded_by: user?.full_name,
        uploaded_at: new Date().toISOString(),
        status: 'uploaded',
        notes: form.notes,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout title="Legacy Imports">
      <div className="app-page space-y-5">
        {/* Header */}
        <div className="app-page-header">
          <div>
            <h1 className="app-page-title">Legacy Imports</h1>
            <p className="app-page-subtitle">Import Proven Jobs history and manage migration bridge records</p>
          </div>
          <div className="app-page-actions">
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries(['legacy-imports'])}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button size="sm" onClick={() => setShowForm(v => !v)}>
              <Plus className="w-4 h-4" /> New Import
            </Button>
          </div>
        </div>

        {/* New Import Form */}
        {showForm && (
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">New Legacy Import</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Source System</label>
                <input
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={form.source_system}
                  onChange={e => setForm(f => ({ ...f, source_system: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Import Type</label>
                <select
                  className="w-full h-9 px-3 rounded-lg border border-input bg-card text-sm"
                  value={form.import_type}
                  onChange={e => setForm(f => ({ ...f, import_type: e.target.value }))}
                >
                  {IMPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {form.import_type !== 'manual' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Upload File</label>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {selectedFile ? selectedFile.name : 'Click to select file'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">CSV, ZIP, or PDF</p>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".csv,.zip,.pdf"
                    onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-input bg-card text-sm resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this import batch..."
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit} disabled={uploading || createImport.isPending}>
                {(uploading || createImport.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Import Record
              </Button>
            </div>
          </div>
        )}

        {/* Stats */}
        {imports.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(STATUS_CONFIG).slice(0, 4).map(([key, cfg]) => {
              const count = imports.filter(i => i.status === key).length;
              return (
                <div key={key} className="bg-card border border-border rounded-xl p-3">
                  <p className="text-xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Import History */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Import History</p>

          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && imports.length === 0 && (
            <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No imports yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first legacy import to begin migration</p>
            </div>
          )}

          {imports.map(imp => {
            const cfg = STATUS_CONFIG[imp.status] || STATUS_CONFIG.uploaded;
            return (
              <div key={imp.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{imp.source_system}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs text-muted-foreground capitalize">{imp.import_type}</span>
                  </div>
                  {imp.original_file_name && (
                    <p className="text-xs text-muted-foreground truncate">{imp.original_file_name}</p>
                  )}
                  {imp.notes && <p className="text-xs text-muted-foreground mt-0.5">{imp.notes}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-muted-foreground">By {imp.uploaded_by || 'Unknown'}</span>
                    {imp.uploaded_at && (
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(imp.uploaded_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    )}
                    {imp.record_count != null && (
                      <span className="text-[11px] text-muted-foreground">{imp.record_count} records</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {imp.original_file && (
                    <a href={imp.original_file} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">View File</Button>
                    </a>
                  )}
                  {imp.status === 'uploaded' && (
                    <Button size="sm" variant="outline"
                      onClick={() => updateStatus.mutate({ id: imp.id, status: 'imported' })}>
                      Mark Imported
                    </Button>
                  )}
                  {imp.status !== 'archived' && (
                    <Button size="sm" variant="ghost"
                      onClick={() => updateStatus.mutate({ id: imp.id, status: 'archived' })}>
                      <Archive className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}