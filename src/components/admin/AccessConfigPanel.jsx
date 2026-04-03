/**
 * AccessConfigPanel — Owner-only UI for managing override access codes.
 *
 * Codes are stored in the AccessConfig entity (config_key = "override_codes").
 * Only owner-level sessions can view or edit this panel.
 *
 * After saving, the in-session codes cache is invalidated so the next login
 * attempt re-fetches the updated values from the database.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { invalidateOverrideCodesCache } from '@/lib/adminAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Save, Loader2, ShieldAlert, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_OPTIONS = ['staff', 'admin', 'owner'];
const ROLE_COLORS = {
  staff: 'bg-secondary text-secondary-foreground',
  admin: 'bg-primary/10 text-primary',
  owner: 'bg-amber-100 text-amber-700',
};

export default function AccessConfigPanel({ actorName }) {
  const queryClient = useQueryClient();
  const [showCodes, setShowCodes] = useState(false);
  const [editingCodes, setEditingCodes] = useState(null); // null = not editing
  const [newCode, setNewCode] = useState('');
  const [newRole, setNewRole] = useState('staff');

  // Fetch the override_codes record
  const { data: record, isLoading } = useQuery({
    queryKey: ['access-config-override'],
    queryFn: async () => {
      const records = await base44.entities.AccessConfig.filter({ config_key: 'override_codes' });
      return records?.[0] || null;
    },
  });

  // Parse current codes from record
  const parsedCodes = useMemo(() => {
    if (!record?.config_value) return {};
    try { return JSON.parse(record.config_value); }
    catch { return {}; }
  }, [record]);

  // Initialize edit state when entering edit mode
  const startEditing = () => {
    setEditingCodes({ ...parsedCodes });
    setNewCode('');
    setNewRole('staff');
  };

  const cancelEditing = () => {
    setEditingCodes(null);
    setNewCode('');
    setNewRole('staff');
  };

  const addCode = () => {
    const trimmed = newCode.trim();
    if (!trimmed || !newRole) return;
    if (editingCodes[trimmed]) {
      toast.error('That code already exists');
      return;
    }
    setEditingCodes(prev => ({ ...prev, [trimmed]: newRole }));
    setNewCode('');
    setNewRole('staff');
  };

  const removeCode = (code) => {
    setEditingCodes(prev => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  const changeRole = (code, role) => {
    setEditingCodes(prev => ({ ...prev, [code]: role }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        config_key: 'override_codes',
        config_value: JSON.stringify(editingCodes),
        description: record?.description || 'Override codes for internal role-based access.',
        last_updated_by: actorName || 'owner',
      };
      if (record?.id) {
        await base44.entities.AccessConfig.update(record.id, payload);
      } else {
        await base44.entities.AccessConfig.create(payload);
      }
      // Invalidate the in-session cache so new codes take effect immediately
      invalidateOverrideCodesCache();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-config-override'] });
      setEditingCodes(null);
      toast.success('Access codes updated');
    },
    onError: () => toast.error('Failed to save — try again'),
  });

  const isEditing = editingCodes !== null;
  const displayCodes = isEditing ? editingCodes : parsedCodes;
  const codeEntries = Object.entries(displayCodes);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-foreground">Access Code Manager</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Override codes are stored in the database — no source code changes needed to rotate them.
            Each code maps to a role: <span className="font-medium">staff</span>, <span className="font-medium">admin</span>, or <span className="font-medium">owner</span>.
          </p>
        </div>
        <button
          onClick={() => setShowCodes(v => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          title={showCodes ? 'Hide codes' : 'Show codes'}
        >
          {showCodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* Code table */}
      {codeEntries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          No override codes configured. Add one below.
        </p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Code</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2">Role</th>
                {isEditing && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {codeEntries.map(([code, role]) => (
                <tr key={code} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2 font-mono text-sm">
                    {showCodes ? code : '••••••'}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <select
                        value={role}
                        onChange={e => changeRole(code, e.target.value)}
                        className="text-xs rounded-lg border border-input bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {ROLE_OPTIONS.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_COLORS[role] || 'bg-muted text-muted-foreground'}`}>
                        {role}
                      </span>
                    )}
                  </td>
                  {isEditing && (
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeCode(code)}
                        className="text-destructive hover:text-destructive/70 transition-colors"
                        title="Remove code"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add new code row (edit mode only) */}
      {isEditing && (
        <div className="flex gap-2 items-center">
          <Input
            value={newCode}
            onChange={e => setNewCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCode()}
            placeholder="New code"
            className="h-9 rounded-xl text-sm font-mono flex-1"
          />
          <select
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={addCode}
            disabled={!newCode.trim()}
            className="h-9 rounded-xl shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            onClick={startEditing}
            className="rounded-xl h-9 text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Edit / Rotate Codes
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="rounded-xl h-9 text-xs gap-1.5"
            >
              {saveMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEditing}
              disabled={saveMut.isPending}
              className="rounded-xl h-9 text-xs"
            >
              Cancel
            </Button>
          </>
        )}
      </div>

      {/* Info footer */}
      <div className="bg-muted/40 rounded-xl px-3 py-2.5 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">How access codes work</p>
        <p>Enter any code at the access gate (<span className="font-mono text-[11px]">/gate</span>). If it matches an override code here, you're granted that role immediately.</p>
        <p>If no override code matches, the system checks individual employee codes from the Employee records.</p>
        <p className="text-amber-700">⚠️ Only owner-level sessions can view or edit this panel. Rotate codes here whenever needed — no developer involvement required.</p>
      </div>
    </div>
  );
}