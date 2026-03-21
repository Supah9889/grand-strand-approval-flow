import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, LayoutDashboard, Search, PenLine, CheckCircle2,
  Archive, ShieldAlert, Home, Clock, FileText, Building2,
  Receipt, CalendarDays, Users, List
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';
import { getInternalRole } from '@/lib/adminAuth';

const NAV_ITEMS = [
  { label: 'Home',               to: '/search',                     icon: Home,           adminOnly: false },
  { label: 'Dashboard',          to: '/dashboard',                  icon: LayoutDashboard, adminOnly: false },
  { label: 'Job Search',         to: '/search',                     icon: Search,          adminOnly: false },
  { label: 'Pending Signatures', to: '/dashboard?section=pending',  icon: PenLine,         adminOnly: false },
  { label: 'Signed Jobs',        to: '/dashboard?section=approved', icon: CheckCircle2,    adminOnly: false },
  { label: 'Archived Jobs',      to: '/dashboard?section=archived', icon: Archive,         adminOnly: false },
  { label: 'Admin Mode',         to: '/admin',                      icon: ShieldAlert,     adminOnly: true  },
];

export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const role = getInternalRole();

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || role === 'admin');

  return (
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
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <CompanyLogo className="h-9 w-auto" />
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
              {visibleItems.map(({ label, to, icon: Icon }) => {
                const isActive = location.pathname + location.search === to ||
                  (to === '/search' && location.pathname === '/search');
                return (
                  <Link
                    key={label}
                    to={to}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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
  );
}