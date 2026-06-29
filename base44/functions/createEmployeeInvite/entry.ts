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
const RESEND_FROM = "onboarding@gscustompainting.com";
const INVITE_SUBJECT = "You're invited to Grand Strand Operations";

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

function buildInviteEmailText(name, companyNames, inviteLink, expiresAt, inviterName) {
  const companyLine = companyNames.length ? companyNames.join(", ") : "your assigned company workspace";
  const expiresLine = expiresAt ? new Date(expiresAt).toLocaleString() : "soon";
  return [
    `Hi ${name},`,
    ``,
    `You've been invited to Grand Strand Operations for ${companyLine}.`,
    ``,
    `Use this secure invite link to finish setup:`,
    inviteLink,
    ``,
    `This invite expires ${expiresLine} and can only be used once.`,
    ``,
    `Invited by: ${inviterName}`,
    ``,
    `If you did not expect this invite, contact the office before opening the workspace.`,
  ].join("\n");
}

function buildInviteEmailHtml(name, companyNames, inviteLink, expiresAt, inviterName) {
  const companyLine = companyNames.length ? companyNames.join(", ") : "your assigned company workspace";
  const expiresLine = expiresAt ? new Date(expiresAt).toLocaleString() : "soon";
  return [
    `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">`,
    `<h2 style="color: #0f766e;">You're invited to Grand Strand Operations</h2>`,
    `<p>Hi ${name},</p>`,
    `<p>You've been invited to Grand Strand Operations for <strong>${companyLine}</strong>.</p>`,
    `<p>Use the button below to finish your setup:</p>`,
    `<p style="margin: 24px 0;">`,
    `<a href="${inviteLink}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">Accept Invite</a>`,
    `</p>`,
    `<p style="font-size: 13px; color: #64748b; word-break: break-all;">If the button doesn't work, copy this link:<br/>${inviteLink}</p>`,
    `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`,
    `<p style="font-size: 13px; color: #64748b;">This invite expires ${expiresLine} and can only be used once.</p>`,
    `<p style="font-size: 13px; color: #64748b;">Invited by: ${inviterName}</p>`,
    `<p style="font-size: 12px; color: #94a3b8;">If you did not expect this invite, contact the office before opening the workspace.</p>`,
    `</div>`,
  ].join("");
}

function safeProviderError(result) {
  if (!result) return "Unknown provider error";
  if (typeof result.message === "string") return result.message.slice(0, 200);
  if (typeof result.error === "string") return result.error.slice(0, 200);
  return "Provider returned an error";
}

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { attempted: false, delivered: false, provider: "none", id: "", error: "RESEND_API_KEY not configured" };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: RESEND_FROM, to, subject, html, text }),
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.id) {
      console.log(`[invite-email] resend ok invite to=${to} id=${result.id}`);
      return { attempted: true, delivered: true, provider: "resend", id: result.id, error: "" };
    }
    const safeError = safeProviderError(result);
    console.log(`[invite-email] resend failed to=${to} error=${safeError}`);
    return { attempted: true, delivered: false, provider: "resend", id: "", error: safeError };
  } catch (error) {
    console.log(`[invite-email] resend exception to=${to} error=${error.message || "network error"}`);
    return { attempted: true, delivered: false, provider: "resend", id: "", error: "Email delivery error" };
  }
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

    const inviteLink = token ? buildInviteLink(req, token) : "";

    // Attempt email delivery via Resend if sending now
    let emailResult = { attempted: false, delivered: false, provider: "none", id: "", error: "Email not configured" };
    if (sendNow && inviteLink) {
      const companyNames = companies.map((c) => c.name).filter(Boolean);
      const html = buildInviteEmailHtml(name, companyNames, inviteLink, expiresAt, actor.name);
      const text = buildInviteEmailText(name, companyNames, inviteLink, expiresAt, actor.name);
      emailResult = await sendViaResend({ to: email, subject: INVITE_SUBJECT, html, text });
    }

    return json({
      ok: true,
      invite: safeInvite(invite),
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        active: employee.active,
        invite_status: employee.invite_status,
      },
      inviteLink,
      expiresAt,
      email: emailResult,
    });
  } catch (error) {
    return errorResponse(error);
  }
});