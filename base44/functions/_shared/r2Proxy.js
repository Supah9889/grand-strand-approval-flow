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

export async function resolveActor(base44, user) {
  const entities = base44.asServiceRole?.entities || base44.entities;
  const email = normalizeEmail(user?.email || user?.email_address || user?.username);
  const employees = email
    ? await entities.Employee.filter({ email }).catch(() => [])
    : [];
  const employee = employees?.find((record) => record.active !== false) || null;

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

  const entities = base44.asServiceRole?.entities || base44.entities;
  const jobs = await entities.Job.filter({ id: jobId }).catch(() => []);
  const job = jobs?.[0];
  if (!job) {
    throw Object.assign(new Error("Job not found"), { status: 404 });
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
  const fileName = cleanString(body.fileName || body.file_name);
  const fileType = cleanString(body.fileType || body.file_type || "application/octet-stream");
  const category = cleanString(body.category || "other");
  const purpose = cleanString(body.purpose || body.action || "upload");
  const fileSize = Number(body.fileSize || body.file_size || 0);

  if (!fileName) {
    throw Object.assign(new Error("Missing required field: fileName"), { status: 400 });
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

  if (!fileKey) {
    throw Object.assign(new Error("Missing required field: fileKey or r2Key"), { status: 400 });
  }

  return {
    jobId,
    fileKey,
    category,
    purpose,
    metadata,
  };
}

export function requireScopedFileKey(jobId, fileKey) {
  const expectedPrefix = `jobs/${jobId}/`;
  if (!fileKey.startsWith(expectedPrefix)) {
    throw Object.assign(new Error("Forbidden: file key is not scoped to the requested job"), {
      status: 403,
    });
  }
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
