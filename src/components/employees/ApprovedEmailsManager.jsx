import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Star, StarOff, Trash2, Loader2, X, Mail } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { email: '', display_name: '', is_default: false, active: true };

export default function ApprovedEmailsManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['approved-emails'],
    queryFn: () => base44.entities.ApprovedEmail.list('email'),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // If setting as default, clear others first
      if (data.is_default) {
        await Promise.all(emails.filter(e => e.is_default).map(e => base44.entities.ApprovedEmail.update(e.id, { is_default: false })));
      }
      return base44.entities.ApprovedEmail.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-emails'] });
      setForm(emptyForm);
      setShowForm(false);
      toast.success('Sender email added');
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id) => {
      await Promise.all(emails.filter(e => e.is_default && e.id !== id).map(e => base44.entities.ApprovedEmail.update(e.id, { is_default: false })));
      return base44.entities.ApprovedEmail.update(id, { is_default: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-emails'] });
      toast.success('Default sender updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ApprovedEmail.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approved-emails'] });
      toast.success('Sender email removed');
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Approved Outbound Emails</p>
          <p className="text-xs text-muted-foreground">Only these addresses can send employee invite emails.</p>
        </div>
        <Button size="sm" className="h-8 rounded-xl text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-3.5 h-3.5 mr-1" />Add Email
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">New Sender Email</p>
            <button onClick={() => setShowForm(false)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Email address *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="h-9 rounded-xl text-sm" />
            <Input placeholder="Display name (optional)" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className="h-9 rounded-xl text-sm" />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })} className="rounded" />
            Set as default sender
          </label>
          <Button size="sm" className="w-full h-9 rounded-xl" disabled={!form.email || createMutation.isPending} onClick={() => createMutation.mutate(form)}>
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add Sender Email'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
      ) : emails.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-xl border border-dashed border-border">
          No approved sender emails yet. Add at least one to enable invite sending.
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map(em => (
            <div key={em.id} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${em.is_default ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{em.display_name || em.email}</p>
                  {em.display_name && <p className="text-xs text-muted-foreground truncate">{em.email}</p>}
                </div>
                {em.is_default && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full shrink-0">Default</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!em.is_default && (
                  <button onClick={() => setDefaultMutation.mutate(em.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors" title="Set as default">
                    <StarOff className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
                {em.is_default && (
                  <span className="w-7 h-7 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  </span>
                )}
                <button onClick={() => deleteMutation.mutate(em.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}