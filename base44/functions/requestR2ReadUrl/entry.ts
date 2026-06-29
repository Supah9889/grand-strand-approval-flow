import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

// ── Shared helpers (inlined — no local imports allowed in Base44 functions) ──

const PUBLIC_SIGNATURE_READ_PURPOSES = new Set([
  "render_signature_image",
  "stamp_source_work_order",
]);

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

async function optionalUser(base44) {
  return base44.auth.me().catch(() => null);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function isSafeJobId(jobId) {
  return SAFE_SEGMENT.test(cleanString(jobId));
}

function safeDecodeURIComponent(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function isSafeR2Key(fileKey, publicSigning = false) {
  const key = cleanString(fileKey);
  if (!key || key.length > 1024) return false;
  if (key.startsWith("/") || key.includes("\\") || key.includes("//")) return false;
  if (/[\u0000-\u001f\u007f]/.test(key)) return false;
  const decoded = safeDecodeURIComponent(key);
  if (decoded !== key && !isSafeR2Key(decoded, publicSigning)) return false;
  const segments = key.split("/");
  if (segments.length < 3 || segments[0] !== "jobs") return false;
  if (!isSafeJobId(segments[1])) return false;
  if (segments.some(segment => !segment || segment === "." || segment === "..")) return false;
  if (publicSigning) {
    return segments.length === 5 && segments[2] === "public-signing" && SAFE_SEGMENT.test(segments[3]) && SAFE_SEGMENT.test(segments[4]);
  }
  return true;
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

function requireReadPermission(actor) {
  if (isAdminActor(actor)) return;
  if (!actor?.permissions?.["*"] && !actor?.permissions?.["view_job_files"] && !actor?.permissions?.["view_documents"]) {
    throw Object.assign(new Error("Forbidden: read permission is required"), { status: 403 });
  }
}

function requireScopedFileKey(jobId, fileKey) {
  if (!isSafeR2Key(fileKey)) throw Object.assign(new Error("Invalid field: fileKey"), { status: 400 });
  const expectedPrefix = `jobs/${jobId}/`;
  if (!fileKey.startsWith(expectedPrefix)) throw Object.assign(new Error("Forbidden: file key is not scoped to the requested job"), { status: 403 });
}

function normalizeReadPayload(body) {
  const metadata = body.file || body.metadata || {};
  const jobId = cleanString(body.jobId || body.job_id || metadata.job_id || metadata.jobId);
  const fileKey = cleanString(body.fileKey || body.r2Key || body.r2_key || metadata.fileKey || metadata.r2Key || metadata.r2_key);
  const category = cleanString(body.category || metadata.category || "other");
  const purpose = cleanString(body.purpose || body.action || "read");
  const publicSigning = body.publicSigning === true || body.public_signing === true;
  const signingToken = cleanString(body.signingToken || body.signing_token || body.signatureToken || body.signature_token || body.approvalToken || body.approval_token || body.token);
  if (!fileKey) throw Object.assign(new Error("Missing required field: fileKey or r2Key"), { status: 400 });
  return { jobId, fileKey, category, purpose, publicSigning, signingToken, metadata };
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

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

async function verifySigningGrant(token) {
  if (!token || !token.includes(".")) throw Object.assign(new Error("Unauthorized: signing token is required"), { status: 401 });
  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = await hmac(encodedPayload, getSigningGrantSecret());
  if (!constantTimeEqual(signature, expectedSignature)) throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload?.jobId || Number(payload.exp) < Math.floor(Date.now() / 1000)) throw new Error("Invalid grant payload");
    return payload;
  } catch {
    throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  }
}

async function requirePublicSignableJob(base44, jobId, signingToken) {
  if (!jobId || typeof jobId !== "string") throw Object.assign(new Error("Missing required field: jobId"), { status: 400 });
  if (!isSafeJobId(jobId)) throw Object.assign(new Error("Invalid field: jobId"), { status: 400 });
  if (!signingToken) throw Object.assign(new Error("Unauthorized: signing token is required"), { status: 401 });
  const entities = base44.asServiceRole?.entities || base44.entities;
  const jobs = await entities.Job.filter({ id: jobId }).catch(() => []);
  const job = jobs?.[0];
  if (!job) throw Object.assign(new Error("Job not found"), { status: 404 });
  if (job.locked || job.status === "approved") throw Object.assign(new Error("Forbidden: job has already been signed"), { status: 403 });
  const grant = await verifySigningGrant(signingToken);
  if (grant.jobId !== jobId) throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  if (grant.scope && grant.scope !== "job-signature") throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  const companyIds = getJobCompanyIds(job);
  if (grant.companyId && companyIds.length && !companyIds.includes(grant.companyId)) throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  return job;
}

function keyFromR2Ref(value) {
  return typeof value === "string" && value.startsWith("r2://") ? value.slice(5) : "";
}

function isPublicSigningFileKey(jobId, fileKey, fileName) {
  if (!isSafeR2Key(fileKey, true)) return false;
  const prefix = `jobs/${jobId}/public-signing/`;
  if (!fileKey.startsWith(prefix)) return false;
  const remainingPath = fileKey.slice(prefix.length);
  const segments = remainingPath.split("/");
  return segments.length === 2 && Boolean(segments[0]) && segments[1] === fileName;
}

async function requirePublicSignatureReadAccess(base44, payload) {
  if (!payload.publicSigning) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const job = await requirePublicSignableJob(base44, payload.jobId, payload.signingToken);
  requireScopedFileKey(payload.jobId, payload.fileKey);
  if (!PUBLIC_SIGNATURE_READ_PURPOSES.has(payload.purpose)) throw Object.assign(new Error("Forbidden: read purpose is not allowed for public signing"), { status: 403 });
  if (payload.purpose === "stamp_source_work_order") {
    const sourceKey = job.source_work_order_r2_key || keyFromR2Ref(job.source_work_order_file_url);
    if (!sourceKey || payload.fileKey !== sourceKey) throw Object.assign(new Error("Forbidden: source work order does not match this job"), { status: 403 });
    return job;
  }
  if (payload.purpose === "render_signature_image") {
    if (payload.category !== "signed_doc" || !isPublicSigningFileKey(payload.jobId, payload.fileKey, "signature.png")) {
      throw Object.assign(new Error("Forbidden: signature image read is not allowed"), { status: 403 });
    }
    return job;
  }
  throw Object.assign(new Error("Forbidden"), { status: 403 });
}

async function callWorker(path, payload) {
  const workerBaseUrl = requireEnv("R2_WORKER_BASE_URL").replace(/\/+$/, "");
  const authSecret = requireEnv("R2_WORKER_AUTH_SECRET");
  const response = await fetch(`${workerBaseUrl}${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${authSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error || "R2 Worker request failed"), { status: response.status });
  return data;
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
    const base44 = createClientFromRequest(req);
    const payload = normalizeReadPayload(await readJson(req));

    if (payload.publicSigning) {
      await requirePublicSignatureReadAccess(base44, payload);
    } else {
      const user = await optionalUser(base44);
      if (!user) return json({ error: "Unauthorized" }, 401);
      const actor = await resolveActor(base44, user);
      await requireJobAccess(base44, actor, payload.jobId);
      requireReadPermission(actor);
      requireScopedFileKey(payload.jobId, payload.fileKey);
    }

    const workerResult = await callWorker("/files/read-url", {
      fileKey: payload.fileKey, jobId: payload.jobId, category: payload.category, purpose: payload.purpose,
    });

    return json({
      readUrl: workerResult.signedUrl,
      signedUrl: workerResult.signedUrl,
      fileKey: payload.fileKey,
      r2Key: payload.fileKey,
      expiresIn: workerResult.expiresIn || 300,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
