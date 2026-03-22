import React from 'react';
import { motion } from 'framer-motion';

// Clickable stat card for dashboard sections
export function StatCard({ icon: Icon, label, value, sub, color, bg, urgent, onClick }) {
  const isClickable = !!onClick;
  return (
    <motion.button
      whileTap={isClickable ? { scale: 0.97 } : {}}
      onClick={onClick}
      disabled={!isClickable}
      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-150 ${
        urgent
          ? 'bg-red-50 border-red-200 hover:border-red-400'
          : isClickable
            ? 'bg-card border-border hover:border-primary/40 hover:shadow-sm cursor-pointer'
            : 'bg-card border-border cursor-default'
      }`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${bg || 'bg-muted'}`}>
        <Icon className={`w-4 h-4 ${color || 'text-foreground'}`} />
      </div>
      <p className={`text-2xl font-black leading-none ${urgent && value > 0 ? 'text-red-600' : 'text-foreground'}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
    </motion.button>
  );
}

// Section header with optional "view all" link
export function SectionHeader({ title, onViewAll, viewAllLabel = 'View All' }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
      {onViewAll && (
        <button onClick={onViewAll} className="text-xs text-primary hover:underline">{viewAllLabel}</button>
      )}
    </div>
  );
}