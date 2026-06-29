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

function parseJsonList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function extractToken(body) {
  return clean(body.token || body.access_token || body.accessToken || body.invite_token || body.inviteToken);
}

async function findPortalUser(entities, token) {
  const filters = [{ access_token: token }, { token }, { invite_token: token }];
  for (const filter of filters) {
    const records = await entities.PortalUser.filter(filter).catch(() => []);
    const record = records?.find((item) => item?.access_token === token || item?.token === token || item?.invite_token === token);
    if (record) return record;
  }
  return null;
}

function getAllowedJobIds(portalUser) {
  return [...new Set([
    clean(portalUser?.job_id),
    ...parseJsonList(portalUser?.linked_job_ids).map(clean),
  ].filter(Boolean))];
}

function getCompanyIds(job) {
  return [job?.company_id, job?.origin_company_id, job?.assigned_company_id, job?.performing_company_id].filter(Boolean);
}

function safePortalUser(record) {
  return {
    id: record.id || "",
    name: record.name || "",
    email: record.email || "",
    portal_type: record.portal_type || "",
    access_status: record.access_status || "",
    job_id: record.job_id || "",
    job_address: record.job_address || "",
    linked_vendor_id: record.linked_vendor_id || "",
    section_permissions: record.section_permissions || "",
  };
}

function safeJob(job) {
  return {
    id: job.id,
    company_id: job.company_id || "",
    origin_company_id: job.origin_company_id || "",
    assigned_company_id: job.assigned_company_id || "",
    performing_company_id: job.performing_company_id || "",
    address: job.address || "",
    title: job.title || "",
    customer_name: job.customer_name || "",
    description: job.description || "",
    lifecycle_status: job.lifecycle_status || "",
    status: job.status || "",
    start_date: job.start_date || "",
    end_date: job.end_date || "",
  };
}

function requireActivePortalUser(portalUser) {
  if (!portalUser) throw Object.assign(new Error("Forbidden: invalid portal token"), { status: 403 });
  if (portalUser.active === false || portalUser.access_status !== "active") {
    throw Object.assign(new Error("Forbidden: portal access is not active"), { status: 403 });
  }
  if (!["vendor", "subcontractor"].includes(portalUser.portal_type)) {
    throw Object.assign(new Error("Forbidden: invalid portal token"), { status: 403 });
  }
  const expiresAt = portalUser.expires_at || portalUser.expiresAt || portalUser.expiration_date || portalUser.access_expires_at;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw Object.assign(new Error("Forbidden: portal token expired"), { status: 403 });
  }
}

async function resolveJobs(entities, allowedJobIds) {
  const batches = await Promise.all(
    allowedJobIds.map((jobId) => entities.Job.filter({ id: jobId }).catch(() => [])),
  );
  const byId = new Map();
  batches.flat().forEach((job) => {
    if (allowedJobIds.includes(job?.id)) byId.set(job.id, safeJob(job));
  });
  return allowedJobIds.map((jobId) => byId.get(jobId)).filter(Boolean);
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
    const token = extractToken(await readJson(req));
    if (!token) return json({ error: "Unauthorized: portal token is required" }, 401);

    const base44 = createClientFromRequest(req);
    const entities = base44.asServiceRole?.entities || base44.entities;
    const portalUser = await findPortalUser(entities, token);
    requireActivePortalUser(portalUser);

    const allowedJobIds = getAllowedJobIds(portalUser);
    if (!allowedJobIds.length) throw Object.assign(new Error("Forbidden: portal has no linked jobs"), { status: 403 });

    const jobs = await resolveJobs(entities, allowedJobIds);
    if (!jobs.length) throw Object.assign(new Error("Forbidden: portal jobs are unavailable"), { status: 403 });

    const companyIds = [...new Set(jobs.flatMap(getCompanyIds))];
    if (!companyIds.length) throw Object.assign(new Error("Forbidden: portal company context unavailable"), { status: 403 });

    return json({
      portalUser: safePortalUser(portalUser),
      allowedJobIds: jobs.map((job) => job.id),
      companyIds,
      jobs,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
