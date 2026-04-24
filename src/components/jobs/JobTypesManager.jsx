import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Pencil, Trash2, Check, X, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function JobTypesManager({ actorName = 'Admin' }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const { data: types = [], isLoading } = useQuery({
    queryKey: ['job-types'],
    queryFn: () => base44.entities.JobType.list('display_order'),
  });

  const createMut = useMutation({
    mutationFn: d => base44.entities.JobType.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['job-types'] }); setAdding(false); setNewName(''); toast.success('Job type added'); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.JobType.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['job-types'] }); setEditingId(null); },
  });
  const deleteMut = useMutation({
    mutationFn: id => base44.entities.JobType.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['job-types'] }); toast.success('Removed'); },
  });

  const handleAdd = () => {
    if (!newName.trim()) return;
    createMut.mutate({ name: newName.trim(), active: true, created_by_name: actorName, display_order: types.length });
  };

  const handleEdit = (t) => {
    if (!editName.trim()) return;
    updateMut.mutate({ id: t.id, data: { name: editName.trim() } });
  };

  const toggleActive = (t) => {
    updateMut.mutate({ id: t.id, data: { active: !t.active } });
  };

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Job Types</p>
          <p className="text-xs text-muted-foreground">Manage job type options used across the platform</p>
        </div>
        <Button size="sm" className="h-8 text-xs rounded-lg gap-1" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Type
        </Button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 bg-secondary/50 rounded-xl p-2">
          <Input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Job type name..."
            className="h-8 rounded-lg text-sm flex-1"
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
          />
          <Button size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={handleAdd} disabled={createMut.isPending}>
            {createMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {types.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground text-center py-4">No job types yet. Add one above.</p>
      )}

      <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
        {types.map(t => (
          <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${!t.active ? 'opacity-50' : ''} bg-card`}>
            {editingId === t.id ? (
              <>
                <Input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-7 rounded-lg text-sm flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') handleEdit(t); if (e.key === 'Escape') setEditingId(null); }}
                />
                <button onClick={() => handleEdit(t)} className="text-primary hover:text-primary/80"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-foreground">{t.name}</span>
                {!t.active && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Inactive</span>}
                <button onClick={() => toggleActive(t)} className="text-muted-foreground hover:text-foreground" title={t.active ? 'Deactivate' : 'Activate'}>
                  {t.active ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => { setEditingId(t.id); setEditName(t.name); }} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteMut.mutate(t.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}