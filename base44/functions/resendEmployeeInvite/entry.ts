import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const INVITE_DAYS = 7;
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
  if (["owner", "admin", "manager", "office", "field", "staff"].includes(role)) return role;
  return "field";
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
  return { name: employee?.name || user.full_name || user.name || email || "Admin", email };
}

async function findInvite(entities, body) {
  const inviteId = clean(body.invite_id || body.inviteId);
  if (inviteId) {
    const records = await entities.EmployeeInvite.filter({ id: inviteId }).catch(() => []);
    return records?.[0] || null;
  }
  const employeeId = clean(body.employee_id || body.employeeId);
  if (employeeId) {
    const records = await entities.EmployeeInvite.filter({ employee_id: employeeId }).catch(() => []);
    return records.sort((a, b) => (b.created_date || "").localeCompare(a.created_date || ""))[0] || null;
  }
  return null;
}

function safeInvite(invite) {
  const copy = { ...(invite || {}) };
  delete copy.invite_token_hash;
  delete copy.token;
  delete copy.invite_token;
  return copy;
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

async function loadCompanies(entities, companyIds) {
  const batches = await Promise.all(companyIds.map((id) => entities.Company.filter({ id }).catch(() => [])));
  return batches.flat().filter((company) => companyIds.includes(company?.id));
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
    const base44 = createClientFromRequest(req);
    const actor = await requireAdmin(base44);
    const entities = getEntities(base44);
    const invite = await findInvite(entities, body);
    if (!invite) return json({ error: "Invite not found." }, 404);
    if (invite.status === "accepted") return json({ error: "Accepted invites cannot be resent." }, 400);

    const token = randomToken();
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const updates = {
      status: "sent",
      invite_token_hash: await sha256Hex(token),
      expires_at: expiresAt,
      last_sent_at: now,
      invited_by: actor.name || invite.invited_by,
      invited_by_email: actor.email || invite.invited_by_email,
      manual_delivery_required: true,
    };
    await entities.EmployeeInvite.update(invite.id, updates);
    if (invite.employee_id) {
      await entities.Employee.update(invite.employee_id, {
        invite_status: "sent",
        last_invite_resent_date: now,
        invite_token: null,
        invite_token_expires: expiresAt,
        verification_status: "unverified",
      }).catch(() => null);
    }

    const inviteLink = buildInviteLink(req, token);

    // Attempt email delivery via Resend
    const companyIds = parseCompanyIds(invite.company_ids);
    const companies = await loadCompanies(entities, companyIds);
    const companyNames = companies.map((c) => c.name).filter(Boolean);
    const html = buildInviteEmailHtml(invite.name, companyNames, inviteLink, expiresAt, actor.name);
    const text = buildInviteEmailText(invite.name, companyNames, inviteLink, expiresAt, actor.name);
    const emailResult = await sendViaResend({ to: normalizeEmail(invite.email), subject: INVITE_SUBJECT, html, text });

    return json({
      ok: true,
      invite: safeInvite({ ...invite, ...updates }),
      inviteLink,
      expiresAt,
      email: emailResult,
    });
  } catch (error) {
    return errorResponse(error);
  }
});