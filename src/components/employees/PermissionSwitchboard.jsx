/**
 * PermissionSwitchboard — lets Owner/Admin grant or revoke role-based permissions
 * for an individual employee record.
 *
 * Permissions are stored on the Employee entity as:
 *   - employee.role: 'admin' | 'staff' | 'field'
 *   - employee.allowed_cost_codes: JSON array
 *   - (future: granular permission flags can be added here)
 */
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, ShieldAlert, User, Loader2, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { isOwnerOnly, isAdmin } from '@/lib/adminAuth';
import { getRoleDefaults } from '@/lib/permissions';

const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Full access: financials, employees, all management',
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/30',
    Icon: ShieldAlert,
  },
  {
    value: 'staff',
    label: 'Staff',
    description: 'Coordination, sales, limited management access',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    Icon: ShieldCheck,
  },
  {
    value: 'field',
    label: 'Field',
    description: 'Time clock, calendar, and job file access only',
    color: 'text-muted-foreground',
    bg: 'bg-muted border-border',
    Icon: User,
  },
];

export default function PermissionSwitchboard({ employee }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const canEditRole = isOwnerOnly(); // Only owner can change role; admin can view
  const canEditOverrides = isAdmin() || isOwnerOnly();

  const roleMutation = useMutation({
    mutationFn: (role) => base44.entities.Employee.update(employee.id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Permission level updated');
    },
  });

  const overrideMutation = useMutation({
    mutationFn: (overrides) => base44.entities.Employee.update(employee.id, {
      permission_overrides: JSON.stringify(overrides),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Permission updated');
    },
  });

  const currentOverrides = (() => {
    try { return JSON.parse(employee.permission_overrides || '{}'); } catch { return {}; }
  })();

  const roleDefaults = getRoleDefaults(employee.role || 'field');

  // Effective value: override if set, otherwise role default
  const getEffective = (key) => {
    if (key in currentOverrides) return !!currentOverrides[key];
    return !!roleDefaults[key];
  };

  const toggleOverride = (key) => {
    const current = getEffective(key);
    const newOverrides = { ...currentOverrides, [key]: !current };
    overrideMutation.mutate(newOverrides);
  };

  const currentRole = employee.role || 'field';
  const currentConfig = ROLE_OPTIONS.find(r => r.value === currentRole) || ROLE_OPTIONS[2];
  const CurrentIcon = currentConfig.Icon;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-xs font-semibold text-foreground uppercase tracking-wide"
      >
        <span className="flex items-center gap-1.5">
          <CurrentIcon className={`w-3.5 h-3.5 ${currentConfig.color}`} />
          Permissions
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-2 pt-1">
          {!canEditRole && (
            <p className="text-[10px] text-muted-foreground italic">
              Only Owner can change permission levels. You can view the current assignment below.
            </p>
          )}
          {ROLE_OPTIONS.map(opt => {
            const isSelected = currentRole === opt.value;
            const OptIcon = opt.Icon;
            return (
              <button
                key={opt.value}
                disabled={!canEditRole || roleMutation.isPending}
                onClick={() => {
                  if (!canEditRole) return;
                  if (isSelected) return;
                  roleMutation.mutate(opt.value);
                }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                  ${isSelected ? opt.bg + ' ring-1 ring-inset ring-current/20' : 'bg-card border-border hover:border-muted-foreground/30'}
                  ${!canEditRole ? 'cursor-default' : 'cursor-pointer'}
                  ${roleMutation.isPending ? 'opacity-50' : ''}
                `}
              >
                <OptIcon className={`w-4 h-4 mt-0.5 shrink-0 ${isSelected ? opt.color : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isSelected ? opt.color : 'text-foreground'}`}>{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
                {isSelected && roleMutation.isPending && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground mt-0.5" />
                )}
                {isSelected && !roleMutation.isPending && (
                  <span className={`text-[10px] font-semibold mt-0.5 ${opt.color}`}>✓ Active</span>
                )}
              </button>
            );
          })}

          {/* Granular permission overrides */}
          <div className="pt-2 border-t border-border space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Permission Overrides</p>
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border bg-card ${!canEditOverrides ? 'opacity-60' : ''}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <Share2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Share Files with Clients/Vendors</p>
                  <p className="text-[10px] text-muted-foreground">Can set file visibility to client, vendor, or both when uploading</p>
                </div>
              </div>
              <button
                disabled={!canEditOverrides || overrideMutation.isPending}
                onClick={() => canEditOverrides && toggleOverride('share_files_externally')}
                className={`relative shrink-0 ml-3 w-9 h-5 rounded-full transition-colors ${getEffective('share_files_externally') ? 'bg-primary' : 'bg-muted'} ${!canEditOverrides ? 'cursor-default' : 'cursor-pointer'}`}
                aria-label="Toggle file sharing permission"
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${getEffective('share_files_externally') ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}