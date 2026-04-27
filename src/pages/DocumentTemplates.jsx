import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, FileText, Upload, X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import { isAdminAuthed } from '@/lib/adminAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DOC_TYPES = [
  { value: 'estimate', label: 'Estimate' },
  { value: 'contract', label: 'Contract' },
  { value: 'work_authorization', label: 'Work Authorization' },
  { value: 'invoice_support', label: 'Invoice Support' },
  { value: 'change_order', label: 'Change Order' },
  { value: 'other', label: 'Other' },
];

const emptyForm = { name: '', type: 'estimate', description: '', version: 'v1.0', active: true };

export default function DocumentTemplates() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [templateFile, setTemplateFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const isAdmin = isAdminAuthed();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['doc-templates'],
    queryFn: () => base44.entities.DocumentTemplate.list('-created_date'),
    enabled: isAdmin,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      let file_url = undefined;
      if (templateFile) {
        setUploading(true);
        const res = await base44.integrations.Core.UploadFile({ file: templateFile });
        file_url = res.file_url;
        setUploading(false);
      }
      return base44.entities.DocumentTemplate.create({ ...data, ...(file_url ? { file_url } : {}) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doc-templates'] });
      setForm(emptyForm);
      setTemplateFile(null);
      setShowForm(false);
      toast.success('Template saved');
    },
    onError: () => { setUploading(false); toast.error('Failed to save template'); },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }) => base44.entities.DocumentTemplate.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doc-templates'] }),
  });

  if (!isAdmin) {
    return (
      <AppLayout title="Document Templates">
        <div className="flex-1 flex items-center justify-center flex-col gap-3 px-4">
          <FileText className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">Admin access required to manage document templates.</p>
          <Button variant="outline" className="rounded-xl" onClick={() => window.location.href = '/admin'}>Go to Admin</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Document Templates">
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Document Templates</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{templates.length} templates</p>
          </div>
          <Button className="h-9 rounded-xl text-sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 mr-1.5" />Add Template
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="bg-card border border-border rounded-2xl p-5 space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Template</p>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <Input placeholder="Template Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="h-10 rounded-xl text-sm" />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Version (e.g. v1.0)" value={form.version} onChange={e => setForm({...form, version: e.target.value})} className="h-10 rounded-xl text-sm" />
              </div>
              <Textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="rounded-xl text-sm min-h-16" />
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {templateFile ? templateFile.name : 'Upload template file (PDF, DOCX, etc.)'}
                </span>
                <input type="file" className="hidden" onChange={e => setTemplateFile(e.target.files?.[0] || null)} />
              </label>
              <Button className="w-full h-10 rounded-xl" disabled={!form.name || saveMutation.isPending || uploading} onClick={() => saveMutation.mutate(form)}>
                {(saveMutation.isPending || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Template'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No templates yet. Add your first template above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className={`bg-card border border-border rounded-xl p-4 ${!t.active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{DOC_TYPES.find(d => d.value === t.type)?.label} · {t.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.file_url && (
                      <a href={t.file_url} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    )}
                    <button
                      onClick={() => toggleActive.mutate({ id: t.id, active: !t.active })}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                        t.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {t.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-2 pl-6">{t.description}</p>}
                {t.created_date && (
                  <p className="text-xs text-muted-foreground mt-1 pl-6">
                    Added {format(new Date(t.created_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
