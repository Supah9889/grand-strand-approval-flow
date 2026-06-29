import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const CONFIRM = "BOOTSTRAP_COMPANY_MEMBERSHIPS";

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function normalizeEmployeeRole(value: unknown) {
  const role = clean(value).toLowerCase();
  if (["owner", "admin", "manager", "office", "field", "staff"].includes(role)) return role;
  return "field";
}

function isAdminEmployee(employee: Record<string, unknown>) {
  const role = normalizeEmployeeRole(employee?.role);
  return employee?.active !== false && (role === "owner" || role === "admin");
}

function membershipRole(employeeRole: unknown) {
  return normalizeEmployeeRole(employeeRole) === "owner" ? "owner" : "operations_admin";
}

function permissionGroup(employeeRole: unknown) {
  return normalizeEmployeeRole(employeeRole) === "owner" ? "owner" : "full_admin";
}

function getEntities(base44: any) {
  return base44.asServiceRole?.entities || base44.entities;
}

async function requireAdmin(base44: any) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const entities = getEntities(base44);
  const email = normalizeEmail(user.email || user.email_address || user.username);
  const employees = email ? await entities.Employee.filter({ email }).catch(() => []) : [];
  const employee = employees.find((record: Record<string, unknown>) => record.active !== false) || null;
  const role = normalizeEmployeeRole(employee?.role || user.role || user.app_role);
  if (role !== "owner" && role !== "admin") {
    throw Object.assign(new Error("Forbidden: admin access is required"), { status: 403 });
  }
  return { email, role };
}

function buildPayload(employee: Record<string, unknown>, company: Record<string, unknown>) {
  return {
    company_id: company.id,
    company_slug: company.slug || company.company_slug || "",
    company_name: company.name || company.company_name || "",
    employee_id: employee.id,
    employee_name: employee.name || "",
    // CompanyMembership uses operational enum values. Admin employees map to
    // operations_admin/full_admin; owner employees map to owner/owner.
    role: membershipRole(employee.role),
    permission_group: permissionGroup(employee.role),
    is_active: true,
    can_view_financials: true,
    can_edit_financials: true,
    can_approve_nexus: true,
    can_review_subcontract_notes: true,
    can_manage_users: true,
    can_view_assigned_only: false,
    notes: "Created by bootstrapCompanyMemberships recovery.",
  };
}

function analyze(companies: Record<string, unknown>[], employees: Record<string, unknown>[], memberships: Record<string, unknown>[]) {
  const activeCompanies = companies.filter((company) => company?.id && company.is_active !== false);
  const activeEmployees = employees.filter((employee) => employee?.id && employee.active !== false);
  const adminEmployees = activeEmployees.filter(isAdminEmployee);
  const manualReviewRequired = activeEmployees
    .filter((employee) => !isAdminEmployee(employee))
    .map((employee) => ({
      id: employee.id,
      name: employee.name || "",
      email: employee.email || "",
      role: employee.role || "",
      reason: "Company access cannot be safely inferred for non-admin employee.",
    }));
  const existingKeys = new Set(
    memberships
      .filter((membership) => membership?.employee_id && membership?.company_id)
      .map((membership) => `${membership.employee_id}:${membership.company_id}`)
  );
  const adminMembershipsToCreate: Record<string, unknown>[] = [];
  let skippedExistingMemberships = 0;

  for (const employee of adminEmployees) {
    for (const company of activeCompanies) {
      const key = `${employee.id}:${company.id}`;
      if (existingKeys.has(key)) {
        skippedExistingMemberships += 1;
        continue;
      }
      adminMembershipsToCreate.push(buildPayload(employee, company));
    }
  }

  return {
    totalCompanies: activeCompanies.length,
    totalEmployees: activeEmployees.length,
    totalExistingMemberships: memberships.length,
    adminOwnerEmployees: adminEmployees.length,
    adminOwnerMembershipsToCreate: adminMembershipsToCreate.length,
    skippedExistingMemberships,
    manualReviewRequired,
    sampleRecords: {
      adminOwnerMembershipsToCreate: adminMembershipsToCreate.slice(0, 10),
      manualReviewRequired: manualReviewRequired.slice(0, 10),
    },
    adminMembershipsToCreate,
  };
}

function safeError(error: any) {
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? "Internal server error" : error.message;
  if (status >= 500) console.error(error);
  return json({ error: message }, status);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson(req);
    const dryRun = body.dryRun !== false;
    if (!dryRun && body.confirm !== CONFIRM) {
      return json({ error: "Live bootstrap requires BOOTSTRAP_COMPANY_MEMBERSHIPS confirmation." }, 400);
    }

    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const entities = getEntities(base44);

    const [companies, employees, memberships] = await Promise.all([
      entities.Company.list("name", 1000).catch(() => []),
      entities.Employee.list("name", 1000).catch(() => []),
      entities.CompanyMembership.list("created_date", 5000).catch(() => []),
    ]);

    const plan = analyze(companies, employees, memberships);

    if (dryRun) {
      return json({
        ok: true,
        dryRun: true,
        ...plan,
        createdCount: 0,
        skippedCount: plan.skippedExistingMemberships,
        manualReviewInstructions: "Run live bootstrap for admin/owner memberships, then assign non-admin employees to specific companies manually.",
      });
    }

    const created: Record<string, unknown>[] = [];
    for (const membership of plan.adminMembershipsToCreate) {
      created.push(await entities.CompanyMembership.create(membership));
    }

    return json({
      ok: true,
      dryRun: false,
      ...plan,
      created,
      createdCount: created.length,
      skippedCount: plan.skippedExistingMemberships,
      manualReviewInstructions: "Review manualReviewRequired before enabling non-admin employee access.",
    });
  } catch (error) {
    return safeError(error);
  }
});
