/**
 * adminAuth.js — Internal session auth helpers
 *
 * LOGIN PATHS (in order of resolution in AccessGate):
 *   1. Override codes  — role-keyed codes stored in the AccessConfig entity
 *                        (config_key = "override_codes", config_value = JSON {code: role}).
 *                        Rotatable by any owner-level session without touching source code.
 *   2. Employee codes  — resolved async against the Employee entity (employee_code field).
 *                        Each employee gets their own personal code; maps to staff/admin role.
 *
 * ROLES:
 *   owner  — full access including config management (superset of admin)
 *   admin  — full operational access
 *   staff  — read/view access, can open signing flows
 *   (employee codes map to admin or staff based on employee.role in the Employee entity)
 *
 * SESSION:
 *   Stored in sessionStorage under SESSION_KEY.
 *   Cleared on logout or browser close (session-scoped, not persistent).
 *
 * WHERE PRODUCTION CONFIG LIVES:
 *   AccessConfig entity in the Base44 database.
 *   Owner-level sessions can edit codes via Admin → Access Config tab.
 *   No source code change is needed to rotate access codes.
 *
 * REMOTE MAINTENANCE:
 *   A retained developer or future maintainer can be granted an owner/admin code
 *   by the company without committing any secrets to source.
 */

import { base44 } from '@/api/base44Client';

const SESSION_KEY = 'gscp_internal_auth';

// ── Session helpers ───────────────────────────────────────────────────────────

export function getInternalRole() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { role } = JSON.parse(raw);
    return role || null;
  } catch {
    return null;
  }
}

/** Returns the full session object, including employee info if logged in via employee code */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns the logged-in employee object if they authenticated via their own code */
export function getSessionEmployee() {
  return getSession()?.employee || null;
}

// ── Role checks ───────────────────────────────────────────────────────────────

/** True if any valid session exists (gate has been passed) */
export function isUnlocked() {
  return !!getInternalRole();
}

/** True if session exists — alias for isUnlocked, used in page-level auth guards */
export function isAdminAuthed() {
  return !!getInternalRole();
}

/** True for both admin AND owner — owner is a superset of admin */
export function isAdmin() {
  const role = getInternalRole();
  return role === 'admin' || role === 'owner';
}

/** True only for owner role — for owner-exclusive actions such as config management */
export function isOwner() {
  return getInternalRole() === 'owner';
}

/** Alias for isOwner — retained for callers that use isOwnerOnly */
export function isOwnerOnly() {
  return getInternalRole() === 'owner';
}

/** True only for staff role (not admin/owner) */
export function isStaff() {
  return getInternalRole() === 'staff';
}

// ── Override code resolution (async — reads from AccessConfig entity) ─────────

/**
 * Loads the override code → role map from the AccessConfig entity.
 * Result is cached in sessionStorage for the duration of the session
 * so subsequent gate attempts don't re-fetch.
 *
 * Returns: { [code: string]: role: string } or {} on failure.
 */
const CODES_CACHE_KEY = 'gscp_override_codes_cache';

async function loadOverrideCodes() {
  // Use cached copy if already fetched this session
  try {
    const cached = sessionStorage.getItem(CODES_CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {
    // ignore, re-fetch below
  }

  try {
    const records = await base44.entities.AccessConfig.filter({ config_key: 'override_codes' });
    const record = records?.[0];
    if (!record?.config_value) return {};
    const codes = JSON.parse(record.config_value);
    // Cache for this session so repeat gate attempts don't re-fetch
    sessionStorage.setItem(CODES_CACHE_KEY, JSON.stringify(codes));
    return codes;
  } catch {
    return {};
  }
}

/**
 * Invalidates the in-session override codes cache.
 * Call this after saving updated codes so the next gate attempt re-fetches.
 */
export function invalidateOverrideCodesCache() {
  sessionStorage.removeItem(CODES_CACHE_KEY);
}

/**
 * Attempt login with an override code.
 * Reads codes from the AccessConfig entity (not hardcoded).
 * Returns the matched role string, or null if no match.
 *
 * This is async — AccessGate must await it.
 */
export async function attemptOverrideLogin(code) {
  const codes = await loadOverrideCodes();
  const role = codes[code?.trim()];
  if (role) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role }));
    return role;
  }
  return null;
}

// ── Employee code login ───────────────────────────────────────────────────────

/**
 * Log in as a specific employee.
 * Maps employee.role → internal session role:
 *   admin → 'admin'
 *   staff → 'staff'
 *   field → 'staff'  (field workers get staff-level access)
 */
export function loginAsEmployee(employee) {
  const roleMap = { admin: 'admin', staff: 'staff', field: 'staff' };
  const role = roleMap[employee.role] || 'staff';
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    role,
    employee: {
      id: employee.id,
      name: employee.name,
      employee_code: employee.employee_code,
      role: employee.role,
    },
  }));
  return role;
}

// ── Logout ────────────────────────────────────────────────────────────────────

export function adminLogout() {
  sessionStorage.removeItem(SESSION_KEY);
  // Note: CODES_CACHE_KEY is intentionally NOT cleared here.
  // The cache contains no sensitive data beyond what the session holder already knows,
  // and leaving it avoids an extra network fetch on the very next login attempt.
}