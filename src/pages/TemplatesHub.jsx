import React from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { FileText, Briefcase, ClipboardList, ChevronRight, LayoutTemplate } from 'lucide-react';
import { isAdmin } from '@/lib/adminAuth';

const SECTIONS = [
  {
    path: '/job-templates',
    icon: Briefcase,
    color: 'bg-blue-50 text-blue-600',
    title: 'Job Templates',
    description: 'Pre-configured job setups with required documentation, photo sets, and notes per service line.',
  },
  {
    path: '/work-order-templates',
    icon: ClipboardList,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Work Order Templates',
    description: 'Reusable work order blueprints with scopes, checklists, and documentation requirements.',
  },
  {
    path: '/documentation-requirements',
    icon: FileText,
    color: 'bg-amber-50 text-amber-600',
    title: 'Documentation Requirements',
    description: 'Service-line rules for what must be documented before a job or work order can close.',
  },
];

export default function TemplatesHub() {
  const navigate = useNavigate();
  const admin = isAdmin();

  return (
    <AppLayout title="Templates">
      <div className="app-page max-w-2xl">
        <div className="app-page-header mb-4">
          <div>
            <h1 className="app-page-title flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-primary" /> Templates & Requirements
            </h1>
            <p className="app-page-subtitle">Guide field employees with structured checklists and documentation standards.</p>
          </div>
        </div>

        {!admin && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            View-only mode. Contact an admin to create or edit templates.
          </div>
        )}

        <div className="space-y-3">
          {SECTIONS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.path}
                onClick={() => navigate(s.path)}
                className="w-full text-left app-card p-4 hover:border-primary/40 transition-colors flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${s.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}