import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "office", "field", "staff"]);
const ROLE_TO_MEMBERSHIP_ROLE = {
  owner: "owner",
  admin: "operations_admin",
  manager: "operations_admin",
  office: "office_support",
  field: "field_technician",
  staff: "office_support",
};
const ROLE_TO_PERMISSION_GROUP = {
  owner: "owner",
  admin: "full_admin",
  manager: "operations_admin",
  office: "office_support",
  field: "field_technician",
  staff: "office_support",
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizeRole(value) {
  const role = clean(value).toLowerCase();
  return ALLOWED_ROLES.has(role) ? role : "field";
}

function parseCompanyIds(value) {
  if (Array.isArray(value)) return [...new Set(value.map(clean).filter(Boolean))];
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parseCompanyIds(parsed) : [];
  } catch {
    return [];
  }
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getEntities(base44) {
  return base44.asServiceRole?.entities || base44.entities;
}

async function findInvite(entities, token) {
  const hash = await sha256Hex(token);
  const records = await entities.EmployeeInvite.filter({ invite_token_hash: hash }).catch(() => []);
  return records?.[0] || null;
}

function requireAcceptableInvite(invite) {
  if (!invite) throw Object.assign(new Error("Forbidden: invalid invite token"), { status: 403 });
  if (invite.status === "accepted") throw Object.assign(new Error("Forbidden: invite has already been accepted"), { status: 403 });
  if (invite.status === "revoked") throw Object.assign(new Error("Forbidden: invite has been revoked"), { status: 403 });
  if (invite.status !== "sent") throw Object.assign(new Error("Forbidden: invite is not active"), { status: 403 });
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    throw Object.assign(new Error("Forbidden: invite has expired"), { status: 403 });
  }
}

function validateEmployeeCode(code, required) {
  const value = clean(code);
  if (!required && !value) return "";
  if (value.length < 4 || value.length > 20) {
    throw Object.assign(new Error("Employee PIN/code must be 4 to 20 characters."), { status: 400 });
  }
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw Object.assign(new Error("Employee PIN/code contains unsupported characters."), { status: 400 });
  }
  return value;
}

async function loadCompanies(entities, companyIds) {
  const batches = await Promise.all(companyIds.map((id) => entities.Company.filter({ id }).catch(() => [])));
  return batches.flat().filter((company) => companyIds.includes(company?.id));
}

async function createOrUpdateEmployee(entities, invite, employeeCode) {
  const email = normalizeEmail(invite.email);
  const existingById = invite.employee_id ? await entities.Employee.filter({ id: invite.employee_id }).catch(() => []) : [];
  const existingByEmail = email ? await entities.Employee.filter({ email }).catch(() => []) : [];
  const existing = existingById[0] || existingByEmail[0] || null;
  const payload = {
    name: invite.name,
    email,
    phone: invite.phone || existing?.phone || "",
    role: normalizeRole(invite.role),
    employee_code: employeeCode || invite.employee_code || existing?.employee_code,
    active: true,
    invite_status: "accepted",
    invite_token: null,
    invite_token_expires: invite.expires_at,
    verification_status: "verified",
    verification_date: new Date().toISOString(),
  };
  if (!payload.employee_code) {
    throw Object.assign(new Error("Employee PIN/code is required."), { status: 400 });
  }
  if (existing?.id) {
    await entities.Employee.update(existing.id, payload);
    return { ...existing, ...payload, id: existing.id };
  }
  return entities.Employee.create(payload);
}

async function upsertMemberships(entities, invite, employee, companies) {
  const role = normalizeRole(invite.role);
  const membershipRole = ROLE_TO_MEMBERSHIP_ROLE[role] || "field_technician";
  const permissionGroup = invite.permission_group || ROLE_TO_PERMISSION_GROUP[role] || membershipRole;
  const companyIds = parseCompanyIds(invite.company_ids);
  const results = [];
  for (const companyId of companyIds) {
    const company = companies.find((item) => item.id === companyId) || {};
    const existing = await entities.CompanyMembership.filter({ employee_id: employee.id, company_id: companyId }).catch(() => []);
    const payload = {
      company_id: companyId,
      company_slug: company.slug || "",
      company_name: company.name || "",
      employee_id: employee.id,
      employee_name: employee.name,
      role: membershipRole,
      permission_group: permissionGroup,
      is_active: true,
      can_manage_users: role === "owner" || role === "admin",
      can_view_financials: role === "owner" || role === "admin",
      can_edit_financials: role === "owner" || role === "admin",
      notes: "Created from employee invite acceptance.",
    };
    if (existing?.[0]?.id) {
      await entities.CompanyMembership.update(existing[0].id, payload);
      results.push({ ...existing[0], ...payload, id: existing[0].id });
    } else {
      results.push(await entities.CompanyMembership.create(payload));
    }
  }
  return results;
}

function safeEmployee(employee) {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    employee_code: employee.employee_code,
    active: employee.active,
  };
}

function safeCompany(company) {
  return company ? { id: company.id, name: company.name || "", slug: company.slug || "" } : null;
}

function errorResponse(error) {
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? "Internal server error" : error.message;
  if (status >= 500) console.error(error);
  return json({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson(req);
    const token = clean(body.token || body.access_token || body.invite_token);
    if (!token) return json({ error: "Unauthorized: invite token is required" }, 401);

    const base44 = createClientFromRequest(req);
    const entities = getEntities(base44);
    const invite = await findInvite(entities, token);
    requireAcceptableInvite(invite);

    const providedEmail = normalizeEmail(body.email);
    if (!providedEmail) {
      throw Object.assign(new Error("Email confirmation is required."), { status: 400 });
    }
    if (providedEmail !== normalizeEmail(invite.email)) {
      throw Object.assign(new Error("Forbidden: invite email does not match"), { status: 403 });
    }

    const employeeCode = validateEmployeeCode(body.employee_code || body.employeeCode, invite.requires_pin_setup === true);
    const companyIds = parseCompanyIds(invite.company_ids);
    if (!companyIds.length) throw Object.assign(new Error("Forbidden: invite has no company assignments"), { status: 403 });
    const companies = await loadCompanies(entities, companyIds);
    if (companies.length !== companyIds.length) {
      throw Object.assign(new Error("Forbidden: invite company context unavailable"), { status: 403 });
    }

    const employee = await createOrUpdateEmployee(entities, invite, employeeCode);
    const memberships = await upsertMemberships(entities, invite, employee, companies);
    const acceptedAt = new Date().toISOString();
    await entities.EmployeeInvite.update(invite.id, {
      status: "accepted",
      accepted_at: acceptedAt,
      accepted_by_email: normalizeEmail(invite.email),
      employee_id: employee.id,
      invite_token_hash: "",
    });

    const defaultCompany = companies.find((company) => company.id === invite.default_company_id) || companies[0];

    return json({
      ok: true,
      employee: safeEmployee(employee),
      memberships: memberships.map((membership) => ({
        id: membership.id,
        company_id: membership.company_id,
        role: membership.role,
        permission_group: membership.permission_group,
        is_active: membership.is_active,
      })),
      defaultCompany: safeCompany(defaultCompany),
      acceptedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
