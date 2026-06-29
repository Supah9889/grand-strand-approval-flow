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

async function loadCompanies(entities, companyIds) {
  const batches = await Promise.all(companyIds.map((id) => entities.Company.filter({ id }).catch(() => [])));
  return batches.flat().filter((company) => companyIds.includes(company?.id));
}

function requireResolvableInvite(invite) {
  if (!invite) throw Object.assign(new Error("Forbidden: invalid invite token"), { status: 403 });
  if (invite.status === "accepted") throw Object.assign(new Error("Forbidden: invite has already been accepted"), { status: 403 });
  if (invite.status === "revoked") throw Object.assign(new Error("Forbidden: invite has been revoked"), { status: 403 });
  if (invite.status !== "sent") throw Object.assign(new Error("Forbidden: invite is not active"), { status: 403 });
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    throw Object.assign(new Error("Forbidden: invite has expired"), { status: 403 });
  }
}

function safeInviteContext(invite, companies) {
  const companyIds = parseCompanyIds(invite.company_ids);
  return {
    id: invite.id || "",
    name: invite.name || "",
    email: invite.email || "",
    phone: invite.phone || "",
    role: invite.role || "field",
    company_ids: companyIds,
    default_company_id: invite.default_company_id || companyIds[0] || "",
    permission_group: invite.permission_group || "",
    requires_pin_setup: invite.requires_pin_setup === true,
    expires_at: invite.expires_at || "",
    status: invite.status || "",
    invited_by: invite.invited_by || "",
    invited_by_email: invite.invited_by_email || "",
    companies: companies.map((company) => ({
      id: company.id || "",
      name: company.name || "",
      slug: company.slug || "",
    })),
  };
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
    requireResolvableInvite(invite);

    const companyIds = parseCompanyIds(invite.company_ids);
    const companies = await loadCompanies(entities, companyIds);
    if (!companies.length) throw Object.assign(new Error("Forbidden: invite company context unavailable"), { status: 403 });

    return json({ ok: true, invite: safeInviteContext(invite, companies) });
  } catch (error) {
    return errorResponse(error);
  }
});
