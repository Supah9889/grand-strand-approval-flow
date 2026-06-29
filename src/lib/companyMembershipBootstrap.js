export const BOOTSTRAP_COMPANY_MEMBERSHIPS_CONFIRM = 'BOOTSTRAP_COMPANY_MEMBERSHIPS';

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isBootstrapAdminEmployee(employee) {
  return employee?.active !== false && ['owner', 'admin'].includes(clean(employee?.role).toLowerCase());
}

export function mapAdminEmployeeMembershipRole(employeeRole) {
  return clean(employeeRole).toLowerCase() === 'owner' ? 'owner' : 'operations_admin';
}

export function mapAdminEmployeePermissionGroup(employeeRole) {
  return clean(employeeRole).toLowerCase() === 'owner' ? 'owner' : 'full_admin';
}

export function buildAdminCompanyMembershipPayload(employee, company) {
  return {
    company_id: company.id,
    company_slug: company.slug || company.company_slug || '',
    company_name: company.name || company.company_name || '',
    employee_id: employee.id,
    employee_name: employee.name || '',
    role: mapAdminEmployeeMembershipRole(employee.role),
    permission_group: mapAdminEmployeePermissionGroup(employee.role),
    is_active: true,
    can_view_financials: true,
    can_edit_financials: true,
    can_approve_nexus: true,
    can_review_subcontract_notes: true,
    can_manage_users: true,
    can_view_assigned_only: false,
    notes: 'Created by bootstrapCompanyMemberships recovery.',
  };
}

export function planCompanyMembershipBootstrap({
  companies = [],
  employees = [],
  memberships = [],
} = {}) {
  const activeCompanies = companies.filter(company => company?.id && company.is_active !== false);
  const activeEmployees = employees.filter(employee => employee?.id && employee.active !== false);
  const adminEmployees = activeEmployees.filter(isBootstrapAdminEmployee);
  const manualReviewRequired = activeEmployees
    .filter(employee => !isBootstrapAdminEmployee(employee))
    .map(employee => ({
      id: employee.id,
      name: employee.name || '',
      email: employee.email || '',
      role: employee.role || '',
      reason: 'Company access cannot be safely inferred for non-admin employee.',
    }));

  const existingKeys = new Set(
    memberships
      .filter(membership => membership?.employee_id && membership?.company_id)
      .map(membership => `${membership.employee_id}:${membership.company_id}`)
  );

  const existingAdminMemberships = [];
  const adminMembershipsToCreate = [];

  adminEmployees.forEach(employee => {
    activeCompanies.forEach(company => {
      const key = `${employee.id}:${company.id}`;
      if (existingKeys.has(key)) {
        existingAdminMemberships.push({ employee_id: employee.id, company_id: company.id });
        return;
      }
      adminMembershipsToCreate.push(buildAdminCompanyMembershipPayload(employee, company));
    });
  });

  return {
    totalCompanies: activeCompanies.length,
    totalEmployees: activeEmployees.length,
    totalExistingMemberships: memberships.length,
    adminOwnerEmployees: adminEmployees.length,
    adminOwnerMembershipsToCreate: adminMembershipsToCreate.length,
    skippedExistingMemberships: existingAdminMemberships.length,
    manualReviewRequired,
    sampleRecords: {
      adminOwnerMembershipsToCreate: adminMembershipsToCreate.slice(0, 10),
      manualReviewRequired: manualReviewRequired.slice(0, 10),
    },
    adminMembershipsToCreate,
    existingAdminMemberships,
  };
}

export async function runCompanyMembershipBootstrap({
  companies = [],
  employees = [],
  memberships = [],
  dryRun = true,
  confirm = '',
  createMembership,
} = {}) {
  const plan = planCompanyMembershipBootstrap({ companies, employees, memberships });

  if (dryRun !== false) {
    return {
      ok: true,
      dryRun: true,
      ...plan,
      createdCount: 0,
      skippedCount: plan.skippedExistingMemberships,
    };
  }

  if (confirm !== BOOTSTRAP_COMPANY_MEMBERSHIPS_CONFIRM) {
    throw new Error('Live bootstrap requires BOOTSTRAP_COMPANY_MEMBERSHIPS confirmation.');
  }
  if (typeof createMembership !== 'function') {
    throw new Error('createMembership callback is required for live bootstrap.');
  }

  const created = [];
  for (const membership of plan.adminMembershipsToCreate) {
    created.push(await createMembership(membership));
  }

  return {
    ok: true,
    dryRun: false,
    ...plan,
    created,
    createdCount: created.length,
    skippedCount: plan.skippedExistingMemberships,
  };
}
