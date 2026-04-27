import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Download, Database, History, Filter, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  EXPORT_TYPES, buildCSV, downloadCSV, downloadXLSX, EXPORT_STATUS_CONFIG, getExportStatus,
} from '@/lib/exportHelpers';
import { getInternalRole } from '@/lib/adminAuth';
import ExportTypeSelector from './export/ExportTypeSelector';
import ExportFilters from './export/ExportFilters';
import ExportPreviewModal from './export/ExportPreviewModal';
import ExportHistory from './export/ExportHistory';

// ── Fetch functions by entity ────────────────────────────────────────────────
const ENTITY_FETCHERS = {
  Lead:      () => base44.entities.Lead.list('-created_date', 1000),
  Job:       () => base44.entities.Job.list('-created_date', 1000),
  Estimate:  () => base44.entities.Estimate.list('-created_date', 1000),
  Invoice:   () => base44.entities.Invoice.list('-invoice_date', 1000),
  Expense:   () => base44.entities.Expense.list('-created_date', 1000),
  Bill:      () => base44.entities.Bill.list('-bill_date', 1000),
  Vendor:    () => base44.entities.Vendor.list('company_name', 500),
  TimeEntry: () => base44.entities.TimeEntry.list('-clock_in', 2000),
  CostCode:  () => base44.entities.CostCode.list('name', 500),
};

const EMPTY_FILTERS = {
  dateFrom: '', dateTo: '', exportStatus: 'all', recordStatus: 'all',
  jobId: 'all', employeeId: 'all', vendorId: 'all', includeArchived: false,
};

function generateBatchId(batchCount) {
  const year = new Date().getFullYear();
  return `BATCH-${year}-${String(batchCount + 1).padStart(3, '0')}`;
}

export default function QBExportPanel() {
  const role = getInternalRole();
  const queryClient = useQueryClient();

  const [activeType, setActiveType] = useState('invoices');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [exportFormat, setExportFormat] = useState('csv');
  const [showPreview, setShowPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  const typeCfg = EXPORT_TYPES.find(t => t.key === activeType);

  // ── Data fetches ────────────────────────────────────────────────────────────
  const { data: rawRecords = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['export-records', typeCfg?.entity],
    queryFn: () => ENTITY_FETCHERS[typeCfg?.entity]?.() || Promise.resolve([]),
    enabled: !!typeCfg?.entity,
    staleTime: 30000,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['export-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 500),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['export-employees'],
    queryFn: () => base44.entities.Employee.list('name', 200),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ['export-vendors'],
    queryFn: () => base44.entities.Vendor.list('company_name', 200),
  });
  const { data: batches = [] } = useQuery({
    queryKey: ['qb-export-batches'],
    queryFn: () => base44.entities.QBExportBatch.list('-created_date', 50),
  });

  const createBatch = useMutation({
    mutationFn: d => base44.entities.QBExportBatch.create(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qb-export-batches'] }),
  });

  // ── Apply filters ───────────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    if (!typeCfg) return [];
    return rawRecords.filter(r => {
      // Archived filter
      if (!filters.includeArchived) {
        if (r.lifecycle_status === 'archived' || r.status === 'archived' || r.archived === true) return false;
      }

      // Export status filter (computed)
      if (filters.exportStatus !== 'all') {
        const es = getExportStatus(r, typeCfg.key);
        if (es !== filters.exportStatus) return false;
      }

      // Date filter
      if (typeCfg.dateField && (filters.dateFrom || filters.dateTo)) {
        const d = (r[typeCfg.dateField] || r.created_date || '').split('T')[0];
        if (filters.dateFrom && d < filters.dateFrom) return false;
        if (filters.dateTo && d > filters.dateTo) return false;
      }

      // Job filter
      if (filters.jobId !== 'all' && r.job_id !== filters.jobId) return false;

      // Employee filter
      if (filters.employeeId !== 'all' && r.employee_id !== filters.employeeId) return false;

      // Vendor filter
      if (filters.vendorId !== 'all' && r.vendor_id !== filters.vendorId) return false;

      return true;
    });
  }, [rawRecords, filters, typeCfg]);

  // ── Status breakdown ────────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    const counts = { not_exported: 0, ready: 0, exported: 0, needs_review: 0 };
    rawRecords.forEach(r => {
      const es = getExportStatus(r, activeType);
      counts[es] = (counts[es] || 0) + 1;
    });
    return counts;
  }, [rawRecords, activeType]);

  // ── Record counts for type selector ────────────────────────────────────────
  // We pre-load counts per type lazily
  const recordCounts = { [activeType]: filteredRecords.length };

  // ── Export action ───────────────────────────────────────────────────────────
  const handleExportConfirm = async ({ includeInvalid, validRecords, invalidRecords }) => {
    setExporting(true);
    setShowPreview(false);

    const toExport = includeInvalid
      ? [...validRecords, ...invalidRecords].map(r => { const { _issues, ...rest } = r; return rest; })
      : validRecords.map(r => { const { _issues, ...rest } = r; return rest; });

    if (!toExport.length) {
      toast.error('No records to export');
      setExporting(false);
      return;
    }

    const batchId = generateBatchId(batches.length);
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const filename = `${activeType}_export_${batchId}_${dateStr}.${exportFormat}`;

    try {
      const mapped = typeCfg.mapper(toExport);

      if (exportFormat === 'csv') {
        const csv = buildCSV(mapped);
        downloadCSV(csv, filename);
      } else {
        downloadXLSX(mapped, filename);
      }

      await createBatch.mutateAsync({
        batch_number: batchId,
        export_type: activeType,
        export_format: exportFormat,
        status: 'completed',
        record_count: filteredRecords.length,
        exported_count: toExport.length,
        failed_count: includeInvalid ? 0 : invalidRecords.length,
        date_range_start: filters.dateFrom || '',
        date_range_end: filters.dateTo || '',
        exported_by: role || 'admin',
        exported_at: new Date().toISOString(),
        notes: `${toExport.length} ${typeCfg.label} records exported as ${exportFormat.toUpperCase()}. ${invalidRecords.length > 0 && !includeInvalid ? `${invalidRecords.length} records skipped (needs review).` : ''}`,
      });

      toast.success(`Exported ${toExport.length} ${typeCfg.label} records as ${exportFormat.toUpperCase()}`);
    } catch (err) {
      // Log failed batch
      await createBatch.mutateAsync({
        batch_number: batchId,
        export_type: activeType,
        export_format: exportFormat,
        status: 'failed',
        record_count: filteredRecords.length,
        exported_count: 0,
        failed_count: filteredRecords.length,
        exported_by: role || 'admin',
        exported_at: new Date().toISOString(),
        notes: 'Export failed: ' + (err?.message || 'unknown error'),
      });
      toast.error('Export failed — ' + (err?.message || 'unknown error'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Database className="w-4 h-4 text-emerald-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Export Tools</p>
          <p className="text-xs text-muted-foreground">Generate structured export files for accounting & reporting</p>
        </div>
      </div>

      <Tabs defaultValue="export">
        <TabsList className="w-full grid grid-cols-2 rounded-xl h-9 mb-4">
          <TabsTrigger value="export" className="rounded-lg text-xs gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg text-xs gap-1.5">
            <History className="w-3.5 h-3.5" /> History ({batches.length})
          </TabsTrigger>
        </TabsList>

        {/* ── EXPORT TAB ── */}
        <TabsContent value="export" className="mt-0 space-y-4">

          {/* Type selector */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Record Type</p>
            <ExportTypeSelector
              activeType={activeType}
              onSelect={(k) => { setActiveType(k); setFilters(EMPTY_FILTERS); }}
              recordCounts={recordCounts}
            />
          </div>

          {/* Status breakdown */}
          {!loadingRecords && rawRecords.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">{typeCfg?.label} · {rawRecords.length} total records</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(statusBreakdown).filter(([, c]) => c > 0).map(([status, count]) => (
                  <button
                    key={status}
                    onClick={() => setFilters(f => ({ ...f, exportStatus: f.exportStatus === status ? 'all' : status }))}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                      filters.exportStatus === status ? 'border-primary bg-secondary' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                      status === 'ready' ? 'bg-blue-500' :
                      status === 'exported' ? 'bg-green-500' :
                      status === 'needs_review' ? 'bg-orange-500' : 'bg-slate-400'
                    }`} />
                    <span className="text-muted-foreground">{EXPORT_STATUS_CONFIG[status]?.label}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border">
            <div className="flex items-center gap-1.5 mb-3">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">Filters</p>
            </div>
            <ExportFilters
              typeCfg={typeCfg}
              filters={filters}
              onChange={setFilters}
              jobs={jobs}
              employees={employees}
              vendors={vendors}
            />
          </div>

          {/* Format selector */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2">Export Format</p>
            <div className="grid grid-cols-2 gap-2">
              {['csv', 'xlsx'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setExportFormat(fmt)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-colors ${
                    exportFormat === fmt
                      ? 'border-primary bg-secondary text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase">{fmt}</p>
                    <p className="text-xs opacity-70">{fmt === 'csv' ? 'Spreadsheet / import' : 'Excel workbook'}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Record count info */}
          {loadingRecords ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading records…</p>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{filteredRecords.length}</span> records match current filters
                {rawRecords.length !== filteredRecords.length && (
                  <span className="ml-1">(of {rawRecords.length} total)</span>
                )}
              </p>
              {filteredRecords.length === 0 && (
                <span className="text-xs text-amber-600">No records</span>
              )}
            </div>
          )}

          {/* Export button */}
          <button
            onClick={() => setShowPreview(true)}
            disabled={exporting || loadingRecords || filteredRecords.length === 0}
            className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {exporting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
              : <><Download className="w-4 h-4" /> Preview &amp; Export {filteredRecords.length} Records</>}
          </button>

        </TabsContent>

        {/* ── HISTORY TAB ── */}
        <TabsContent value="history" className="mt-0">
          <ExportHistory batches={batches} />
        </TabsContent>
      </Tabs>

      {/* Preview modal */}
      {showPreview && typeCfg && (
        <ExportPreviewModal
          typeCfg={typeCfg}
          records={filteredRecords}
          format={exportFormat}
          batchId={generateBatchId(batches.length)}
          onConfirm={handleExportConfirm}
          onCancel={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}