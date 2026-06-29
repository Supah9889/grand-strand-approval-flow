import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const INVITE_DAYS = 7;
const ALLOWED_ROLES = new Set(["owner", "admin", "manager", "office", "field", "staff"]);
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

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildInviteLink(req, token) {
  const origin = req.headers.get("Origin") || Deno.env.get("APP_BASE_URL") || new URL(req.url).origin;
  return `${origin}/accept-invite?token=${encodeURIComponent(token)}`;
}

function safeInvite(invite) {
  const copy = { ...(invite || {}) };
  delete copy.invite_token_hash;
  delete copy.token;
  delete copy.invite_token;
  return copy;
}

function generatePendingEmployeeCode(name) {
  const prefix = clean(name).replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "EMP";
  return `${prefix}-${randomToken(4).slice(0, 6).toUpperCase()}`;
}

function validateEmployeeCode(code, required) {
  const value = clean(code);
  if (!value) {
    if (required) throw Object.assign(new Error("Employee PIN/code is required."), { status: 400 });
    return "";
  }
  if (value.length < 4 || value.length > 20) {
    throw Object.assign(new Error("Employee PIN/code must be 4 to 20 characters."), { status: 400 });
  }
  if (!/^[A-Za-z0-9._-]+$/.test(value)) {
    throw Object.assign(new Error("Employee PIN/code contains unsupported characters."), { status: 400 });
  }
  return value;
}

function getEntities(base44) {
  return base44.asServiceRole?.entities || base44.entities;
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const entities = getEntities(base44);
  const email = normalizeEmail(user.email || user.email_address || user.username);
  const employees = email ? await entities.Employee.filter({ email }).catch(() => []) : [];
  const employee = employees.find((record) => record.active !== false) || null;
  const role = normalizeRole(employee?.role || user.role || user.app_role);
  if (role !== "owner" && role !== "admin") {
    throw Object.assign(new Error("Forbidden: admin access is required"), { status: 403 });
  }
  return {
    name: employee?.name || user.full_name || user.name || email || "Admin",
    email,
    role,
  };
}

async function loadCompanies(entities, companyIds) {
  const batches = await Promise.all(companyIds.map((id) => entities.Company.filter({ id }).catch(() => [])));
  return batches.flat().filter((company) => companyIds.includes(company?.id));
}

async function createOrUpdatePendingEmployee(entities, inviteData) {
  const existingByEmail = inviteData.email ? await entities.Employee.filter({ email: inviteData.email }).catch(() => []) : [];
  const existing = existingByEmail[0] || null;
  const pendingCode = inviteData.requires_pin_setup
    ? existing?.employee_code || generatePendingEmployeeCode(inviteData.name)
    : inviteData.employee_code || existing?.employee_code || generatePendingEmployeeCode(inviteData.name);
  const employeePayload = {
    name: inviteData.name,
    email: inviteData.email,
    phone: inviteData.phone,
    role: inviteData.role,
    // Employee requires employee_code in Base44 schema. For PIN setup invites,
    // this inactive placeholder is replaced by the employee's chosen PIN at acceptance.
    employee_code: pendingCode,
    active: existing?.active === true ? true : false,
    invite_status: inviteData.status,
    invite_sent_date: inviteData.status === "sent" ? inviteData.last_sent_at : existing?.invite_sent_date,
    invite_token: null,
    invite_token_expires: inviteData.expires_at,
    verification_status: existing?.verification_status || "unverified",
  };
  if (existing?.id) {
    await entities.Employee.update(existing.id, employeePayload);
    return { ...existing, ...employeePayload, id: existing.id };
  }
  return entities.Employee.create(employeePayload);
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
    const name = clean(body.name);
    const email = normalizeEmail(body.email);
    const role = normalizeRole(body.role);
    const companyIds = parseCompanyIds(body.company_ids || body.companyIds);
    const defaultCompanyId = clean(body.default_company_id || body.defaultCompanyId || companyIds[0]);
    if (!name || !email) return json({ error: "Name and email are required." }, 400);
    if (!companyIds.length) return json({ error: "At least one company is required." }, 400);
    if (!companyIds.includes(defaultCompanyId)) return json({ error: "Default company must be assigned." }, 400);

    const base44 = createClientFromRequest(req);
    const actor = await requireAdmin(base44);
    const entities = getEntities(base44);
    const companies = await loadCompanies(entities, companyIds);
    if (companies.length !== companyIds.length) return json({ error: "One or more companies were not found." }, 400);

    const sendNow = body.status !== "draft" && body.send_now !== false && body.sendNow !== false;
    const requiresPinSetup = body.requires_pin_setup !== false && body.requiresPinSetup !== false;
    const employeeCode = validateEmployeeCode(body.employee_code || body.employeeCode, !requiresPinSetup);
    const token = sendNow ? randomToken() : "";
    const now = new Date().toISOString();
    const expiresAt = sendNow
      ? new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : clean(body.expires_at || body.expiresAt);

    const inviteData = {
      name,
      email,
      phone: clean(body.phone),
      role,
      company_ids: JSON.stringify(companyIds),
      default_company_id: defaultCompanyId,
      permission_group: clean(body.permission_group || body.permissionGroup) || ROLE_TO_PERMISSION_GROUP[role],
      requires_pin_setup: requiresPinSetup,
      employee_code: requiresPinSetup ? "" : employeeCode,
      invite_token_hash: token ? await sha256Hex(token) : "",
      expires_at: expiresAt,
      status: sendNow ? "sent" : "draft",
      invited_by: actor.name,
      invited_by_email: actor.email,
      last_sent_at: sendNow ? now : "",
      manual_delivery_required: true,
      notes: clean(body.notes),
    };

    const employee = await createOrUpdatePendingEmployee(entities, inviteData);
    const invite = await entities.EmployeeInvite.create({ ...inviteData, employee_id: employee.id });

    return json({
      ok: true,
      delivery: "manual_or_frontend_email",
      invite: safeInvite(invite),
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        active: employee.active,
        invite_status: employee.invite_status,
      },
      inviteLink: token ? buildInviteLink(req, token) : "",
      expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
