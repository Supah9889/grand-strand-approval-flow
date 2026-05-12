import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

// ── Shared helpers (inlined — no local imports allowed in Base44 functions) ──

const STAFF_UPLOAD_CATEGORIES = new Set([
  "photo","before_photo","progress_photo","after_photo","punch_list_photo",
  "jobsite_photo","warranty_photo","field_documentation","homeowner_reference","other",
]);

const PUBLIC_SIGNATURE_UPLOAD_PURPOSES = new Set([
  "raw_signature_image","signed_stamped_document","signed_approval_document",
]);

const PUBLIC_SIGNATURE_UPLOAD_TYPES = new Set([
  "image/png","application/pdf","text/html",
]);

const PUBLIC_SIGNATURE_UPLOAD_CATEGORIES = new Set([
  "signed_doc","signature_image","signed_output",
]);

const MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES = 15 * 1024 * 1024;

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

function normalizeEmail(email) {
  return cleanString(email).toLowerCase();
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
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
  const rawRole = normalizeRole(employee?.role || user?.role || user?.app_role);
  const role = rawRole === "field" ? "staff" : rawRole;
  const rolePermissions = await loadRolePermissions(entities, role);
  const employeeOverrides = parseJson(employee?.permissions_override || employee?.permission_overrides, {});
  return {
    user, employee,
    id: employee?.id || user?.id || email,
    name: employee?.name || user?.full_name || user?.name || email || "Unknown user",
    email, role,
    permissions: mergePermissions(role, rolePermissions, employeeOverrides),
  };
}

async function requireJobAccess(base44, actor, jobId) {
  if (!jobId || typeof jobId !== "string") throw Object.assign(new Error("Missing required field: jobId"), { status: 400 });
  const entities = base44.asServiceRole?.entities || base44.entities;
  const jobs = await entities.Job.filter({ id: jobId }).catch(() => []);
  const job = jobs?.[0];
  if (!job) throw Object.assign(new Error("Job not found"), { status: 404 });
  if (isAdminActor(actor)) return job;
  const assignments = actor.employee?.id
    ? await entities.JobAssignment.filter({ job_id: jobId, employee_id: actor.employee.id }).catch(() => [])
    : [];
  if (assignments?.length) return job;
  throw Object.assign(new Error("Forbidden: job access is not assigned to this user"), { status: 403 });
}

function requireUploadPermission(actor, category) {
  if (isAdminActor(actor)) return;
  if (!actor?.permissions?.["*"] && !actor?.permissions?.["view_job_files"]) {
    throw Object.assign(new Error("Forbidden: upload permission is required"), { status: 403 });
  }
  if (!STAFF_UPLOAD_CATEGORIES.has(category || "other")) {
    throw Object.assign(new Error("Forbidden: staff cannot upload protected documents"), { status: 403 });
  }
}

function normalizeUploadPayload(body) {
  const jobId = cleanString(body.jobId || body.job_id);
  const fileName = cleanString(body.fileName || body.file_name);
  const fileType = cleanString(body.fileType || body.file_type || "application/octet-stream");
  const category = cleanString(body.category || "other");
  const purpose = cleanString(body.purpose || body.action || "upload");
  const fileSize = Number(body.fileSize || body.file_size || 0);
  const publicSigning = body.publicSigning === true || body.public_signing === true;
  const signingToken = cleanString(body.signingToken || body.signing_token || body.signatureToken || body.signature_token || body.approvalToken || body.approval_token || body.token);
  if (!fileName) throw Object.assign(new Error("Missing required field: fileName"), { status: 400 });
  if (fileSize < 0) throw Object.assign(new Error("Invalid field: fileSize"), { status: 400 });
  return { jobId, fileName, fileType, fileSize, category, purpose, publicSigning, signingToken };
}

function normalizeUploadVerificationPayload(body) {
  const jobId = cleanString(body.jobId || body.job_id);
  const fileKey = cleanString(body.fileKey || body.r2Key || body.r2_key);
  const uploadSessionId = cleanString(body.uploadSessionId || body.upload_session_id);
  const category = cleanString(body.category || "other");
  const purpose = cleanString(body.purpose || body.uploadPurpose || body.upload_purpose || "");
  const publicSigning = body.publicSigning === true || body.public_signing === true;
  const signingToken = cleanString(body.signingToken || body.signing_token || body.signatureToken || body.signature_token || body.approvalToken || body.approval_token || body.token);
  if (!fileKey) throw Object.assign(new Error("Missing required field: fileKey or r2Key"), { status: 400 });
  return { jobId, fileKey, uploadSessionId, category, purpose, publicSigning, signingToken };
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
  if (!signingToken) throw Object.assign(new Error("Unauthorized: signing token is required"), { status: 401 });
  const entities = base44.asServiceRole?.entities || base44.entities;
  const jobs = await entities.Job.filter({ id: jobId }).catch(() => []);
  const job = jobs?.[0];
  if (!job) throw Object.assign(new Error("Job not found"), { status: 404 });
  if (job.locked || job.status === "approved") throw Object.assign(new Error("Forbidden: job has already been signed"), { status: 403 });
  const grant = await verifySigningGrant(signingToken);
  if (grant.jobId !== jobId) throw Object.assign(new Error("Forbidden: invalid signing token"), { status: 403 });
  return job;
}

async function requirePublicSignatureUploadAccess(base44, payload) {
  if (!payload.publicSigning) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const job = await requirePublicSignableJob(base44, payload.jobId, payload.signingToken);
  if (!PUBLIC_SIGNATURE_UPLOAD_CATEGORIES.has(payload.category)) throw Object.assign(new Error("Forbidden: public signing uploads are limited to signed documents"), { status: 403 });
  if (!PUBLIC_SIGNATURE_UPLOAD_PURPOSES.has(payload.purpose)) throw Object.assign(new Error("Forbidden: upload purpose is not allowed for public signing"), { status: 403 });
  if (!PUBLIC_SIGNATURE_UPLOAD_TYPES.has(payload.fileType)) throw Object.assign(new Error("Forbidden: file type is not allowed for public signing"), { status: 403 });
  if (Number.isFinite(payload.fileSize) && payload.fileSize > MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES) throw Object.assign(new Error("File is too large for public signing upload"), { status: 413 });
  return job;
}

function getPublicSignatureFileName(purpose) {
  if (purpose === "raw_signature_image") return "signature.png";
  if (purpose === "signed_stamped_document") return "signed-output.pdf";
  if (purpose === "signed_approval_document") return "signed-output.html";
  throw Object.assign(new Error("Forbidden: upload purpose is not allowed for public signing"), { status: 403 });
}

async function createPublicSignatureUpload(base44, payload) {
  await requirePublicSignatureUploadAccess(base44, payload);
  const uploadSessionId = crypto.randomUUID();
  const fileName = getPublicSignatureFileName(payload.purpose);
  const fileKey = `jobs/${payload.jobId}/public-signing/${uploadSessionId}/${fileName}`;
  const workerResult = await callWorker("/files/public-signing-upload-url", {
    fileKey, fileType: payload.fileType, maxSize: MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES, expiresIn: 300,
  });
  return { uploadUrl: workerResult.uploadUrl, fileKey, uploadSessionId, expiresIn: workerResult.expiresIn || 300 };
}

function requirePublicSigningUploadKey(payload) {
  if (!payload.uploadSessionId) throw Object.assign(new Error("Missing required field: uploadSessionId"), { status: 400 });
  const expectedFileName = getPublicSignatureFileName(payload.purpose);
  const expectedKey = `jobs/${payload.jobId}/public-signing/${payload.uploadSessionId}/${expectedFileName}`;
  if (payload.fileKey !== expectedKey) throw Object.assign(new Error("Forbidden: upload key does not match this public signing session"), { status: 403 });
}

function inferPublicSignatureFileType(payload) {
  if (payload.purpose === "raw_signature_image") return "image/png";
  if (payload.purpose === "signed_stamped_document") return "application/pdf";
  if (payload.purpose === "signed_approval_document") return "text/html";
  return "";
}

async function deleteUploadedFile(fileKey) {
  try { await callWorker("/files/delete", { fileKey }); } catch (err) { console.error("Failed to delete invalid uploaded file", err); }
}

async function verifyPublicSignatureUploadedObject(base44, payload) {
  await requirePublicSignatureUploadAccess(base44, {
    ...payload,
    fileName: payload.fileKey.split("/").pop() || "uploaded-file",
    fileType: inferPublicSignatureFileType(payload),
    fileSize: 0,
  });
  requirePublicSigningUploadKey(payload);
  const headResult = await callWorker("/files/head", { fileKey: payload.fileKey, jobId: payload.jobId, category: payload.category, purpose: payload.purpose });
  const actualSize = Number(headResult?.size);
  const expectedContentType = inferPublicSignatureFileType(payload);
  const actualContentType = cleanString(headResult?.httpMetadata?.contentType);
  if (!Number.isFinite(actualSize)) { await deleteUploadedFile(payload.fileKey); throw Object.assign(new Error("Uploaded file size could not be verified"), { status: 502 }); }
  if (actualSize > MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES) { await deleteUploadedFile(payload.fileKey); throw Object.assign(new Error("Uploaded file exceeds the public signing size limit"), { status: 413 }); }
  if (actualContentType !== expectedContentType) { await deleteUploadedFile(payload.fileKey); throw Object.assign(new Error("Uploaded file type is not allowed for public signing"), { status: 403 }); }
  return { fileKey: payload.fileKey, size: actualSize, maxSize: MAX_PUBLIC_SIGNATURE_UPLOAD_BYTES };
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
    const body = await readJson(req);

    if (body.action === "verify_public_signature_upload") {
      const payload = normalizeUploadVerificationPayload(body);
      const result = await verifyPublicSignatureUploadedObject(base44, payload);
      return json({ ok: true, fileKey: result.fileKey, r2Key: result.fileKey, size: result.size, maxSize: result.maxSize });
    }

    const payload = normalizeUploadPayload(body);
    let uploadedBy = "Public signer";

    if (payload.publicSigning) {
      const publicUpload = await createPublicSignatureUpload(base44, payload);
      return json({
        uploadUrl: publicUpload.uploadUrl,
        fileKey: publicUpload.fileKey,
        r2Key: publicUpload.fileKey,
        uploadSessionId: publicUpload.uploadSessionId,
        expiresIn: publicUpload.expiresIn,
        metadata: {
          job_id: payload.jobId, file_name: payload.fileName, file_type: payload.fileType,
          category: payload.category, storage_provider: "r2", r2_key: publicUpload.fileKey,
          uploaded_by_name: uploadedBy,
        },
      });
    } else {
      const user = await optionalUser(base44);
      if (!user) return json({ error: "Unauthorized" }, 401);
      const actor = await resolveActor(base44, user);
      await requireJobAccess(base44, actor, payload.jobId);
      requireUploadPermission(actor, payload.category);
      uploadedBy = actor.name;
    }

    const workerResult = await callWorker("/files/upload-url", {
      fileName: payload.fileName, fileType: payload.fileType, jobId: payload.jobId,
      uploadedBy, category: payload.category, purpose: payload.purpose, fileSize: payload.fileSize,
    });

    return json({
      uploadUrl: workerResult.uploadUrl,
      fileKey: workerResult.fileKey,
      r2Key: workerResult.fileKey,
      expiresIn: workerResult.expiresIn || 300,
      metadata: {
        job_id: payload.jobId, file_name: payload.fileName, file_type: payload.fileType,
        file_size: payload.fileSize, category: payload.category, storage_provider: "r2",
        r2_key: workerResult.fileKey, uploaded_by_name: uploadedBy,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});