import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

export const COMPANY_FIELDS = ["company_id", "origin_company_id", "assigned_company_id", "performing_company_id"];
export const JOB_FIELDS = ["job_id", "linked_job_id", "current_job_id"];

export function createContext(req: Request) {
  return createClientFromRequest(req);
}

function fail(message: string, status = 403): never {
  throw Object.assign(new Error(message), { status });
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseJson(value: unknown, fallback: Record<string, unknown> = {}) {
  if (!value || typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function normalizeRole(value: unknown) {
  const role = clean(value).toLowerCase();
  if (["owner", "admin", "staff", "field"].includes(role)) return role === "field" ? "staff" : role;
  return "staff";
}

function isAdminActor(actor: ActorContext) {
  return actor.role === "owner" || actor.role === "admin";
}

function getEntityApi(base44: any) {
  return base44.asServiceRole?.entities || base44.entities;
}

async function loadRolePermissions(entities: any, role: string) {
  if (!role || role === "owner") return {};
  const records = await entities.RolePermission.filter({ role }).catch(() => []);
  return parseJson(records?.[0]?.permissions, {});
}

export type ActorContext = {
  user: any;
  employee: any;
  memberships: any[];
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: Record<string, unknown>;
};

export async function requireAuthenticatedUser(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) fail("Unauthorized", 401);
  return user;
}

export async function getActorContext(base44: any, user = null): Promise<ActorContext> {
  const authenticatedUser = user || await requireAuthenticatedUser(base44);
  const entities = getEntityApi(base44);
  const email = normalizeEmail(authenticatedUser?.email || authenticatedUser?.email_address || authenticatedUser?.username);
  const employees = email ? await entities.Employee.filter({ email }).catch(() => []) : [];
  const employee = employees?.find((record: any) => record.active !== false) || null;
  const memberships = employee?.id
    ? await entities.CompanyMembership.filter({ employee_id: employee.id, is_active: true }).catch(() => [])
    : [];
  const role = normalizeRole(employee?.role || authenticatedUser?.role || authenticatedUser?.app_role);
  const rolePermissions = await loadRolePermissions(entities, role);
  const employeeOverrides = parseJson(employee?.permissions_override || employee?.permission_overrides, {});

  return {
    user: authenticatedUser,
    employee,
    memberships,
    id: employee?.id || authenticatedUser?.id || email,
    name: employee?.name || authenticatedUser?.full_name || authenticatedUser?.name || email || "Unknown user",
    email,
    role,
    permissions: role === "owner" || role === "admin" ? { "*": true } : { ...rolePermissions, ...employeeOverrides },
  };
}

export function requireAdmin(actor: ActorContext) {
  if (!isAdminActor(actor)) fail("Forbidden: admin access is required", 403);
  return actor;
}

export function requireCompanyMembership(actor: ActorContext, companyId: string) {
  const targetCompanyId = clean(companyId);
  if (!targetCompanyId) fail("Missing required field: companyId", 400);
  if (isAdminActor(actor)) return actor;
  if (!hasCompanyMembership(actor, targetCompanyId)) fail("Forbidden: company access is required", 403);
  return actor;
}

export function requireCompanyAccess(actor: ActorContext, companyId: string) {
  return requireCompanyMembership(actor, companyId);
}

function hasCompanyMembership(actor: ActorContext, companyId: string) {
  if (isAdminActor(actor)) return true;
  return actor.memberships.some((membership) =>
    membership?.is_active !== false && membership.company_id === companyId
  );
}

function requireAnyCompanyAccess(actor: ActorContext, companyIds: string[]) {
  if (isAdminActor(actor)) return actor;
  if (companyIds.some((companyId) => hasCompanyMembership(actor, companyId))) return actor;
  fail("Forbidden: company access is required", 403);
}

export function getRecordCompanyIds(record: any) {
  return COMPANY_FIELDS.map((field) => clean(record?.[field])).filter(Boolean);
}

export async function requireJobAccess(base44: any, actor: ActorContext, jobId: string) {
  const entities = getEntityApi(base44);
  const id = clean(jobId);
  if (!id) fail("Missing required field: jobId", 400);
  const jobs = await entities.Job.filter({ id }).catch(() => []);
  const job = jobs?.[0];
  if (!job) fail("Not found", 404);
  const companyIds = getRecordCompanyIds(job);
  if (companyIds.length) requireAnyCompanyAccess(actor, companyIds);
  if (isAdminActor(actor)) return job;

  const assignments = actor.employee?.id
    ? await entities.JobAssignment.filter({ job_id: id, employee_id: actor.employee.id }).catch(() => [])
    : [];
  if (assignments?.length) return job;
  fail("Forbidden: job access is not assigned to this user", 403);
}

export async function requireRecordOwnership(base44: any, actor: ActorContext, entityName: string, record: any) {
  if (!record) fail("Not found", 404);
  const directCompanyIds = getRecordCompanyIds(record);
  if (directCompanyIds.length) {
    requireAnyCompanyAccess(actor, directCompanyIds);
    return record;
  }

  const jobId = JOB_FIELDS.map((field) => clean(record?.[field])).find(Boolean);
  if (jobId) {
    await requireJobAccess(base44, actor, jobId);
    return record;
  }

  if (isAdminActor(actor)) return record;
  fail(`Forbidden: ${entityName} ownership could not be verified`, 403);
}

export async function requirePortalTokenAccess(base44: any, token: string, options: { portalType?: string } = {}) {
  const cleanToken = clean(token);
  if (!cleanToken) fail("Unauthorized: portal token is required", 401);
  const entities = getEntityApi(base44);
  const filters: Record<string, string> = { token: cleanToken };
  if (options.portalType) filters.portal_type = options.portalType;
  const grants = await entities.PortalUser.filter(filters).catch(() => []);
  const grant = grants?.find((record: any) => record.active !== false);
  if (!grant) fail("Forbidden: invalid portal token", 403);
  if (grant.expires_at && new Date(grant.expires_at).getTime() < Date.now()) {
    fail("Forbidden: portal token expired", 403);
  }
  if (grant.job_id) {
    const jobs = await entities.Job.filter({ id: grant.job_id }).catch(() => []);
    if (!jobs?.[0]) fail("Forbidden: portal job is not available", 403);
  }
  return grant;
}
