import React, { useState } from 'react';
import { Link2, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * QBConnectPanel — QuickBooks Online integration outlet.
 *
 * This component is the designated plug-in point for the QuickBooks
 * OAuth integration. When the QB connector is wired up (via Base44
 * app-user connector or a direct OAuth flow), replace the placeholder
 * body below with the real connect/disconnect logic.
 *
 * Connection state is intentionally kept local so it can be swapped
 * out for a real SDK call without touching any surrounding code.
 */

// ── Status configurations ────────────────────────────────────────────────────
const STATUS = {
  disconnected: {
    label: 'Not Connected',
    description: 'Connect your QuickBooks Online company to enable direct sync.',
    icon: AlertCircle,
    iconClass: 'text-amber-500',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  connected: {
    label: 'Connected',
    description: 'QuickBooks Online is connected and ready to sync.',
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    badgeClass: 'bg-green-100 text-green-700',
  },
  error: {
    label: 'Connection Error',
    description: 'There was a problem with the QuickBooks connection. Re-connect to fix.',
    icon: AlertCircle,
    iconClass: 'text-destructive',
    badgeClass: 'bg-destructive/10 text-destructive',
  },
};

export default function QBConnectPanel() {
  // TODO: Replace with real QB connection status from app connector / OAuth SDK.
  const [status, setStatus] = useState('disconnected');
  const [companyName, setCompanyName] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [loading, setLoading] = useState(false);

  const cfg = STATUS[status] || STATUS.disconnected;
  const Icon = cfg.icon;

  // ── Placeholder handlers — swap these for real OAuth / SDK calls ─────────────
  const handleConnect = async () => {
    setLoading(true);
    // TODO: Initiate OAuth flow or call base44.connectors.connectAppUser(QB_CONNECTOR_ID)
    // On success: setStatus('connected'), setCompanyName(result.company_name)
    setTimeout(() => {
      // Simulated connect — remove this block when real auth is wired in
      setStatus('connected');
      setCompanyName('My Company QBO');
      setLastSynced(new Date().toISOString());
      setLoading(false);
    }, 1200);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    // TODO: Call base44.connectors.disconnectAppUser(QB_CONNECTOR_ID)
    setTimeout(() => {
      setStatus('disconnected');
      setCompanyName(null);
      setLastSynced(null);
      setLoading(false);
    }, 800);
  };

  const handleRefresh = async () => {
    setLoading(true);
    // TODO: Call your QB sync/verify backend function
    setTimeout(() => {
      setLastSynced(new Date().toISOString());
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
          <Link2 className="w-4 h-4 text-blue-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">QuickBooks Online</p>
            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${cfg.badgeClass}`}>
              <Icon className="w-2.5 h-2.5" />
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
        </div>
      </div>

      {/* Connected company info */}
      {status === 'connected' && companyName && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-green-800">{companyName}</p>
          {lastSynced && (
            <p className="text-[10px] text-green-700">
              Last verified: {new Date(lastSynced).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {status !== 'connected' ? (
          <Button
            className="w-full h-10 rounded-xl text-sm gap-2"
            onClick={handleConnect}
            disabled={loading}
          >
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting…</>
              : <><ExternalLink className="w-4 h-4" /> Connect QuickBooks Online</>}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 rounded-xl text-xs gap-1.5"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Verify Connection
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-9 rounded-xl text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleDisconnect}
              disabled={loading}
            >
              <Unplug className="w-3.5 h-3.5" />
              Disconnect
            </Button>
          </div>
        )}
      </div>

      {/* Integration notes */}
      <div className="bg-muted/40 rounded-xl px-4 py-3 border border-border">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Integration Scope</p>
        <ul className="space-y-1">
          {[
            'Invoices → QBO Invoices',
            'Bills / Vendor Bills → QBO Bills',
            'Time Entries → QBO Time Activities',
            'Expenses → QBO Purchases',
            'Customers / Jobs → QBO Customers & Projects',
          ].map((item) => (
            <li key={item} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-1 h-1 rounded-full bg-primary/50 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}