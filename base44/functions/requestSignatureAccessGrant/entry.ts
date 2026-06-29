import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

// ── Shared helpers (inlined — no local imports allowed in Base44 functions) ──

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

function requireEnv(name) {
  const value = Deno.env.get(name);
  if (!value) throw Object.assign(new Error(`Missing env: ${name}`), { status: 500 });
  return value;
}

async function requireUser(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  return user;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SIGNING_GRANT_TTL_SECONDS = 7 * 24 * 60 * 60;

function isSafeJobId(jobId) {
  return SAFE_SEGMENT.test(cleanString(jobId));
}

function parseJson(value, fallback) {
  if (!value || typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function isAdminActor(actor) {
  return actor?.role === "owner" || actor?.role === "admin";
}

function normalizeRole(role) {
  const value = cleanString(role).toLowerCase();
  if (["owner","admin","staff","field"].includes(value)) return value;
  return "staff";
}

function normalizeEmail(email) {
  return cleanString(email).toLowerCase();
}

async function loadRolePermissions(entities, role) {
  if (!role || role === "owner") return {};
  const records = await entities.RolePermission.filter({ role }).catch(() => []);
  return parseJson(records?.[0]?.permissions, {});
}

function mergePermissions(role, rolePermissions, employeeOverrides) {
  if (role === "owner" || role === "admin") return { "*": true };
  return { ...rolePermissions, ...employeeOverrides };
}

async function resolveActor(base44, user) {
  const entities = base44.asServiceRole?.entities || base44.entities;
  const email = normalizeEmail(user?.email || user?.email_address || user?.username);
  const employees = email ? await entities.Employee.filter({ email }).catch(() => []) : [];
  const employee = employees?.find(r => r.active !== false) || null;
  const memberships = employee?.id
    ? await entities.CompanyMembership.filter({ employee_id: employee.id, is_active: true }).catch(() => [])
    : [];
  const rawRole = normalizeRole(employee?.role || user?.role || user?.app_role);
  const role = rawRole === "field" ? "staff" : rawRole;
  const rolePermissions = await loadRolePermissions(entities, role);
  const employeeOverrides = parseJson(employee?.permissions_override || employee?.permission_overrides, {});
  return {
    user, employee, memberships,
    id: employee?.id || user?.id || email,
    name: employee?.name || user?.full_name || user?.name || email || "Unknown user",
    email, role,
    permissions: mergePermissions(role, rolePermissions, employeeOverrides),
  };
}

async function requireJobAccess(base44, actor, jobId) {
  if (!jobId || typeof jobId !== "string") throw Object.assign(new Error("Missing required field: jobId"), { status: 400 });
  if (!isSafeJobId(jobId)) throw Object.assign(new Error("Invalid field: jobId"), { status: 400 });
  const entities = base44.asServiceRole?.entities || base44.entities;
  const jobs = await entities.Job.filter({ id: jobId }).catch(() => []);
  const job = jobs?.[0];
  if (!job) throw Object.assign(new Error("Job not found"), { status: 404 });
  if (!actorHasJobCompanyAccess(actor, job)) throw Object.assign(new Error("Forbidden: company access is required"), { status: 403 });
  if (isAdminActor(actor)) return job;
  const assignments = actor.employee?.id
    ? await entities.JobAssignment.filter({ job_id: jobId, employee_id: actor.employee.id }).catch(() => [])
    : [];
  if (assignments?.length) return job;
  throw Object.assign(new Error("Forbidden: job access is not assigned to this user"), { status: 403 });
}

function getJobCompanyIds(job) {
  return [job?.company_id, job?.origin_company_id, job?.assigned_company_id, job?.performing_company_id].filter(Boolean);
}

function actorHasJobCompanyAccess(actor, job) {
  const companyIds = getJobCompanyIds(job);
  if (!companyIds.length) return true;
  if (actor?.employee?.company_id && companyIds.includes(actor.employee.company_id)) return true;
  return (actor?.memberships || []).some(m => m?.is_active !== false && companyIds.includes(m.company_id));
}

function getSigningGrantSecret() {
  return Deno.env.get("SIGNING_GRANT_SECRET") || requireEnv("R2_WORKER_AUTH_SECRET");
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(signature);
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createSigningGrant(job, expiresInSeconds = SIGNING_GRANT_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Math.min(Number(expiresInSeconds) || SIGNING_GRANT_TTL_SECONDS, SIGNING_GRANT_TTL_SECONDS);
  const companyId = job.company_id || job.origin_company_id || job.assigned_company_id || job.performing_company_id || "";
  const payload = {
    scope: "job-signature",
    jobId: job.id,
    companyId,
    iat: now,
    exp: now + ttl,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(encodedPayload, getSigningGrantSecret());
  return `${encodedPayload}.${signature}`;
}

function errorResponse(error) {
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? "Internal server error" : error.message;
  if (status >= 500) console.error(error);
  return json({ error: message }, status);
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson(req);
    const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
    if (!jobId) return json({ error: "Missing required field: jobId" }, 400);

    const base44 = createClientFromRequest(req);
    const user = await requireUser(base44);
    const actor = await resolveActor(base44, user);
    const job = await requireJobAccess(base44, actor, jobId);
    if (job.locked || job.status === "approved") return json({ error: "Job has already been signed" }, 403);

    const token = await createSigningGrant(job);
    return json({ token, expiresIn: SIGNING_GRANT_TTL_SECONDS });
  } catch (error) {
    return errorResponse(error);
  }
});
