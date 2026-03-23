import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Camera, Receipt, Search, X, AlertTriangle, CheckCircle2, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { toast } from 'sonner';
import DocUpload from '@/components/shared/DocUpload';
import ReceiptReviewForm from '@/components/expenses/ReceiptReviewForm';
import { parseReceiptFile, makeBlankItem } from '@/components/expenses/ReceiptParser';

// ── Match status display ─────────────────────────────────────────────────────
const MATCH_CONFIG = {
  matched:      { label: 'Matched',          icon: CheckCircle2,  color: 'text-green-600' },
  needs_review: { label: 'Needs Review',      icon: Clock,         color: 'text-amber-600' },
  mismatch:     { label: 'Mismatch',          icon: AlertTriangle, color: 'text-red-600'   },
};

export default function Expenses() {
  const queryClient = useQueryClient();

  // UI state
  const [mode, setMode] = useState('list'); // 'list' | 'manual' | 'review'
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Manual form state
  const [manualForm, setManualForm] = useState({
    vendor_name: '', receipt_date: '', total_amount: '', subtotal: '', tax_amount: '',
    store_location: '', receipt_number: '', job_id: '', job_address: '', notes: '', cost_code: '',
    receipt_image_url: '', file_name: '',
  });

  // Data
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 100),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['expense-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 100),
  });

  // Save mutation (handles both manual and parsed)
  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setMode('list');
      setParsedData(null);
      setUploadedFileUrl(null);
      setUploadedFileName(null);
      setManualForm({
        vendor_name: '', receipt_date: '', total_amount: '', subtotal: '', tax_amount: '',
        store_location: '', receipt_number: '', job_id: '', job_address: '', notes: '', cost_code: '',
        receipt_image_url: '', file_name: '',
      });
      toast.success('Expense saved');
    },
    onError: () => toast.error('Failed to save expense'),
  });

  // Camera scan (image only — quick scan path)
  const handleCameraScan = async (file) => {
    if (!file) return;
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const parsed = await parseReceiptFile(file_url);
      setUploadedFileUrl(file_url);
      setUploadedFileName(file.name);
      setParsedData(parsed);
      setMode('review');
      toast.success('Receipt parsed — review below');
    } catch {
      toast.error('Scan failed — try uploading the file manually');
    } finally {
      setParsing(false);
    }
  };

  // DocUpload callback — for PDF/image uploads with auto-parse
  const handleDocUploaded = async (fileUrl, fileName) => {
    setUploadedFileUrl(fileUrl);
    setUploadedFileName(fileName);
    setParsing(true);
    try {
      const parsed = await parseReceiptFile(fileUrl);
      setParsedData(parsed);
      setMode('review');
      toast.success('Receipt parsed — review below');
    } catch {
      toast.error('Could not auto-parse receipt. Fill in details manually.');
      setManualForm(f => ({ ...f, receipt_image_url: fileUrl, file_name: fileName }));
      setMode('manual');
    } finally {
      setParsing(false);
    }
  };

  // Manual save
  const handleManualSave = () => {
    if (!manualForm.vendor_name || !manualForm.total_amount) return;
    saveMutation.mutate({
      vendor_name:      manualForm.vendor_name,
      store_location:   manualForm.store_location,
      receipt_date:     manualForm.receipt_date,
      expense_date:     manualForm.receipt_date,
      receipt_number:   manualForm.receipt_number,
      subtotal:         Number(manualForm.subtotal) || 0,
      tax_amount:       Number(manualForm.tax_amount) || 0,
      total_amount:     Number(manualForm.total_amount) || 0,
      notes:            manualForm.notes,
      job_id:           manualForm.job_id,
      job_address:      manualForm.job_address,
      cost_code:        manualForm.cost_code,
      receipt_image_url: manualForm.receipt_image_url,
      file_name:        manualForm.file_name,
      file_url:         manualForm.receipt_image_url,
      source_system:    'manual_entry',
      category:         'materials',
    });
  };

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase();
    return !q || e.vendor_name?.toLowerCase().includes(q) || e.job_address?.toLowerCase().includes(q);
  });
  const total = filtered.reduce((sum, e) => sum + (e.total_amount || 0), 0);

  return (
    <AppLayout title="Expenses">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Expenses</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {expenses.length} records · ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCameraScan(f); e.target.value = ''; }} />
              <Button asChild variant="outline" className="h-9 rounded-xl text-sm" disabled={parsing}>
                <span>
                  {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4 mr-1.5" />Scan</>}
                </span>
              </Button>
            </label>
            <Button className="h-9 rounded-xl text-sm" onClick={() => setMode(mode === 'manual' ? 'list' : 'manual')}>
              <Receipt className="w-4 h-4 mr-1.5" />Add
            </Button>
          </div>
        </div>

        {/* ── Parsing overlay ── */}
        <AnimatePresence>
          {parsing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Reading receipt…</p>
              <p className="text-xs text-muted-foreground">Extracting items, totals, and vendor info</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── REVIEW MODE: parsed receipt ── */}
        <AnimatePresence>
          {mode === 'review' && parsedData && !parsing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-5 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Review Parsed Receipt</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {parsedData.line_items?.length || 0} items extracted — edit as needed then save
                  </p>
                </div>
                <button onClick={() => { setMode('list'); setParsedData(null); }}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <ReceiptReviewForm
                parsed={parsedData}
                fileUrl={uploadedFileUrl}
                fileName={uploadedFileName}
                jobs={jobs}
                onSave={(data) => saveMutation.mutate(data)}
                onCancel={() => { setMode('list'); setParsedData(null); }}
                saving={saveMutation.isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MANUAL MODE ── */}
        <AnimatePresence>
          {mode === 'manual' && !parsing && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Expense</p>
                <button onClick={() => setMode('list')}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>

              {/* Upload area — triggers auto-parse */}
              <DocUpload
                fileUrl={manualForm.receipt_image_url}
                fileName={manualForm.file_name}
                onUploaded={handleDocUploaded}
                label="Upload receipt or document (auto-reads PDF/image)"
              />
              {manualForm.receipt_image_url && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Could not auto-parse — fill in details below
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Vendor Name *" value={manualForm.vendor_name}
                  onChange={e => setManualForm(f => ({...f, vendor_name: e.target.value}))} className="h-10 rounded-xl text-sm" />
                <Input type="date" placeholder="Date" value={manualForm.receipt_date}
                  onChange={e => setManualForm(f => ({...f, receipt_date: e.target.value}))} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input type="number" placeholder="Total *" value={manualForm.total_amount}
                  onChange={e => setManualForm(f => ({...f, total_amount: e.target.value}))} className="h-10 rounded-xl text-sm" />
                <Input type="number" placeholder="Subtotal" value={manualForm.subtotal}
                  onChange={e => setManualForm(f => ({...f, subtotal: e.target.value}))} className="h-10 rounded-xl text-sm" />
                <Input type="number" placeholder="Tax" value={manualForm.tax_amount}
                  onChange={e => setManualForm(f => ({...f, tax_amount: e.target.value}))} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Store Location" value={manualForm.store_location}
                  onChange={e => setManualForm(f => ({...f, store_location: e.target.value}))} className="h-10 rounded-xl text-sm" />
                <Input placeholder="Receipt #" value={manualForm.receipt_number}
                  onChange={e => setManualForm(f => ({...f, receipt_number: e.target.value}))} className="h-10 rounded-xl text-sm" />
              </div>
              <Select value={manualForm.job_id} onValueChange={v => {
                const job = jobs.find(j => j.id === v);
                setManualForm(f => ({ ...f, job_id: v, job_address: job?.address || '' }));
              }}>
                <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Link to job (optional)" /></SelectTrigger>
                <SelectContent>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea placeholder="Notes" value={manualForm.notes}
                onChange={e => setManualForm(f => ({...f, notes: e.target.value}))} className="rounded-xl text-sm min-h-14" />
              <Button className="w-full h-10 rounded-xl"
                disabled={!manualForm.vendor_name || !manualForm.total_amount || saveMutation.isPending}
                onClick={handleManualSave}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Expense'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LIST MODE ── */}
        {mode === 'list' && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl text-sm" />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No expenses yet.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map(e => {
                  const matchCfg = e.parsed_match_status ? MATCH_CONFIG[e.parsed_match_status] : null;
                  const MatchIcon = matchCfg?.icon;
                  const lineItems = (() => {
                    try { return e.line_items ? JSON.parse(e.line_items) : []; } catch { return []; }
                  })();
                  const isExpanded = expandedId === e.id;

                  return (
                    <div key={e.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      <button
                        className="w-full text-left p-4"
                        onClick={() => setExpandedId(isExpanded ? null : e.id)}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">{e.vendor_name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-primary">${Number(e.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {e.receipt_date && <span className="text-xs text-muted-foreground">{e.receipt_date}</span>}
                          {e.job_address && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{e.job_address}</span>}
                          {e.cost_code && <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{e.cost_code}</span>}
                          {matchCfg && (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${matchCfg.color}`}>
                              <MatchIcon className="w-3 h-3" />{matchCfg.label}
                            </span>
                          )}
                          {lineItems.length > 0 && (
                            <span className="text-xs text-muted-foreground">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                            className="overflow-hidden border-t border-border">
                            <div className="p-4 space-y-3">
                              {/* File link */}
                              {(e.receipt_image_url || e.file_url) && (
                                <a href={e.receipt_image_url || e.file_url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                                  <FileText className="w-3.5 h-3.5" />
                                  {(e.file_name || e.receipt_image_url || '').match(/\.pdf/i) ? 'View PDF receipt' : 'View receipt'}
                                </a>
                              )}

                              {/* Totals row */}
                              <div className="flex flex-wrap gap-4 text-xs">
                                {e.subtotal > 0 && <span className="text-muted-foreground">Subtotal: <strong>${Number(e.subtotal).toFixed(2)}</strong></span>}
                                {e.discount_total > 0 && <span className="text-green-600">Savings: <strong>-${Number(e.discount_total).toFixed(2)}</strong></span>}
                                {e.tax_amount > 0 && <span className="text-muted-foreground">Tax: <strong>${Number(e.tax_amount).toFixed(2)}</strong></span>}
                              </div>

                              {/* Line items */}
                              {lineItems.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Items</p>
                                  {lineItems.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                                      <div className="flex-1 min-w-0 pr-2">
                                        <p className="text-xs font-medium text-foreground truncate">{item.title || 'Untitled item'}</p>
                                        {item.cost_code && <p className="text-[10px] text-muted-foreground">{item.cost_code}</p>}
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="text-xs font-semibold text-foreground">
                                          ${((parseFloat(item.unit_cost) || 0) * (parseFloat(item.quantity) || 1)).toFixed(2)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          {item.quantity} × ${parseFloat(item.unit_cost || 0).toFixed(2)} {item.unit !== '--' ? item.unit : ''}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Review warning */}
                              {e.parsed_match_status && e.parsed_match_status !== 'matched' && (
                                <div className={`flex items-center gap-1.5 text-xs p-2 rounded-lg ${
                                  e.parsed_match_status === 'mismatch' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {e.parsed_match_status === 'mismatch'
                                    ? <AlertTriangle className="w-3 h-3 shrink-0" />
                                    : <Clock className="w-3 h-3 shrink-0" />}
                                  {e.parsed_match_status === 'mismatch'
                                    ? 'Mismatch detected — totals may not reconcile.'
                                    : 'Needs review — parsing was partial or discounts unclear.'}
                                </div>
                              )}

                              {e.notes && <p className="text-xs text-muted-foreground italic">{e.notes}</p>}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}