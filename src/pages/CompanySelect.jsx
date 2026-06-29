/**
 * CompanySelect — shown after gate auth if the user belongs to multiple companies.
 * Stores the chosen company_id in sessionStorage so all subsequent pages can filter by it.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getInternalRole, getSessionEmployee } from '@/lib/adminAuth';
import { getVisibleCompaniesForSession } from '@/lib/permissions';
import { ChevronRight, Loader2 } from 'lucide-react';

const COMPANY_KEY = 'active_company';

export function getActiveCompany() {
  try {
    const raw = sessionStorage.getItem(COMPANY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setActiveCompany(company) {
  sessionStorage.setItem(COMPANY_KEY, JSON.stringify(company));
}

export function clearActiveCompany() {
  sessionStorage.removeItem(COMPANY_KEY);
}

const COMPANY_COLORS = {
  DH: 'bg-blue-500',
  GSCP: 'bg-green-600',
};

export default function CompanySelect() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [companies, setCompanies] = useState([]);
  const [adminFallbackActive, setAdminFallbackActive] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState('No companies configured yet.');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAllowedCompanies() {
      try {
        const allCompanies = await base44.entities.Company.list('name', 500);
        const allMemberships = await base44.entities.CompanyMembership.list('created_date', 1000).catch(() => []);
        const employee = getSessionEmployee();
        const sessionRole = getInternalRole();
        const visible = getVisibleCompaniesForSession({
          sessionRole,
          employee,
          companies: allCompanies,
          memberships: allMemberships,
        });

        if (!cancelled) {
          setCompanies(visible.companies);
          setAdminFallbackActive(visible.adminFallbackActive);
          setEmptyMessage(
            visible.emptyReason === 'no_assigned_companies'
              ? 'No assigned companies. Contact an admin.'
              : 'No companies configured yet.'
          );
        }
      } catch {
        if (!cancelled) {
          setCompanies([]);
          setAdminFallbackActive(false);
          setEmptyMessage('No assigned companies. Contact an admin.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAllowedCompanies();
    return () => { cancelled = true; };
  }, []);

  const pick = (company) => {
    queryClient.clear();
    setActiveCompany(company);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Select Company</h1>
          <p className="text-sm text-muted-foreground">Choose which company you're working in today</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            {emptyMessage}
          </div>
        ) : (
          <div className="space-y-3">
            {adminFallbackActive && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Company memberships have not been initialized. Admin fallback access is active.
              </div>
            )}
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => pick(c)}
                className="w-full flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:border-primary/50 hover:shadow-md transition-all text-left"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${COMPANY_COLORS[c.slug] || 'bg-primary'}`}>
                  {c.logo_url
                    ? <img src={c.logo_url} alt={c.name} className="w-8 h-8 object-contain" />
                    : <span className="text-white font-bold text-sm">{c.slug}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.industry || ''}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
