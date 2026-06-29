import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

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

async function deactivateMemberships(entities, employeeId) {
  if (!employeeId) return;
  const memberships = await entities.CompanyMembership.filter({ employee_id: employeeId }).catch(() => []);
  await Promise.all(memberships.map((membership) =>
    entities.CompanyMembership.update(membership.id, { is_active: false }).catch(() => null)
  ));
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
    await requireAdmin(base44);
    const entities = getEntities(base44);
    const invite = await findInvite(entities, body);
    if (!invite) return json({ error: "Invite not found." }, 404);
    if (invite.status === "accepted") return json({ error: "Accepted invites cannot be revoked." }, 400);

    const now = new Date().toISOString();
    const updates = {
      status: "revoked",
      invite_token_hash: "",
      last_revoked_at: now,
    };
    await entities.EmployeeInvite.update(invite.id, updates);
    if (invite.employee_id) {
      await entities.Employee.update(invite.employee_id, {
        active: false,
        invite_status: "revoked",
        invite_token: null,
      }).catch(() => null);
      await deactivateMemberships(entities, invite.employee_id);
    }

    return json({ ok: true, invite: safeInvite({ ...invite, ...updates }) });
  } catch (error) {
    return errorResponse(error);
  }
});
