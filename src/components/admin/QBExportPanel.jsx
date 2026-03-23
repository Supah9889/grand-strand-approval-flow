import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Loader2, Download, CheckCircle2, AlertTriangle, Database, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { buildCSV, downloadCSV, EXPORT_TYPES } from '@/lib/exportHelpers';
import { getInternalRole } from '@/lib/adminAuth';

const ENTITY_MAP = {
  Invoice:   () => base44.entities.Invoice.list('-invoice_date', 1000),
  Bill:      () => base44.entities.Bill.list('-bill_date', 1000),
  Expense:   () => base44.entities.Expense.list('-created_date', 1000),
  TimeEntry: () => base44.entities.TimeEntry.list('-clock_in', 2000),
  Vendor:    () => base44.entities.Vendor.list('company_name', 500),
  Job:       () => base44.entities.Job.list('-created_date', 1000),
  Employee:  () => base44.entities.Employee.list('name', 200),
};

const QB_STATUS_COLORS = {
  not_synced:   'bg-slate-100 text-slate-600',
  pending:      'bg-amber-100 text-amber-700',
  synced:       'bg-green-100 text-green-700',
  failed:       'bg-red-100 text-red-600',
  needs_review: 'bg-orange-100 text-orange-700',
};

export default function QBExportPanel() {
  const role = getInternalRole();
  const [activeType, setActiveType] = useState('invoices');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const typeCfg = EXPORT_TYPES.find(t => t.key === activeType);

  const { data: batches = [] } = useQuery({
    queryKey: ['qb-export-batches'],
    queryFn: () => base44.entities.QBExportBatch.list('-created_date', 20),
  });

  const createBatch = useMutation({
    mutationFn: d => base44.entities.QBExportBatch.create(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['qb-export-batches'] }),
  });

  const handleExport = async () => {
    if (!typeCfg) return;
    setLoading(true);
    try {
      const fetcher = ENTITY_MAP[typeCfg.entity];
      let records = await fetcher();

      // Apply date filter if provided and applicable
      if (dateFrom || dateTo) {
        records = records.filter(r => {
          const d = r[typeCfg.dateField] || r.created_date || '';
          const dateStr = d.split('T')[0];
          if (dateFrom && dateStr < dateFrom) return false;
          if (dateTo && dateStr > dateTo) return false;
          return true;
        });
      }

      const mapped = typeCfg.mapper(records);
      const csv = buildCSV(mapped);
      const batchNum = `EXP-${new Date().getFullYear()}-${String(batches.length + 1).padStart(3, '0')}`;
      const filename = `${typeCfg.key}_export_${batchNum}_${format(new Date(), 'yyyy-MM-dd')}.csv`;

      downloadCSV(csv, filename);

      await createBatch.mutateAsync({
        batch_number: batchNum,
        export_type: activeType,
        status: 'completed',
        record_count: records.length,
        exported_count: mapped.length,
        failed_count: 0,
        date_range_start: dateFrom || '',
        date_range_end: dateTo || '',
        exported_by: role || 'admin',
        exported_at: new Date().toISOString(),
        notes: `${mapped.length} records exported to ${filename}`,
      });

      toast.success(`Exported ${mapped.length} ${typeCfg.label} records`);
    } catch (err) {
      toast.error('Export failed — ' + (err?.message || 'unknown error'));
    } finally {
      setLoading(false);
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
          <p className="text-sm font-semibold text-foreground">QuickBooks Export Tools</p>
          <p className="text-xs text-muted-foreground">Export clean, QB-ready CSV files for all accounting record types</p>
        </div>
      </div>

      {/* Type selector */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Select Record Type</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {EXPORT_TYPES.map(t => (
            <button key={t.key} onClick={() => setActiveType(t.key)}
              className={`text-xs px-3 py-2.5 rounded-xl border text-left transition-colors ${
                activeType === t.key
                  ? 'border-primary bg-secondary text-primary font-semibold'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date filter (only if type has a dateField) */}
      {typeCfg?.dateField && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">From Date</p>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 rounded-xl text-sm" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">To Date</p>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 rounded-xl text-sm" />
          </div>
        </div>
      )}

      {/* QB field info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-emerald-800">Export includes QB placeholder fields</p>
        <p className="text-xs text-emerald-700 leading-relaxed">
          Every exported CSV includes <code className="bg-emerald-100 px-1 rounded">qb_*_id</code>, <code className="bg-emerald-100 px-1 rounded">qb_sync_status</code>, and <code className="bg-emerald-100 px-1 rounded">qb_export_batch_id</code> columns ready for QuickBooks import mapping.
        </p>
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={loading || !typeCfg}
        className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating CSV…</>
          : <><Download className="w-4 h-4" /> Export {typeCfg?.label || ''} to CSV</>}
      </button>

      {/* Recent batches */}
      {batches.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent Export Batches</p>
          <div className="space-y-1.5">
            {batches.slice(0, 8).map(b => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 bg-muted/40 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{b.batch_number} · {b.export_type}</p>
                    <p className="text-xs text-muted-foreground">{b.exported_count} records · {b.exported_by || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {b.status === 'completed'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    : <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  <p className="text-xs text-muted-foreground">{b.exported_at ? format(new Date(b.exported_at), 'MMM d') : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}