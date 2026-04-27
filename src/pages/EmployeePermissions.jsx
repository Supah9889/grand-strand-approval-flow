import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AppLayout from '../components/AppLayout';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, ShieldCheck, User, ChevronDown, ChevronUp, Save, RotateCcw, Info } from 'lucide-react';
import { isAdmin, isOwnerOnly, getSessionEmployee } from '@/lib/adminAuth';
import { PERMISSIONS, PERMISSION_CATEGORIES, getRoleDefaults, resolvePermissions } from '@/lib/permissions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const ROLES = [
  { key: 'owner', label: 'Owner', icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', headerBg: 'bg-amber-50' },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, color: 'text-primary', bg: 'bg-primary/10 border-primary/30', headerBg: 'bg-primary/5' },
  { key: 'staff', label: 'Staff', icon: User, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', headerBg: 'bg-blue-50/50' },
];

function parseJson(str) {
  try { return JSON.parse(str || '{}'); } catch { return {}; }
}

// ── Role Permission Row ────────────────────────────────────────────────────────
function PermissionRow({ permKey, permDef, roleStates, onToggle, canEdit, defaults }) {
  return (
    <div className="grid grid-cols-[1fr_repeat(3,56px)] gap-2 items-center py-2 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{permDef.label}</p>
      </div>
      {ROLES.map(role => {
        const isOwner = role.key === 'owner';
        const checked = isOwner ? true : !!roleStates[role.key]?.[permKey];
        const isDefault = defaults[role.key]?.[permKey] === checked;
        return (
          <div key={role.key} className="flex justify-center">
            <button
              disabled={isOwner || !canEdit}
              onClick={() => !isOwner && canEdit && onToggle(role.key, permKey, !checked)}
              aria-label={`Toggle permission for ${role.label}`}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                ${checked
                  ? isOwner ? 'bg-amber-400 border-amber-400' : 'bg-primary border-primary'
                  : 'bg-background border-border hover:border-muted-foreground'
                }
                ${isOwner || !canEdit ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}
                ${!isDefault && !isOwner ? 'ring-2 ring-offset-1 ring-blue-400/60' : ''}
              `}
              title={!isDefault && !isOwner ? 'Customized from default' : undefined}
            >
              {checked && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Category Section ───────────────────────────────────────────────────────────
function CategorySection({ category, roleStates, onToggle, canEdit, defaults }) {
  const [open, setOpen] = useState(true);
  const permsInCat = Object.entries(PERMISSIONS).filter(([, v]) => v.category === category);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{category}</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{permsInCat.length} permissions</span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            transition={{ duration: 0.18 }} className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              {permsInCat.map(([key, def]) => (
                <PermissionRow
                  key={key}
                  permKey={key}
                  permDef={def}
                  roleStates={roleStates}
                  onToggle={onToggle}
                  canEdit={canEdit}
                  defaults={defaults}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Employee Overrides Tab ─────────────────────────────────────────────────────
function EmployeeOverridesTab({ employees, roleStates, canEdit }) {
  const [selectedEmpId, setSelectedEmpId] = useState(null);
  const queryClient = useQueryClient();

  const selectedEmp = employees.find(e => e.id === selectedEmpId);
  const empOverrides = selectedEmp ? parseJson(selectedEmp.permission_overrides) : {};
  const [localOverrides, setLocalOverrides] = useState({});
  const [dirty, setDirty] = useState(false);

  const handleSelect = (emp) => {
    setSelectedEmpId(emp.id);
    setLocalOverrides(parseJson(emp.permission_overrides));
    setDirty(false);
  };

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.Employee.update(selectedEmpId, {
      permission_overrides: JSON.stringify(localOverrides),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDirty(false);
      toast.success('Employee overrides saved');
    },
  });

  const toggleOverride = (key, val) => {
    setLocalOverrides(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  };

  const clearOverride = (key) => {
    setLocalOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDirty(true);
  };

  // Effective permissions for selected employee (role defaults merged with overrides)
  const empRole = selectedEmp?.role === 'admin' ? 'admin' : 'staff';
  const roleBasePerms = roleStates[empRole] || getRoleDefaults(empRole);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {/* Employee list */}
        <div className="w-48 shrink-0 space-y-1">
          {employees.filter(e => e.active && e.role !== 'owner').map(emp => (
            <button
              key={emp.id}
              onClick={() => handleSelect(emp)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors border
                ${selectedEmpId === emp.id ? 'bg-primary/10 border-primary/30 text-primary font-semibold' : 'bg-card border-border hover:border-primary/20 text-foreground'}`}
            >
              <p className="font-medium truncate">{emp.name}</p>
              <p className="text-muted-foreground capitalize">{emp.role}</p>
            </button>
          ))}
        </div>

        {/* Override editor */}
        <div className="flex-1 min-w-0">
          {!selectedEmp ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground bg-muted/20 rounded-xl border border-border">
              Select an employee to manage their individual overrides
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedEmp.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedEmp.role} · #{selectedEmp.employee_code}</p>
                </div>
                {canEdit && dirty && (
                  <Button size="sm" className="h-8 rounded-xl gap-1.5 text-xs" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5" />Save</>}
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700">
                  Highlighted toggles override the role default. Clear an override to restore role default.
                </p>
              </div>

              {PERMISSION_CATEGORIES.map(cat => {
                const permsInCat = Object.entries(PERMISSIONS).filter(([, v]) => v.category === cat);
                return (
                  <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-2.5 border-b border-border/50 bg-muted/20">
                      {cat}
                    </p>
                    <div className="px-4 divide-y divide-border/50">
                      {permsInCat.map(([key, def]) => {
                        const roleDefault = !!roleBasePerms[key];
                        const hasOverride = key in localOverrides;
                        const effectiveVal = hasOverride ? !!localOverrides[key] : roleDefault;
                        return (
                          <div key={key} className="flex items-center justify-between py-2 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium ${hasOverride ? 'text-blue-700' : 'text-foreground'}`}>{def.label}</p>
                              {hasOverride && (
                                <p className="text-[10px] text-blue-500">
                                  Override: {effectiveVal ? 'granted' : 'denied'} (role default: {roleDefault ? 'on' : 'off'})
                                </p>
                              )}
                              {!hasOverride && (
                                <p className="text-[10px] text-muted-foreground">From role: {roleDefault ? 'on' : 'off'}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {hasOverride && canEdit && (
                                <button onClick={() => clearOverride(key)}
                                  className="text-[10px] text-muted-foreground hover:text-destructive underline" title="Clear override">
                                  clear
                                </button>
                              )}
                              <button
                                disabled={!canEdit}
                                onClick={() => canEdit && toggleOverride(key, !effectiveVal)}
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                                  ${effectiveVal ? 'bg-primary border-primary' : 'bg-background border-border'}
                                  ${hasOverride ? 'ring-2 ring-offset-1 ring-blue-400/60' : ''}
                                  ${!canEdit ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}
                                `}
                              >
                                {effectiveVal && <span className="text-white text-[9px] font-bold leading-none">✓</span>}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function EmployeePermissions() {
  const queryClient = useQueryClient();
  const canView = isAdmin();
  const canEdit = isOwnerOnly() || isAdmin(); // admin can edit too, owner can edit all
  const [activeTab, setActiveTab] = useState('roles'); // 'roles' | 'employees'

  const { data: rolePermRecords = [], isLoading: loadingPerms } = useQuery({
    queryKey: ['role-permissions-all'],
    queryFn: () => base44.entities.RolePermission.list(),
    enabled: canView,
  });

  const { data: employees = [], isLoading: loadingEmps } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('name'),
    enabled: canView,
  });

  // Build local editable state per role from DB records
  const initialRoleStates = useMemo(() => {
    const out = {};
    ROLES.forEach(r => {
      if (r.key === 'owner') return;
      const record = rolePermRecords.find(rp => rp.role === r.key);
      const stored = record ? parseJson(record.permissions) : null;
      out[r.key] = resolvePermissions({ role: r.key, storedRolePerms: stored, employeeOverrides: null });
    });
    return out;
  }, [rolePermRecords]);

  const [roleStates, setRoleStates] = useState({});
  const [dirty, setDirty] = useState(false);

  // Sync local state when DB loads
  React.useEffect(() => {
    if (Object.keys(initialRoleStates).length > 0 && !dirty) {
      setRoleStates(initialRoleStates);
    }
  }, [initialRoleStates]);

  const defaults = useMemo(() => ({
    owner: getRoleDefaults('owner'),
    admin: getRoleDefaults('admin'),
    staff: getRoleDefaults('staff'),
  }), []);

  const handleToggle = (role, permKey, value) => {
    setRoleStates(prev => ({
      ...prev,
      [role]: { ...prev[role], [permKey]: value },
    }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const role of ['admin', 'staff']) {
        const existing = rolePermRecords.find(r => r.role === role);
        const data = { role, permissions: JSON.stringify(roleStates[role] || {}), updated_by: 'owner' };
        if (existing) {
          await base44.entities.RolePermission.update(existing.id, data);
        } else {
          await base44.entities.RolePermission.create(data);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions-all'] });
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
      setDirty(false);
      toast.success('Permissions saved');
    },
  });

  const handleReset = () => {
    setRoleStates(initialRoleStates);
    setDirty(false);
  };

  if (!canView) {
    return (
      <AppLayout title="Employee Permissions">
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
          <ShieldAlert className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">Admin access required to view permissions.</p>
        </div>
      </AppLayout>
    );
  }

  if (loadingPerms || loadingEmps || Object.keys(roleStates).length === 0) {
    return (
      <AppLayout title="Employee Permissions">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Employee Permissions">
      <div className="max-w-4xl mx-auto w-full px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-foreground">Employee Permissions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage role-level access and individual employee overrides
            </p>
          </div>
          {activeTab === 'roles' && canEdit && (
            <div className="flex items-center gap-2">
              {dirty && (
                <Button variant="outline" size="sm" className="h-9 rounded-xl gap-1.5 text-xs" onClick={handleReset}>
                  <RotateCcw className="w-3.5 h-3.5" />Reset
                </Button>
              )}
              <Button size="sm" className="h-9 rounded-xl gap-1.5 text-xs" onClick={() => saveMutation.mutate()}
                disabled={!dirty || saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5" />Save Changes</>}
              </Button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
          {[{ key: 'roles', label: 'Role Defaults' }, { key: 'employees', label: 'Employee Overrides' }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${activeTab === t.key ? 'bg-white shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'roles' && (
          <div className="space-y-4">
            {/* Role legend + column headers */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_repeat(3,56px)] gap-2 items-center px-4 py-3 border-b border-border bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground">Permission</p>
                {ROLES.map(role => {
                  const Icon = role.icon;
                  return (
                    <div key={role.key} className="flex flex-col items-center gap-0.5">
                      <Icon className={`w-3.5 h-3.5 ${role.color}`} />
                      <p className={`text-[10px] font-semibold ${role.color}`}>{role.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-4 py-2 border-b border-border/50 bg-muted/10 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded border-2 bg-primary border-primary flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">✓</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Allowed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded border-2 bg-background border-border" />
                  <span className="text-[10px] text-muted-foreground">Denied</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded border-2 bg-primary border-primary ring-2 ring-offset-1 ring-blue-400/60 flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">✓</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Customized from default</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded border-2 bg-amber-400 border-amber-400 flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">✓</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Owner (locked on)</span>
                </div>
              </div>
            </div>

            {!canEdit && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700">View only. Only Owner can save role-level permission changes.</p>
              </div>
            )}

            {/* Category sections */}
            {PERMISSION_CATEGORIES.map(cat => (
              <CategorySection
                key={cat}
                category={cat}
                roleStates={roleStates}
                onToggle={handleToggle}
                canEdit={canEdit}
                defaults={defaults}
              />
            ))}
          </div>
        )}

        {activeTab === 'employees' && (
          <EmployeeOverridesTab
            employees={employees}
            roleStates={roleStates}
            canEdit={canEdit}
          />
        )}
      </div>
    </AppLayout>
  );
}