import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const INVITE_DAYS = 7;

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

    return json({
      ok: true,
      delivery: "manual_or_frontend_email",
      invite: safeInvite({ ...invite, ...updates }),
      inviteLink: buildInviteLink(req, token),
      expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
