import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, LayoutDashboard, Search, PenLine, CheckCircle2,
  Archive, ShieldAlert, Clock, FileText, Building2,
  Receipt, CalendarDays, Users, List, ChevronDown, Plus, Briefcase
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { getInternalRole } from '@/lib/adminAuth';
import NewJobModal from './NewJobModal';

const NAV_GROUPS = [
  {
    label: 'Main',
    defaultOpen: true,
    items: [
      { label: 'Dashboard',          to: '/dashboard',                  icon: LayoutDashboard },
      { label: 'Job Search',         to: '/search',                     icon: Search },
      { label: 'Pending Signatures', to: '/dashboard?section=pending',  icon: PenLine },
      { label: 'Signed Jobs',        to: '/dashboard?section=approved', icon: CheckCircle2 },
      { label: 'Archived Jobs',      to: '/dashboard?section=archived', icon: Archive },
    ],
  },
  {
    label: 'Field',
    defaultOpen: false,
    items: [
      { label: 'Time Clock',   to: '/time-clock',   icon: Clock },
      { label: 'Time Entries', to: '/time-entries',  icon: List },
      { label: 'Expenses',     to: '/expenses',      icon: Receipt },
    ],
  },
  {
    label: 'Coordination',
    defaultOpen: false,
    items: [
      { label: 'Calendar',      to: '/calendar',   icon: CalendarDays },
      { label: 'Vendor Bank',   to: '/vendors',    icon: Building2 },
      { label: 'Doc Templates', to: '/templates',  icon: FileText },
      { label: 'Employees',     to: '/employees',  icon: Users,      adminOnly: true },
      { label: 'Admin Mode',    to: '/admin',      icon: ShieldAlert, adminOnly: true },
    ],
  },
];

function NavGroup({ group, role, location, onClose }) {
  const [open, setOpen] = useState(group.defaultOpen);
  const visibleItems = group.items.filter(item => !item.adminOnly || role === 'admin');
  if (visibleItems.length === 0) return null;

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
              {visibleItems.map(({ label, to, icon: Icon }) => {
                const isActive = location.pathname + location.search === to ||
                  (location.pathname === to && !location.search);
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
                    {label}
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

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Sidebar panel */}
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

      {/* New Job Modal — rendered outside sidebar so it works after sidebar closes */}
      <NewJobModal open={showNewJob} onClose={() => setShowNewJob(false)} />
    </>
  );
}