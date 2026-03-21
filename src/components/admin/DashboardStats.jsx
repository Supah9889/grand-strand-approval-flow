import React from 'react';
import { PenLine, CheckCircle2, Star, Archive } from 'lucide-react';

const SECTIONS = [
  { key: 'pending',  label: 'Pending Signatures', icon: PenLine,      color: 'text-amber-500',  bg: 'bg-amber-50' },
  { key: 'approved', label: 'Signed Jobs',         icon: CheckCircle2, color: 'text-primary',    bg: 'bg-secondary' },
  { key: 'reviewed', label: 'Reviewed',            icon: Star,         color: 'text-green-600',  bg: 'bg-green-50' },
  { key: 'archived', label: 'Archived',            icon: Archive,      color: 'text-muted-foreground', bg: 'bg-muted' },
];

export default function DashboardStats({ jobs, activeSection, onSelect }) {
  const counts = {
    pending:  jobs.filter(j => j.status === 'pending').length,
    approved: jobs.filter(j => j.status === 'approved' && !j.review_rating).length,
    reviewed: jobs.filter(j => j.status === 'approved' && !!j.review_rating).length,
    archived: jobs.filter(j => j.status === 'archived').length,
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {SECTIONS.map(({ key, label, icon: Icon, color, bg }) => (
        <button
          key={key}
          onClick={() => onSelect(activeSection === key ? null : key)}
          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
            activeSection === key ? 'border-primary' : 'border-border hover:border-primary/30'
          }`}
        >
          <div className={`${bg} w-9 h-9 rounded-lg flex items-center justify-center shrink-0`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div>
            <p className="text-xl font-bold text-foreground leading-none">{counts[key]}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{label}</p>
          </div>
        </button>
      ))}
    </div>
  );
}