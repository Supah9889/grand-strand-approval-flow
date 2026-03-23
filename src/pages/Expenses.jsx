import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Camera, Receipt, Search, X, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { toast } from 'sonner';
import { format } from 'date-fns';
import DocUpload from '@/components/shared/DocUpload';

const COST_CODES = ['Carpentry Labor/Sub', 'Drywall Labor/Sub', 'Other Labor/Sub', 'Paint Expenses', 'Painting Labor/Sub', 'Other'];

const emptyForm = {
  vendor_name: '', receipt_date: '', total_amount: '', subtotal: '', tax: '',
  store_location: '', receipt_number: '', job_id: '', job_address: '', notes: '', cost_code: '',
};

export default function Expenses() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [scanning, setScanning] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 100),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['expense-jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 100),
  });

  const scanMutation = useMutation({
    mutationFn: async (file) => {
      setScanning(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract expense data from this receipt image. Return all fields you can find.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            vendor_name: { type: 'string' },
            receipt_date: { type: 'string' },
            total_amount: { type: 'number' },
            subtotal: { type: 'number' },
            tax: { type: 'number' },
            store_location: { type: 'string' },
            receipt_number: { type: 'string' },
          },
        },
      });
      return { file_url, extracted: result };
    },
    onSuccess: ({ file_url, extracted }) => {
      setScanning(false);
      setForm(prev => ({
        ...prev,
        vendor_name: extracted.vendor_name || '',
        receipt_date: extracted.receipt_date || '',
        total_amount: extracted.total_amount || '',
        subtotal: extracted.subtotal || '',
        tax: extracted.tax || '',
        store_location: extracted.store_location || '',
        receipt_number: extracted.receipt_number || '',
        receipt_image_url: file_url,
      }));
      setShowForm(true);
      toast.success('Receipt scanned — review and save');
    },
    onError: () => { setScanning(false); toast.error('Scan failed'); },
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Expense.create({
      ...data,
      total_amount: Number(data.total_amount) || 0,
      subtotal: Number(data.subtotal) || undefined,
      tax: Number(data.tax) || undefined,
      receipt_image_url: form.receipt_image_url,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setForm(emptyForm);
      setReceiptFile(null);
      setReceiptPreview(null);
      setShowForm(false);
      toast.success('Expense saved');
    },
  });

  const handleScanChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    scanMutation.mutate(file);
  };

  const handleJobSelect = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    setForm(prev => ({ ...prev, job_id: jobId, job_address: job?.address || '' }));
  };

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase();
    return !q || e.vendor_name?.toLowerCase().includes(q) || e.job_address?.toLowerCase().includes(q);
  });

  const total = filtered.reduce((sum, e) => sum + (e.total_amount || 0), 0);

  return (
    <AppLayout title="Expenses">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Expenses</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{expenses.length} records · ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanChange} />
              <Button asChild variant="outline" className="h-9 rounded-xl text-sm">
                <span>
                  {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4 mr-1.5" />Scan</>}
                </span>
              </Button>
            </label>
            <Button className="h-9 rounded-xl text-sm" onClick={() => setShowForm(!showForm)}>
              <Receipt className="w-4 h-4 mr-1.5" />Add
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Expense</p>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>

              {receiptPreview && (
                <img src={receiptPreview} alt="Receipt" className="w-full max-h-40 object-cover rounded-xl" />
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Vendor Name *" value={form.vendor_name} onChange={e => setForm({...form, vendor_name: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Input type="date" placeholder="Date" value={form.receipt_date} onChange={e => setForm({...form, receipt_date: e.target.value})} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Input type="number" placeholder="Total *" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Input type="number" placeholder="Subtotal" value={form.subtotal} onChange={e => setForm({...form, subtotal: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Input type="number" placeholder="Tax" value={form.tax} onChange={e => setForm({...form, tax: e.target.value})} className="h-10 rounded-xl text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Store Location" value={form.store_location} onChange={e => setForm({...form, store_location: e.target.value})} className="h-10 rounded-xl text-sm" />
                <Input placeholder="Receipt #" value={form.receipt_number} onChange={e => setForm({...form, receipt_number: e.target.value})} className="h-10 rounded-xl text-sm" />
              </div>
              <Select value={form.job_id} onValueChange={handleJobSelect}>
                <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Link to job (optional)" /></SelectTrigger>
                <SelectContent>{jobs.map(j => <SelectItem key={j.id} value={j.id}>{j.address}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.cost_code} onValueChange={v => setForm({...form, cost_code: v})}>
                <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Cost code" /></SelectTrigger>
                <SelectContent>{COST_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea placeholder="Notes" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="rounded-xl text-sm min-h-14" />
              <Button className="w-full h-10 rounded-xl" disabled={!form.vendor_name || !form.total_amount || saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Expense'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl text-sm" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No expenses yet.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(e => (
              <div key={e.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{e.vendor_name}</p>
                  <p className="text-sm font-bold text-primary">${Number(e.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {e.receipt_date && <span className="text-xs text-muted-foreground">{e.receipt_date}</span>}
                  {e.job_address && <span className="text-xs text-muted-foreground truncate">{e.job_address}</span>}
                </div>
                {e.cost_code && <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full mt-1 inline-block">{e.cost_code}</span>}
                {e.receipt_image_url && (
                  <a href={e.receipt_image_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline mt-1 block">View receipt</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}