import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, Upload, ArrowLeft, Inbox } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { toast } from 'sonner';
import DocUpload from '@/components/shared/DocUpload';
import ExpenseEditScreen from '@/components/expenses/ExpenseEditScreen';
import MultiReceiptQueue from '@/components/expenses/MultiReceiptQueue';
import CostInboxTable from '@/components/expenses/CostInboxTable';
import DeleteExpenseDialog from '@/components/expenses/DeleteExpenseDialog';
import DuplicateWarningModal from '@/components/expenses/DuplicateWarningModal';
import { parseReceiptFile } from '@/components/expenses/ReceiptParser';
import { detectDuplicates } from '@/lib/duplicateDetection';
import { audit } from '@/lib/audit';
import { getInternalRole } from '@/lib/adminAuth';

/**
 * LLM call to detect if a file has multiple receipts and return them all.
 */
async function detectAndParseAll(fileUrl) {
  // First, ask LLM how many receipts are in this file
  const detection = await base44.integrations.Core.InvokeLLM({
    prompt: `Look at this document carefully. Does it contain ONE receipt/invoice, or MULTIPLE separate receipts/invoices?
Count the number of distinct receipts/invoices/transactions present.
Return JSON with: { "receipt_count": number, "is_multi": boolean }
Be conservative — only say multi if there are clearly separate transaction records.`,
    file_urls: [fileUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        receipt_count: { type: 'number' },
        is_multi: { type: 'boolean' },
      },
    },
  });

  const count = Math.max(1, Math.min(detection.receipt_count || 1, 10));

  if (!detection.is_multi || count <= 1) {
    // Single receipt
    const parsed = await parseReceiptFile(fileUrl);
    return [parsed];
  }

  // Multi-receipt: parse all at once with context
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `This document contains ${count} separate receipts/invoices. Extract ALL of them as separate objects.
For EACH receipt, extract: vendor_name, store_location, receipt_date (YYYY-MM-DD), receipt_number, subtotal, discount_total, tax_amount, final_total, payment_method, notes, parse_confidence (high/medium/low), and line_items array.
Each line item should have: title, quantity, unit_cost (post-discount), unit (EACH/GALLON/etc or --), line_total, original_price, discount_amount, sku.
Return: { "receipts": [...] }`,
    file_urls: [fileUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        receipts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              vendor_name: { type: 'string' },
              store_location: { type: 'string' },
              receipt_date: { type: 'string' },
              receipt_number: { type: 'string' },
              subtotal: { type: 'number' },
              discount_total: { type: 'number' },
              tax_amount: { type: 'number' },
              final_total: { type: 'number' },
              payment_method: { type: 'string' },
              notes: { type: 'string' },
              parse_confidence: { type: 'string' },
              line_items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    quantity: { type: 'number' },
                    unit_cost: { type: 'number' },
                    unit: { type: 'string' },
                    line_total: { type: 'number' },
                    original_price: { type: 'number' },
                    discount_amount: { type: 'number' },
                    sku: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return (result.receipts || []).map(r => ({
    vendor_name: r.vendor_name || '',
    store_location: r.store_location || '',
    receipt_date: r.receipt_date || '',
    receipt_number: r.receipt_number || '',
    subtotal: r.subtotal != null ? String(r.subtotal) : '',
    discount_total: r.discount_total != null ? String(r.discount_total) : '',
    tax_amount: r.tax_amount != null ? String(r.tax_amount) : '',
    final_total: r.final_total != null ? String(r.final_total) : '',
    payment_method: r.payment_method || '',
    notes: r.notes || '',
    parse_confidence: r.parse_confidence || 'medium',
    line_items: (r.line_items || []).map(item => ({
      _id: Math.random().toString(36).slice(2),
      title: item.title || '',
      quantity: String(item.quantity ?? 1),
      unit_cost: String(item.unit_cost ?? ''),
      unit: item.unit || 'EACH',
      line_total: String(item.line_total ?? ''),
      original_price: String(item.original_price ?? ''),
      discount_amount: String(item.discount_amount ?? ''),
      sku: item.sku || '',
      cost_code: '',
      cost_code_id: '',
    })),
  }));
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Expenses() {
  const queryClient = useQueryClient();
  const actor = getInternalRole() || 'Admin';

  // view: 'inbox' | 'upload' | 'review' | 'multi' | 'edit'
  const [view, setView] = useState('inbox');
  const [parsing, setParsing] = useState(false);

  // Single receipt review
  const [parsedReceipts, setParsedReceipts] = useState(null); // array
  const [uploadedFileUrl, setUploadedFileUrl] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);

  // Editing existing expense
  const [editingExpense, setEditingExpense] = useState(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Duplicate detection state
  const [pendingSaveData, setPendingSaveData] = useState(null); // data awaiting duplicate confirmation
  const [pendingSaveType, setPendingSaveType] = useState(null); // 'single' | 'edit' | 'multi'
  const [dupeMatches, setDupeMatches] = useState(null);

  // Data
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 200),
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['expense-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 100),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: (exp) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      audit.expense.created(exp.id, actor, exp.vendor_name || 'Unknown', exp.total_amount || 0, { job_id: exp.job_id, job_address: exp.job_address });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: (_, { id, data }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      const label = editingExpense?.vendor_name || data?.vendor_name || id;
      audit.expense.edited(id, actor, label, { job_id: editingExpense?.job_id, job_address: editingExpense?.job_address });
      setView('inbox');
      setEditingExpense(null);
      toast.success('Expense updated');
    },
  });

  // Archive (soft) mutation
  const archiveMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Expense.update(id, { inbox_status: 'archived' }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      const label = deleteTarget?.vendor_name || id;
      audit.expense.archived(id, actor, label, { job_id: deleteTarget?.job_id, job_address: deleteTarget?.job_address });
      setDeleteTarget(null);
      toast.success('Expense archived');
    },
  });

  // Hard delete mutation — permanent
  const hardDeleteMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Expense.delete(id),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      const label = deleteTarget?.vendor_name || id;
      audit.expense.deleted(id, actor, label, { job_id: deleteTarget?.job_id, job_address: deleteTarget?.job_address });
      setDeleteTarget(null);
      toast.success('Expense permanently deleted');
    },
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Expense.update(id, { inbox_status: 'needs_review' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense restored');
    },
  });

  // ── Upload + parse ──────────────────────────────────────────────────────────
  const handleDocUploaded = async (fileUrl, fileName) => {
    setUploadedFileUrl(fileUrl);
    setUploadedFileName(fileName);
    setParsing(true);
    try {
      const receipts = await detectAndParseAll(fileUrl);
      setParsedReceipts(receipts);
      setView(receipts.length > 1 ? 'multi' : 'review');
      toast.success(receipts.length > 1
        ? `${receipts.length} receipts detected — review one by one`
        : 'Receipt parsed — review below');
    } catch {
      toast.error('Could not parse receipt — you can enter details manually');
      setParsedReceipts([{}]);
      setView('review');
    } finally {
      setParsing(false);
    }
  };

  const handleCameraScan = async (file) => {
    if (!file) return;
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await handleDocUploaded(file_url, file.name);
    } catch {
      toast.error('Scan failed');
      setParsing(false);
    }
  };

  // ── Duplicate check helper ────────────────────────────────────────────────
  const checkAndSave = (data, type) => {
    const matches = detectDuplicates(data, expenses);
    if (matches.length > 0) {
      setPendingSaveData(data);
      setPendingSaveType(type);
      setDupeMatches(matches);
    } else {
      doSave(data, type);
    }
  };

  const doSave = async (data, type, dupeStatus = null) => {
    const payload = { ...data, inbox_status: 'confirmed' };
    if (dupeStatus) payload.duplicate_status = dupeStatus;
    if (type === 'edit') {
      updateMutation.mutate({ id: editingExpense.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
      if (type === 'single') { toast.success('Expense saved'); resetToInbox(); }
      else { toast.success('Receipt saved'); }
    }
  };

  // ── Duplicate modal actions ───────────────────────────────────────────────
  const handleDupeKeepBoth = () => {
    const data = pendingSaveData;
    const type = pendingSaveType;
    setDupeMatches(null); setPendingSaveData(null); setPendingSaveType(null);
    audit.expense.duplicateOverride('pending', actor, data?.vendor_name || 'Unknown');
    doSave(data, type, 'ignored');
    toast.success('Saved — duplicate warning ignored');
  };

  const handleDupeDiscard = () => {
    const data = pendingSaveData;
    setDupeMatches(null); setPendingSaveData(null); setPendingSaveType(null);
    audit.expense.duplicateDiscarded(actor, data?.vendor_name || 'Unknown');
    toast('New entry discarded');
  };

  const handleDupeIgnore = () => {
    const data = pendingSaveData;
    const type = pendingSaveType;
    setDupeMatches(null); setPendingSaveData(null); setPendingSaveType(null);
    doSave(data, type, 'ignored');
  };

  // ── Save single parsed receipt ───────────────────────────────────────────
  const handleSaveSingle = (data) => checkAndSave(data, 'single');

  // ── Save one in multi queue ───────────────────────────────────────────────
  const handleSaveMultiOne = (data) => checkAndSave(data, 'multi');

  // ── Edit existing expense ─────────────────────────────────────────────────
  const handleOpenExpense = (expense) => {
    setEditingExpense(expense);
    setView('edit');
  };

  const handleSaveEdit = (data) => checkAndSave(data, 'edit');

  // ── Delete / Restore ─────────────────────────────────────────────────────
  const handleDeleteRequest = (expense) => setDeleteTarget(expense);
  const handleArchiveConfirm = () => archiveMutation.mutate({ id: deleteTarget.id });
  const handleHardDeleteConfirm = () => hardDeleteMutation.mutate({ id: deleteTarget.id });
  const handleRestore = (expense) => restoreMutation.mutate({ id: expense.id });

  const resetToInbox = () => {
    setView('inbox');
    setParsedReceipts(null);
    setUploadedFileUrl(null);
    setUploadedFileName(null);
    setEditingExpense(null);
  };

  // ── Totals summary ────────────────────────────────────────────────────────
  const totalAmount = expenses.reduce((s, e) => s + (e.total_amount || 0), 0);
  const needsReviewCount = expenses.filter(e => e.inbox_status === 'needs_review' || e.parsed_match_status === 'mismatch').length;

  return (
    <AppLayout title="Cost Inbox">
      <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          {(view !== 'inbox') ? (
            <button onClick={resetToInbox} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Inbox
            </button>
          ) : (
            <div>
              <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Inbox className="w-4 h-4 text-primary" />
                Cost Inbox
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {expenses.length} records · ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                {needsReviewCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {needsReviewCount} need review</span>}
              </p>
            </div>
          )}

          {view === 'inbox' && (
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleCameraScan(f); e.target.value = ''; }} />
                <Button asChild variant="outline" className="h-9 rounded-xl text-sm" disabled={parsing}>
                  <span>{parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4 mr-1.5" />Scan</>}</span>
                </Button>
              </label>
              <Button className="h-9 rounded-xl text-sm" onClick={() => setView('upload')}>
                <Upload className="w-4 h-4 mr-1.5" />Upload
              </Button>
            </div>
          )}
        </div>

        {/* ── Parsing overlay ────────────────────────────────────────────── */}
        <AnimatePresence>
          {parsing && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col items-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Reading receipt…</p>
              <p className="text-xs text-muted-foreground">Detecting items, totals, and vendor info</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── UPLOAD VIEW ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {view === 'upload' && !parsing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <p className="text-sm font-semibold text-foreground">Upload Receipt or Document</p>
              <p className="text-xs text-muted-foreground">
                Upload a PDF or image. The app will automatically read it, extract items, and create a review screen.
                If a PDF contains multiple receipts, each will be reviewed separately.
              </p>
              <DocUpload
                onUploaded={handleDocUploaded}
                label="Upload receipt, invoice, or PDF document"
              />
              <Button variant="outline" className="w-full h-9 rounded-xl text-sm" onClick={() => setView('inbox')}>
                Cancel
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── SINGLE RECEIPT REVIEW ─────────────────────────────────────── */}
        <AnimatePresence>
          {view === 'review' && parsedReceipts && !parsing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground">Review Parsed Receipt</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {parsedReceipts[0]?.line_items?.length || 0} items extracted — edit as needed then confirm
                </p>
              </div>
              <ExpenseEditScreen
                initialData={parsedReceipts[0] || {}}
                fileUrl={uploadedFileUrl}
                fileName={uploadedFileName}
                jobs={jobs}
                onSave={handleSaveSingle}
                onCancel={resetToInbox}
                saving={createMutation.isPending}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MULTI-RECEIPT QUEUE ───────────────────────────────────────── */}
        <AnimatePresence>
          {view === 'multi' && parsedReceipts && !parsing && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground">Multi-Receipt File</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {parsedReceipts.length} receipts detected — confirm each one to file it separately
                </p>
              </div>
              <MultiReceiptQueue
                receipts={parsedReceipts}
                fileUrl={uploadedFileUrl}
                fileName={uploadedFileName}
                jobs={jobs}
                onSaveOne={handleSaveMultiOne}
                onDone={resetToInbox}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── EDIT EXISTING EXPENSE ─────────────────────────────────────── */}
        <AnimatePresence>
          {view === 'edit' && editingExpense && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-5">
              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground">Edit Expense</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editingExpense.vendor_name} · #{editingExpense.expense_number || editingExpense.id?.slice(-6)}
                </p>
              </div>
              <ExpenseEditScreen
                initialData={editingExpense}
                jobs={jobs}
                onSave={handleSaveEdit}
                onCancel={resetToInbox}
                saving={updateMutation.isPending}
                isEdit
                expenseId={editingExpense?.id}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── INBOX TABLE ───────────────────────────────────────────────── */}
        {view === 'inbox' && !parsing && (
          <CostInboxTable
            expenses={expenses}
            onOpen={handleOpenExpense}
            onDelete={handleDeleteRequest}
            onRestore={handleRestore}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* ── DELETE CONFIRMATION ───────────────────────────────────────────── */}
      {deleteTarget && (
        <DeleteExpenseDialog
          expense={deleteTarget}
          onArchive={handleArchiveConfirm}
          onDelete={handleHardDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          saving={archiveMutation.isPending || hardDeleteMutation.isPending}
        />
      )}

      {/* ── DUPLICATE WARNING ─────────────────────────────────────────────── */}
      {dupeMatches && pendingSaveData && (
        <DuplicateWarningModal
          newExpense={pendingSaveData}
          matches={dupeMatches}
          onKeepBoth={handleDupeKeepBoth}
          onDiscard={handleDupeDiscard}
          onIgnore={handleDupeIgnore}
        />
      )}
    </AppLayout>
  );
}