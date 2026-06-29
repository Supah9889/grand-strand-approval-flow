import { createClientFromRequest } from "npm:@base44/sdk";

const STAFF_UPLOAD_CATEGORIES = new Set([
  "photo",
  "before_photo",
  "progress_photo",
  "after_photo",
  "punch_list_photo",
  "jobsite_photo",
  "warranty_photo",
  "field_documentation",
  "homeowner_reference",
  "other",
]);

const STAFF_READ_PERMISSIONS = new Set([
  "view_job_files",
  "view_documents",
]);

const STAFF_UPLOAD_PERMISSIONS = new Set([
  "view_job_files",
]);

const PUBLIC_SIGNATURE_UPLOAD_PURPOSES = new Set([
  "raw_signature_image",
  "signed_stamped_document",
  "signed_approval_document",
]);

const PUBLIC_SIGNATURE_READ_PURPOSES = new Set([
  "render_signature_image",
  "stamp_source_work_order",
]);

const PUBLIC_SIGNATURE_UPLOAD_TYPES = new Set([
  "image/png",
  "application/pdf",
  "text/html",
]);

const PUBLIC_SIGNATURE_UPLOAD_CATEGORIES = new Set([
  "signed_doc",
  "signature_image",
  "signed_output",
]);

const MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES = 15 * 1024 * 1024;

export function createContext(req) {
  return createClientFromRequest(req);
}

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export function requireEnv(name) {
  const value = Deno.env.get(name);
  if (!value) {
    throw Object.assign(new Error(`Missing required server-side environment variable: ${name}`), {
      status: 500,
    });
  }
  return value;
}

export async function requireUser(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return user;
}

export async function optionalUser(base44) {
  return base44.auth.me().catch(() => null);
}

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function isSafeJobId(jobId) {
  return SAFE_SEGMENT.test(cleanString(jobId));
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
    return segments.length === 5
      && segments[2] === "public-signing"
      && SAFE_SEGMENT.test(segments[3])
      && SAFE_SEGMENT.test(segments[4]);
  }
  return true;
}

function sanitizeFileName(fileName) {
  const raw = cleanString(fileName).split(/[\\/]/).pop() || "";
  const safe = raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[^A-Za-z0-9._ -]/g, "_").replace(/\s+/g, " ").trim();
  if (!safe || safe === "." || safe === "..") return "file";
  return safe.slice(0, 180);
}

export async function resolveActor(base44, user) {
  const entities = base44.asServiceRole?.entities || base44.entities;
  const email = normalizeEmail(user?.email || user?.email_address || user?.username);
  const employees = email
    ? await entities.Employee.filter({ email }).catch(() => [])
    : [];
  const employee = employees?.find((record) => record.active !== false) || null;
  const memberships = employee?.id
    ? await entities.CompanyMembership.filter({ employee_id: employee.id, is_active: true }).catch(() => [])
    : [];

  const rawRole = normalizeRole(employee?.role || user?.role || user?.app_role);
  const role = rawRole === "field" ? "staff" : rawRole;
  const rolePermissions = await loadRolePermissions(entities, role);
  const employeeOverrides = parseJson(
    employee?.permissions_override || employee?.permission_overrides,
    {},
  );

  return {
    user,
    employee,
    memberships,
    id: employee?.id || user?.id || user?._id || email,
    name: employee?.name || user?.full_name || user?.name || email || "Unknown user",
    email,
    role,
    permissions: mergePermissions(role, rolePermissions, employeeOverrides),
  };
}

async function loadRolePermissions(entities, role) {
  if (!role || role === "owner") return {};
  const records = await entities.RolePermission.filter({ role }).catch(() => []);
  return parseJson(records?.[0]?.permissions, {});
}

function mergePermissions(role, rolePermissions, employeeOverrides) {
  if (role === "owner" || role === "admin") {
    return { "*": true };
  }
  return {
    ...rolePermissions,
    ...employeeOverrides,
  };
}

export async function requireJobAccess(base44, actor, jobId) {
  if (!jobId || typeof jobId !== "string") {
    throw Object.assign(new Error("Missing required field: jobId"), { status: 400 });
  }
  if (!isSafeJobId(jobId)) {
    throw Object.assign(new Error("Invalid field: jobId"), { status: 400 });
  }

  const entities = base44.asServiceRole?.entities || base44.entities;
  const jobs = await entities.Job.filter({ id: jobId }).catch(() => []);
  const job = jobs?.[0];
  if (!job) {
    throw Object.assign(new Error("Job not found"), { status: 404 });
  }

  if (!actorHasJobCompanyAccess(actor, job)) {
    throw Object.assign(new Error("Forbidden: company access is required"), { status: 403 });
  }

  if (isAdminActor(actor)) {
    return job;
  }

  const assignments = actor.employee?.id
    ? await entities.JobAssignment.filter({
        job_id: jobId,
        employee_id: actor.employee.id,
      }).catch(() => [])
    : [];

  if (assignments?.length) {
    return job;
  }

  throw Object.assign(new Error("Forbidden: job access is not assigned to this user"), {
    status: 403,
  });
}

export function requireUploadPermission(actor, category) {
  if (isAdminActor(actor)) return;

  if (!hasAnyPermission(actor, STAFF_UPLOAD_PERMISSIONS)) {
    throw Object.assign(new Error("Forbidden: upload permission is required"), { status: 403 });
  }

  if (!STAFF_UPLOAD_CATEGORIES.has(category || "other")) {
    throw Object.assign(
      new Error("Forbidden: staff cannot upload protected legal, signed, financial, or vendor documents"),
      { status: 403 },
    );
  }
}

export function requireReadPermission(actor) {
  if (isAdminActor(actor)) return;

  if (!hasAnyPermission(actor, STAFF_READ_PERMISSIONS)) {
    throw Object.assign(new Error("Forbidden: read permission is required"), { status: 403 });
  }
}

export function normalizeUploadPayload(body) {
  const jobId = cleanString(body.jobId || body.job_id);
  const rawFileName = cleanString(body.fileName || body.file_name);
  const fileName = sanitizeFileName(rawFileName);
  const fileType = cleanString(body.fileType || body.file_type || "application/octet-stream");
  const category = cleanString(body.category || "other");
  const purpose = cleanString(body.purpose || body.action || "upload");
  const fileSize = Number(body.fileSize || body.file_size || 0);
  const publicSigning = body.publicSigning === true || body.public_signing === true;
  const signingToken = cleanString(
    body.signingToken || body.signing_token || body.signatureToken || body.signature_token || body.approvalToken || body.approval_token || body.token,
  );

  if (!rawFileName) {
    throw Object.assign(new Error("Missing required field: fileName"), { status: 400 });
  }

  if (jobId && !isSafeJobId(jobId)) {
    throw Object.assign(new Error("Invalid field: jobId"), { status: 400 });
  }

  if (fileSize < 0) {
    throw Object.assign(new Error("Invalid field: fileSize"), { status: 400 });
  }

  return {
    jobId,
    fileName,
    fileType,
    fileSize,
    category,
    purpose,
    publicSigning,
    signingToken,
  };
}

export function normalizeUploadVerificationPayload(body) {
  const jobId = cleanString(body.jobId || body.job_id);
  const fileKey = cleanString(body.fileKey || body.r2Key || body.r2_key);
  const uploadSessionId = cleanString(body.uploadSessionId || body.upload_session_id);
  const category = cleanString(body.category || "other");
  const purpose = cleanString(body.purpose || body.uploadPurpose || body.upload_purpose || "");
  const publicSigning = body.publicSigning === true || body.public_signing === true;
  const signingToken = cleanString(
    body.signingToken || body.signing_token || body.signatureToken || body.signature_token || body.approvalToken || body.approval_token || body.token,
  );

  if (!fileKey) {
    throw Object.assign(new Error("Missing required field: fileKey or r2Key"), { status: 400 });
  }

  if (jobId && !isSafeJobId(jobId)) {
    throw Object.assign(new Error("Invalid field: jobId"), { status: 400 });
  }

  if (!isSafeR2Key(fileKey)) {
    throw Object.assign(new Error("Invalid field: fileKey"), { status: 400 });
  }

  return {
    jobId,
    fileKey,
    uploadSessionId,
    category,
    purpose,
    publicSigning,
    signingToken,
  };
}

export function normalizeReadPayload(body) {
  const metadata = body.file || body.metadata || {};
  const jobId = cleanString(body.jobId || body.job_id || metadata.job_id || metadata.jobId);
  const fileKey = cleanString(
    body.fileKey || body.r2Key || body.r2_key || metadata.fileKey || metadata.r2Key || metadata.r2_key,
  );
  const category = cleanString(body.category || metadata.category || "other");
  const purpose = cleanString(body.purpose || body.action || "read");
  const publicSigning = body.publicSigning === true || body.public_signing === true;
  const signingToken = cleanString(
    body.signingToken || body.signing_token || body.signatureToken || body.signature_token || body.approvalToken || body.approval_token || body.token,
  );

  if (!fileKey) {
    throw Object.assign(new Error("Missing required field: fileKey or r2Key"), { status: 400 });
  }

  return {
    jobId,
    fileKey,
    category,
    purpose,
    publicSigning,
    signingToken,
    metadata,
  };
}

export function requireScopedFileKey(jobId, fileKey) {
  if (!isSafeR2Key(fileKey)) {
    throw Object.assign(new Error("Invalid field: fileKey"), { status: 400 });
  }
  const expectedPrefix = `jobs/${jobId}/`;
  if (!fileKey.startsWith(expectedPrefix)) {
    throw Object.assign(new Error("Forbidden: file key is not scoped to the requested job"), {
      status: 403,
    });
  }
}

export async function requirePublicSignatureUploadAccess(base44, payload) {
  if (!payload.publicSigning) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  const job = await requirePublicSignableJob(base44, payload.jobId, payload.signingToken);
  if (!PUBLIC_SIGNATURE_UPLOAD_CATEGORIES.has(payload.category)) {
    throw Object.assign(new Error("Forbidden: public signing uploads are limited to signed documents"), {
      status: 403,
    });
  }

  if (!PUBLIC_SIGNATURE_UPLOAD_PURPOSES.has(payload.purpose)) {
    throw Object.assign(new Error("Forbidden: upload purpose is not allowed for public signing"), {
      status: 403,
    });
  }

  if (!PUBLIC_SIGNATURE_UPLOAD_TYPES.has(payload.fileType)) {
    throw Object.assign(new Error("Forbidden: file type is not allowed for public signing"), {
      status: 403,
    });
  }

  if (Number.isFinite(payload.fileSize) && payload.fileSize > MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES) {
    throw Object.assign(new Error("File is too large for public signing upload"), { status: 413 });
  }

  return job;
}

export async function createPublicSignatureUpload(base44, payload) {
  await requirePublicSignatureUploadAccess(base44, payload);

  const uploadSessionId = crypto.randomUUID();
  const fileName = getPublicSignatureFileName(payload.purpose);
  const fileKey = `jobs/${payload.jobId}/public-signing/${uploadSessionId}/${fileName}`;
  const workerResult = await callWorker("/files/public-signing-upload-url", {
    fileKey,
    fileType: payload.fileType,
    maxSize: MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES,
    expiresIn: 300,
  });

  return {
    uploadUrl: workerResult.uploadUrl,
    fileKey,
    uploadSessionId,
    expiresIn: workerResult.expiresIn || 300,
  };
}

export async function verifyPublicSignatureUploadedObject(base44, payload) {
  await requirePublicSignatureUploadAccess(base44, {
    ...payload,
    fileName: payload.fileKey.split("/").pop() || "uploaded-file",
    fileType: inferPublicSignatureFileType(payload),
    fileSize: 0,
  });
  requirePublicSigningUploadKey(payload);

  const headResult = await callWorker("/files/head", {
    fileKey: payload.fileKey,
    jobId: payload.jobId,
    category: payload.category,
    purpose: payload.purpose,
  });
  const actualSize = Number(headResult?.size);
  const expectedContentType = inferPublicSignatureFileType(payload);
  const actualContentType = cleanString(headResult?.httpMetadata?.contentType);

  if (!Number.isFinite(actualSize)) {
    await deleteUploadedFile(payload.fileKey);
    throw Object.assign(new Error("Uploaded file size could not be verified"), { status: 502 });
  }

  if (actualSize > MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES) {
    await deleteUploadedFile(payload.fileKey);
    throw Object.assign(new Error("Uploaded file exceeds the public signing size limit"), {
      status: 413,
    });
  }

  if (actualContentType !== expectedContentType) {
    await deleteUploadedFile(payload.fileKey);
    throw Object.assign(new Error("Uploaded file type is not allowed for public signing"), {
      status: 403,
    });
  }

  return {
    fileKey: payload.fileKey,
    size: actualSize,
    maxSize: MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES,
  };
}

export async function requirePublicSignatureReadAccess(base44, payload) {
  if (!payload.publicSigning) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  const job = await requirePublicSignableJob(base44, payload.jobId, payload.signingToken);
  requireScopedFileKey(payload.jobId, payload.fileKey);

  if (!PUBLIC_SIGNATURE_READ_PURPOSES.has(payload.purpose)) {
    throw Object.assign(new Error("Forbidden: read purpose is not allowed for public signing"), {
      status: 403,
    });
  }

  if (payload.purpose === "stamp_source_work_order") {
    const sourceKey = job.source_work_order_r2_key || keyFromR2Ref(job.source_work_order_file_url);
    if (!sourceKey || payload.fileKey !== sourceKey) {
      throw Object.assign(new Error("Forbidden: source work order does not match this job"), {
        status: 403,
      });
    }
    return job;
  }

  if (payload.purpose === "render_signature_image") {
    if (payload.category !== "signed_doc" || !isPublicSigningFileKey(payload.jobId, payload.fileKey, "signature.png")) {
      throw Object.assign(new Error("Forbidden: signature image read is not allowed"), {
        status: 403,
      });
    }
    return job;
  }

  throw Object.assign(new Error("Forbidden"), { status: 403 });
}

async function requirePublicSignableJob(base44, jobId, signingToken) {
  if (!jobId || typeof jobId !== "string") {
    throw Object.assign(new Error("Missing required field: jobId"), { status: 400 });
  }
  if (!isSafeJobId(jobId)) {
    throw Object.assign(new Error("Invalid field: jobId"), { status: 400 });
  }

  if (!signingToken) {
    throw Object.assign(new Error("Unauthorized: signing token is required"), { status: 401 });
  }

  const entities = base44.asServiceRole?.entities || base44.entities;
  const jobs = await entities.Job.filter({ id: jobId }).catch(() => []);
  const job = jobs?.[0];
  if (!job) {
    throw Object.assign(new Error("Job not found"), { status: 404 });
  }

  if (job.locked || job.status === "approved") {
    throw Object.assign(new Error("Forbidden: job has already been signed"), { status: 403 });
  }

  const grant = await verifySigningGrant(signingToken);
  if (grant.jobId !== jobId) {
    throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  }
  if (grant.scope && grant.scope !== "job-signature") {
    throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  }
  const companyIds = getJobCompanyIds(job);
  if (grant.companyId && companyIds.length && !companyIds.includes(grant.companyId)) {
    throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  }

  return job;
}

function keyFromR2Ref(value) {
  return typeof value === "string" && value.startsWith("r2://") ? value.slice(5) : "";
}

export async function createSigningGrant(jobOrId, expiresInSeconds = 7 * 24 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000);
  const jobId = typeof jobOrId === "string" ? jobOrId : jobOrId?.id;
  const companyId = typeof jobOrId === "string"
    ? ""
    : jobOrId?.company_id || jobOrId?.origin_company_id || jobOrId?.assigned_company_id || jobOrId?.performing_company_id || "";
  const payload = {
    scope: "job-signature",
    jobId,
    companyId,
    iat: now,
    exp: now + Math.min(Number(expiresInSeconds) || 7 * 24 * 60 * 60, 7 * 24 * 60 * 60),
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(encodedPayload, getSigningGrantSecret());
  return `${encodedPayload}.${signature}`;
}

async function verifySigningGrant(token) {
  if (!token || !token.includes(".")) {
    throw Object.assign(new Error("Unauthorized: signing token is required"), { status: 401 });
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = await hmac(encodedPayload, getSigningGrantSecret());
  if (!constantTimeEqual(signature, expectedSignature)) {
    throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload?.jobId || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
      throw new Error("Invalid grant payload");
    }
    return payload;
  } catch {
    throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  }
}

function requirePublicSigningUploadKey(payload) {
  if (!payload.uploadSessionId) {
    throw Object.assign(new Error("Missing required field: uploadSessionId"), { status: 400 });
  }

  const expectedFileName = getPublicSignatureFileName(payload.purpose);
  const expectedKey = `jobs/${payload.jobId}/public-signing/${payload.uploadSessionId}/${expectedFileName}`;
  if (!isSafeR2Key(payload.fileKey, true)) {
    throw Object.assign(new Error("Invalid field: fileKey"), { status: 400 });
  }
  if (payload.fileKey !== expectedKey) {
    throw Object.assign(new Error("Forbidden: upload key does not match this public signing session"), {
      status: 403,
    });
  }
}

function isPublicSigningFileKey(jobId, fileKey, fileName) {
  if (!isSafeR2Key(fileKey, true)) return false;
  const prefix = `jobs/${jobId}/public-signing/`;
  if (!fileKey.startsWith(prefix)) return false;

  const remainingPath = fileKey.slice(prefix.length);
  const segments = remainingPath.split("/");
  return segments.length === 2 && Boolean(segments[0]) && segments[1] === fileName;
}

export async function callWorker(path, payload) {
  const workerBaseUrl = requireEnv("R2_WORKER_BASE_URL").replace(/\/+$/, "");
  const authSecret = requireEnv("R2_WORKER_AUTH_SECRET");
  const response = await fetch(`${workerBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data?.error || "R2 Worker request failed"), {
      status: response.status,
    });
  }

  return data;
}

async function deleteUploadedFile(fileKey) {
  try {
    await callWorker("/files/delete", { fileKey });
  } catch (error) {
    console.error("Failed to delete invalid uploaded file", error);
  }
}

function getSigningGrantSecret() {
  return Deno.env.get("SIGNING_GRANT_SECRET") || requireEnv("R2_WORKER_AUTH_SECRET");
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncode(signature);
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) {
    result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return result === 0;
}

function inferPublicSignatureFileType(payload) {
  if (payload.purpose === "raw_signature_image") return "image/png";
  if (payload.purpose === "signed_stamped_document") return "application/pdf";
  if (payload.purpose === "signed_approval_document") return "text/html";
  return "";
}

function getPublicSignatureFileName(purpose) {
  if (purpose === "raw_signature_image") return "signature.png";
  if (purpose === "signed_stamped_document") return "signed-output.pdf";
  if (purpose === "signed_approval_document") return "signed-output.html";
  throw Object.assign(new Error("Forbidden: upload purpose is not allowed for public signing"), {
    status: 403,
  });
}

export function errorResponse(error) {
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? "Internal server error" : error.message;
  if (status >= 500) {
    console.error(error);
  }
  return json({ error: message }, status);
}

function isAdminActor(actor) {
  return actor?.role === "owner" || actor?.role === "admin";
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

function hasAnyPermission(actor, permissions) {
  if (actor?.permissions?.["*"]) return true;
  for (const permission of permissions) {
    if (actor?.permissions?.[permission]) return true;
  }
  return false;
}

function normalizeRole(role) {
  const value = cleanString(role).toLowerCase();
  if (value === "owner" || value === "admin" || value === "staff" || value === "field") {
    return value;
  }
  return "staff";
}

function normalizeEmail(email) {
  return cleanString(email).toLowerCase();
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJson(value, fallback) {
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
