import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ArrowLeft, Loader2, Pencil, AlertCircle, Clock, Camera, Save, CheckCircle2 } from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { motion } from 'framer-motion';
import AppLayout from '../components/AppLayout';
import TaskForm from '../components/tasks/TaskForm';
import TaskStatusBadge, { STATUS_CONFIG, PRIORITY_CONFIG } from '../components/tasks/TaskStatusBadge';
import PhotoLightbox from '../components/dailylogs/PhotoLightbox';
import { getInternalRole } from '@/lib/adminAuth';
import { toast } from 'sonner';

const TYPE_LABEL = { todo: 'To-Do', task: 'Task', punch_list: 'Punch List' };

export default function TaskDetail() {
  const taskId = window.location.pathname.split('/').pop();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = getInternalRole();
  const [editing, setEditing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [completionNote, setCompletionNote] = useState('');
  const [statusNoteShown, setStatusNoteShown] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => { const r = await base44.entities.Task.filter({ id: taskId }); return r[0]; },
    enabled: !!taskId,
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list('-created_date', 200),
  });

  const queryClient2 = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.update(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const changeStatus = (newStatus) => {
    updateMutation.mutate({ status: newStatus });
    toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label}`);
  };

  const saveEdits = (data) => {
    updateMutation.mutate(data, {
      onSuccess: () => { setEditing(false); toast.success('Task updated'); }
    });
  };

  const saveCompletionNote = () => {
    updateMutation.mutate({ completion_notes: completionNote, status: 'completed' });
    setStatusNoteShown(false);
    toast.success('Task marked complete');
  };

  const photos = (() => { try { return JSON.parse(task?.photos || '[]'); } catch { return []; } })();
  const pCfg = PRIORITY_CONFIG[task?.priority] || PRIORITY_CONFIG.normal;

  const dueState = (() => {
    if (!task?.due_date || ['completed','closed','canceled'].includes(task?.status)) return null;
    const d = parseISO(task.due_date);
    if (isPast(d) && !isToday(d)) return 'overdue';
    if (isToday(d)) return 'today';
    return 'upcoming';
  })();

  if (isLoading) return <AppLayout title="Task"><div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></AppLayout>;
  if (!task) return (
    <AppLayout title="Task">
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Task not found.</p>
        <Button variant="outline" onClick={() => navigate('/tasks')} className="rounded-xl"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout title={task.title || 'Task'}>
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">

        <button onClick={() => navigate('/tasks')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </button>

        {editing ? (
          <div className="bg-card border border-border rounded-2xl p-5">
            <p className="text-sm font-semibold text-foreground mb-4">Edit Task</p>
            <TaskForm initial={task} jobs={jobs} onSave={saveEdits} onCancel={() => setEditing(false)} />
          </div>
        ) : (
          <>
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${pCfg.dot}`} />
                    <span className="text-xs text-muted-foreground">{TYPE_LABEL[task.task_type]}</span>
                    <span className={`text-xs font-medium ${pCfg.text}`}>{pCfg.label} priority</span>
                  </div>
                  <h1 className={`text-base font-bold text-foreground ${['completed','closed'].includes(task.status) ? 'line-through text-muted-foreground' : ''}`}>{task.title}</h1>
                  {task.job_address && <p className="text-sm text-muted-foreground mt-0.5">{task.job_address}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <TaskStatusBadge status={task.status} size="md" />
                    {dueState === 'overdue' && <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertCircle className="w-3.5 h-3.5" />Overdue</span>}
                    {dueState === 'today' && <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><Clock className="w-3.5 h-3.5" />Due Today</span>}
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs gap-1 shrink-0" onClick={() => setEditing(true)}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              </div>

              {task.assigned_to && (
                <p className="text-xs text-muted-foreground">Assigned to <span className="font-medium text-foreground">{task.assigned_to}</span></p>
              )}
              {task.due_date && (
                <p className="text-xs text-muted-foreground">Due <span className="font-medium text-foreground">{format(parseISO(task.due_date), 'MMMM d, yyyy')}</span></p>
              )}
            </motion.div>

            {/* Content */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              {task.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{task.description}</p>
                </div>
              )}
              {task.notes && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{task.notes}</p>
                </div>
              )}
              {task.completion_notes && (
                <div className="pt-3 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Completion Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{task.completion_notes}</p>
                </div>
              )}
              {!task.description && !task.notes && !task.completion_notes && (
                <p className="text-sm text-muted-foreground">No details added.</p>
              )}
            </div>

            {/* Photos */}
            {photos.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Photos ({photos.length})</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((url, i) => (
                    <button key={url} onClick={() => setLightboxIndex(i)} className="aspect-square rounded-xl overflow-hidden bg-muted hover:opacity-90 transition-opacity">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Update Status</p>
              <div className="grid grid-cols-2 gap-2">
                {!['completed','closed','canceled'].includes(task.status) && (
                  <Button className="h-9 rounded-xl text-sm gap-2" onClick={() => setStatusNoteShown(true)}>
                    <CheckCircle2 className="w-4 h-4" /> Mark Complete
                  </Button>
                )}
                <Select value={task.status} onValueChange={changeStatus}>
                  <SelectTrigger className="h-9 rounded-xl text-sm col-span-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([v, c]) => <SelectItem key={v} value={v}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {statusNoteShown && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-1">
                  <Textarea value={completionNote} onChange={e => setCompletionNote(e.target.value)} placeholder="Optional completion notes..." className="rounded-lg text-sm min-h-14" />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setStatusNoteShown(false)}>Cancel</Button>
                    <Button size="sm" className="rounded-lg gap-1" onClick={saveCompletionNote}><Save className="w-3.5 h-3.5" />Save & Complete</Button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Job link */}
            {task.job_id && (
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Linked Job</p>
                <button onClick={() => navigate(`/approve?jobId=${task.job_id}`)} className="text-sm text-primary underline underline-offset-2">
                  {task.job_address || task.job_title}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <PhotoLightbox photos={photos} index={lightboxIndex} onClose={() => setLightboxIndex(null)}
        onNav={dir => setLightboxIndex(i => (i + dir + photos.length) % photos.length)} />
    </AppLayout>
  );
}