export const EMPLOYEE_INVITE_STATUSES = ['draft', 'sent', 'accepted', 'expired', 'revoked'];

export const INTERNAL_EMPLOYEE_ROLES = ['owner', 'admin', 'manager', 'office', 'field', 'staff'];

export const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'office', label: 'Office' },
  { value: 'field', label: 'Field' },
];

export const ROLE_TO_MEMBERSHIP_ROLE = {
  owner: 'owner',
  admin: 'operations_admin',
  manager: 'operations_admin',
  office: 'office_support',
  field: 'field_technician',
  staff: 'office_support',
};

export const ROLE_TO_PERMISSION_GROUP = {
  owner: 'owner',
  admin: 'full_admin',
  manager: 'operations_admin',
  office: 'office_support',
  field: 'field_technician',
  staff: 'office_support',
};

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeInviteEmail(value) {
  return clean(value).toLowerCase();
}

export function normalizeInviteRole(value) {
  const role = clean(value).toLowerCase();
  return INTERNAL_EMPLOYEE_ROLES.includes(role) ? role : 'field';
}

export function parseInviteCompanyIds(value) {
  if (Array.isArray(value)) return [...new Set(value.map(clean).filter(Boolean))];
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parseInviteCompanyIds(parsed) : [];
  } catch {
    return [];
  }
}

export function getEffectiveInviteStatus(invite, nowMs = Date.now()) {
  if (!invite) return 'invalid';
  if (invite.status === 'accepted') return 'accepted';
  if (invite.status === 'revoked') return 'revoked';
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= nowMs) return 'expired';
  return EMPLOYEE_INVITE_STATUSES.includes(invite.status) ? invite.status : 'draft';
}

export function validateInviteForAcceptance(invite, nowMs = Date.now()) {
  const status = getEffectiveInviteStatus(invite, nowMs);
  if (status !== 'sent') return { ok: false, reason: status };
  if (!normalizeInviteEmail(invite.email)) return { ok: false, reason: 'missing_email' };
  if (!parseInviteCompanyIds(invite.company_ids).length) return { ok: false, reason: 'missing_companies' };
  return { ok: true, invite };
}

export function assertInviteEmailMatch(invite, email) {
  const expected = normalizeInviteEmail(invite?.email);
  const actual = normalizeInviteEmail(email);
  if (!expected || !actual) return false;
  return expected === actual;
}

export function validateEmployeeCodeValue(code, required = false) {
  const value = clean(code);
  if (!value) {
    return required
      ? { ok: false, reason: 'missing_employee_code' }
      : { ok: true, value: '' };
  }
  if (value.length < 4 || value.length > 20) {
    return { ok: false, reason: 'invalid_employee_code_length' };
  }
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    return { ok: false, reason: 'invalid_employee_code_characters' };
  }
  return { ok: true, value };
}

export function validateEmployeeInviteDraft(input = {}) {
  const name = clean(input.name);
  const email = normalizeInviteEmail(input.email);
  const companyIds = parseInviteCompanyIds(input.company_ids || input.companyIds);
  const requiresPinSetup = input.requires_pin_setup !== false && input.requiresPinSetup !== false;

  if (!name) return { ok: false, reason: 'missing_name' };
  if (!email) return { ok: false, reason: 'missing_email' };
  if (!companyIds.length) return { ok: false, reason: 'missing_companies' };

  const employeeCode = validateEmployeeCodeValue(
    input.employee_code || input.employeeCode,
    !requiresPinSetup
  );
  if (!employeeCode.ok) return employeeCode;

  return {
    ok: true,
    name,
    email,
    companyIds,
    requiresPinSetup,
    employeeCode: requiresPinSetup ? '' : employeeCode.value,
  };
}

export function validateInviteAcceptanceInput(invite, input = {}, nowMs = Date.now()) {
  const inviteStatus = validateInviteForAcceptance(invite, nowMs);
  if (!inviteStatus.ok) return inviteStatus;
  if (!assertInviteEmailMatch(invite, input.email)) {
    return { ok: false, reason: 'email_mismatch' };
  }

  const employeeCode = validateEmployeeCodeValue(
    input.employee_code || input.employeeCode,
    invite?.requires_pin_setup === true
  );
  if (!employeeCode.ok) return employeeCode;

  return { ok: true, employeeCode: employeeCode.value };
}

export function sanitizeInviteForList(invite) {
  if (!invite) return null;
  const safeInvite = { ...invite };
  delete safeInvite.invite_token_hash;
  delete safeInvite.token;
  delete safeInvite.invite_token;
  return safeInvite;
}

export function buildInviteLink(token, origin = typeof window !== 'undefined' ? window.location.origin : '') {
  const encoded = encodeURIComponent(clean(token));
  return `${origin}/accept-invite?token=${encoded}`;
}

export function createMembershipPayloads(invite, employee, companies = []) {
  const companyIds = parseInviteCompanyIds(invite?.company_ids);
  const role = normalizeInviteRole(invite?.role);
  const membershipRole = ROLE_TO_MEMBERSHIP_ROLE[role] || 'field_technician';
  const permissionGroup = invite?.permission_group || ROLE_TO_PERMISSION_GROUP[role] || membershipRole;

  return companyIds.map((companyId) => {
    const company = companies.find((item) => item.id === companyId || item.company_id === companyId) || {};
    return {
      company_id: companyId,
      company_slug: company.slug || company.company_slug || '',
      company_name: company.name || company.company_name || '',
      employee_id: employee?.id || invite?.employee_id || '',
      employee_name: employee?.name || invite?.name || '',
      role: membershipRole,
      permission_group: permissionGroup,
      is_active: true,
      can_manage_users: role === 'owner' || role === 'admin',
      can_view_financials: role === 'owner' || role === 'admin',
      can_edit_financials: role === 'owner' || role === 'admin',
      notes: 'Created from employee invite acceptance.',
    };
  });
}

export function buildSafeInviteContext(invite, companies = []) {
  if (!invite) return null;
  const companyIds = parseInviteCompanyIds(invite.company_ids);
  return {
    id: invite.id || '',
    name: invite.name || '',
    email: invite.email || '',
    phone: invite.phone || '',
    role: normalizeInviteRole(invite.role),
    company_ids: companyIds,
    default_company_id: invite.default_company_id || companyIds[0] || '',
    companies: companies
      .filter((company) => companyIds.includes(company.id || company.company_id))
      .map((company) => ({
        id: company.id || company.company_id || '',
        name: company.name || company.company_name || '',
        slug: company.slug || company.company_slug || '',
      })),
    permission_group: invite.permission_group || ROLE_TO_PERMISSION_GROUP[normalizeInviteRole(invite.role)] || '',
    requires_pin_setup: invite.requires_pin_setup === true,
    expires_at: invite.expires_at || '',
    status: getEffectiveInviteStatus(invite),
    invited_by: invite.invited_by || '',
    invited_by_email: invite.invited_by_email || '',
  };
}

export function buildInviteEmailBody(inviteContext, inviteLink, inviterName = 'Your administrator') {
  const companyNames = (inviteContext?.companies || []).map((company) => company.name).filter(Boolean);
  const companyLine = companyNames.length ? companyNames.join(', ') : 'your assigned company workspace';
  return `Hi ${inviteContext?.name || 'there'},

You've been invited to Grand Strand Approval Flow for ${companyLine}.

Use this secure invite link to finish setup:
${inviteLink}

This invite expires ${inviteContext?.expires_at ? new Date(inviteContext.expires_at).toLocaleString() : 'soon'} and can only be used once.

Invited by: ${inviterName}

If you did not expect this invite, contact the office before opening the workspace.`;
}

export function canManageEmployeeInvites(actor = {}) {
  const role = normalizeInviteRole(actor.role || actor.sessionRole || actor.employee?.role);
  return role === 'owner' || role === 'admin';
}
