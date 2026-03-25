import React from 'react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { AlertCircle, Clock, Camera, CheckSquare, Square, ListTodo } from 'lucide-react';
import TaskStatusBadge, { PRIORITY_CONFIG } from './TaskStatusBadge';

const TYPE_ICON = { todo: ListTodo, task: CheckSquare, punch_list: Square };
const TYPE_LABEL = { todo: 'To-Do', task: 'Task', punch_list: 'Punch List' };

function dueDateState(due_date, status) {
  if (!due_date || status === 'completed' || status === 'closed' || status === 'canceled') return null;
  const d = parseISO(due_date);
  if (isPast(d) && !isToday(d)) return 'overdue';
  if (isToday(d)) return 'today';
  return 'upcoming';
}

export default function TaskCard({ task, onClick, 'aria-label': ariaLabel }) {
  const photos = (() => { try { return JSON.parse(task.photos || '[]'); } catch { return []; } })();
  const TypeIcon = TYPE_ICON[task.task_type] || CheckSquare;
  const pCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normal;
  const dueState = dueDateState(task.due_date, task.status);

  return (
    <button 
      onClick={onClick} 
      aria-label={ariaLabel}
      className="w-full text-left bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${pCfg.dot}`} />
            <TypeIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">{TYPE_LABEL[task.task_type]}</span>
          </div>
          <p className={`text-sm font-semibold text-foreground ${task.status === 'completed' || task.status === 'closed' ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </p>
          {task.job_address && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.job_address}</p>}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {task.assigned_to && <span className="text-xs text-muted-foreground">→ {task.assigned_to}</span>}
            {dueState === 'overdue' && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertCircle className="w-3 h-3" />Overdue</span>
            )}
            {dueState === 'today' && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium"><Clock className="w-3 h-3" />Due Today</span>
            )}
            {dueState === 'upcoming' && task.due_date && (
              <span className="text-xs text-muted-foreground">Due {format(parseISO(task.due_date), 'MMM d')}</span>
            )}
            {photos.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Camera className="w-3 h-3" />{photos.length}</span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <TaskStatusBadge status={task.status} />
        </div>
      </div>
    </button>
  );
}