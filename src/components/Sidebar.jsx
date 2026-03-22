import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, LayoutDashboard, Search, ShieldAlert, Clock,
  FileText, Building2, Receipt, CalendarDays, Users,
  List, ChevronDown, Plus, StickyNote, TrendingUp, ClipboardList, BookOpen, CheckSquare, FolderOpen, FileDiff, Globe, DollarSign, ShoppingCart, CreditCard, ShieldCheck
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { getInternalRole } from '@/lib/adminAuth';
import NewJobModal from './NewJobModal';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const NAV_GROUPS = [
  {
    label: 'Main',
    defaultOpen: true,
    adminOnly: false,
    items: [
      { label: 'Dashboard',  to: '/dashboard', icon: LayoutDashboard },
      { label: 'Job Search', to: '/search',    icon: Search },
    ],
  },
  {
    label: 'Field',
    defaultOpen: false,
    adminOnly: false,
    items: [
      { label: 'Time Clock',   to: '/time-clock',  icon: Clock },
      { label: 'Time Entries', to: '/time-entries', icon: List },
    ],
  },
  {
    label: 'Coordination',
    defaultOpen: false,
    adminOnly: false,
    items: [
      { label: 'Calendar',    to: '/calendar',    icon: CalendarDays },
      { label: 'Daily Logs',  to: '/daily-logs',  icon: BookOpen },
      { label: 'Warranty',    to: '/warranty',    icon: ShieldCheck },
      { label: 'Tasks',       to: '/tasks',       icon: CheckSquare },
      { label: 'Job Files',   to: '/job-comms',   icon: FolderOpen },
      { label: 'Notes',       to: '/notes',       icon: StickyNote, badge: true },
    ],
  },
  {
  label: 'Sales & CRM',
  defaultOpen: false,
  adminOnly: true,
  items: [
    { label: 'Sales / CRM',    to: '/sales',          icon: TrendingUp },
    { label: 'Estimates',      to: '/estimates',       icon: ClipboardList },
    { label: 'Change Orders',  to: '/change-orders',  icon: FileDiff },
  ],
  },
  {
    label: 'Management',
    defaultOpen: false,
    adminOnly: true,
    items: [
        { label: 'Financials',      to: '/financials',       icon: DollarSign },
      { label: 'Purchase Orders', to: '/purchase-orders',  icon: ShoppingCart },
      { label: 'Bills',           to: '/bills',            icon: Receipt },
      { label: 'Invoices',        to: '/invoices',         icon: FileText },
      { label: 'Payments',        to: '/payments',         icon: CreditCard },
    { label: 'Vendor Bank',     to: '/vendors',           icon: Building2 },
      { label: 'Doc Templates',   to: '/templates', icon: FileText },
      { label: 'Employees',       to: '/employees', icon: Users },
      { label: 'Expenses',        to: '/expenses',  icon: Receipt },
        { label: 'Portal Access',   to: '/portal-manager', icon: Globe },
    { label: 'Admin Mode',      to: '/admin',     icon: ShieldAlert },
    ],
  },
];

function NavGroup({ group, role, location, onClose, unreadNotes }) {
  const [open, setOpen] = useState(group.defaultOpen);

  if (group.adminOnly && role !== 'admin') return null;

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
          {group.label}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 space-y-0.5 pb-1">
              {group.items.map(({ label, to, icon: Icon, badge }) => {
                const isActive = location.pathname + location.search === to ||
                  (location.pathname === to && !location.search);
                const showBadge = badge && unreadNotes > 0;
                return (
                  <Link
                    key={label}
                    to={to}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ml-1 ${
                      isActive
                        ? 'bg-secondary text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                    <span className="flex-1">{label}</span>
                    {showBadge && (
                      <span className="w-4 h-4 bg-destructive text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                        {unreadNotes > 9 ? '9+' : unreadNotes}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const role = getInternalRole();
  const [showNewJob, setShowNewJob] = useState(false);

  const { data: notes = [] } = useQuery({
    queryKey: ['job-notes'],
    queryFn: () => base44.entities.JobNote.list('-created_date', 100),
    enabled: open,
  });
  const unreadNotes = notes.filter(n => !n.read).length;

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={onClose}
            />

            <motion.div
              key="sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <CompanyLogo className="h-9 w-auto" />
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* New Job button */}
              <div className="px-4 pt-4 pb-2">
                <button
                  onClick={() => { setShowNewJob(true); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  New Job
                </button>
              </div>

              {/* Nav groups */}
              <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
                {NAV_GROUPS.map(group => (
                  <NavGroup
                    key={group.label}
                    group={group}
                    role={role}
                    location={location}
                    onClose={onClose}
                    unreadNotes={unreadNotes}
                  />
                ))}
              </nav>

              {/* Role badge */}
              {role && (
                <div className="px-5 py-4 border-t border-border">
                  <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                    role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
                  }`}>
                    <ShieldAlert className="w-3 h-3" />
                    {role === 'admin' ? 'Admin' : 'Staff'} Session
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <NewJobModal open={showNewJob} onClose={() => setShowNewJob(false)} />
    </>
  );
}