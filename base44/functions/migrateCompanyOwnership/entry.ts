import { createClientFromRequest } from "npm:@base44/sdk@0.8.25";

const UNASSIGNED_COMPANY_ID = "GLOBAL_ADMIN_UNASSIGNED";
const LIVE_MIGRATION_CONFIRM = "MIGRATE_COMPANY_OWNERSHIP";
const COMPANY_FIELDS = ["company_id", "origin_company_id", "assigned_company_id", "performing_company_id"];

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value) {
  return clean(value).toLowerCase().replace(/\s+/g, " ");
}

function getRecordCompanyId(record) {
  return COMPANY_FIELDS.map((field) => clean(record?.[field])).find(Boolean) || "";
}

function createJobMap(jobs = []) {
  return new Map(jobs.filter((job) => job?.id).map((job) => [job.id, job]));
}

function createCompanyNameMap(companies = []) {
  const map = new Map();
  companies.forEach((company) => {
    const companyId = company?.id || company?.company_id;
    if (!companyId) return;
    [company.name, company.company_name, company.display_name, company.slug].forEach((name) => {
      const normalized = normalizeName(name);
      if (normalized) map.set(normalized, companyId);
    });
  });
  return map;
}

async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const entities = base44.asServiceRole?.entities || base44.entities;
  const email = clean(user.email || user.email_address || user.username).toLowerCase();
  const employees = email ? await entities.Employee.filter({ email }).catch(() => []) : [];
  const employee = employees?.find((record) => record.active !== false) || null;
  const role = clean(employee?.role || user.role || user.app_role).toLowerCase();
  if (!["owner", "admin"].includes(role)) throw Object.assign(new Error("Forbidden: admin access is required"), { status: 403 });
  return { user, employee, role, email };
}

async function listRecords(entity, order = "-created_date", limit = 1000) {
  if (!entity?.list) return [];
  return entity.list(order, limit).catch(() => []);
}

function linkedRecordCompanyId(record, jobsById) {
  const directCompanyId = getRecordCompanyId(record);
  if (directCompanyId) return directCompanyId;
  const jobId = clean(record?.job_id || record?.linked_job_id);
  return getRecordCompanyId(jobsById.get(jobId));
}

function recordMatchesVendor(vendor, record) {
  const vendorId = clean(vendor?.id);
  const vendorName = normalizeName(vendor?.company_name || vendor?.display_name);
  return (vendorId && clean(record?.vendor_id) === vendorId)
    || (vendorName && normalizeName(record?.vendor_name || record?.company_name) === vendorName);
}

function inferVendorCompanyId(vendor, context) {
  const existingCompanyId = getRecordCompanyId(vendor);
  if (existingCompanyId) return existingCompanyId;
  const related = [
    ...context.bills,
    ...context.purchaseOrders,
    ...context.invoices,
    ...context.expenses,
  ].filter((record) => recordMatchesVendor(vendor, record));

  for (const record of related) {
    const companyId = linkedRecordCompanyId(record, context.jobsById);
    if (companyId) return companyId;
  }
  return UNASSIGNED_COMPANY_ID;
}

function inferLeadCompanyId(lead, context) {
  const existingCompanyId = getRecordCompanyId(lead);
  if (existingCompanyId) return existingCompanyId;
  const linkedJobCompanyId = getRecordCompanyId(context.jobsById.get(clean(lead?.linked_job_id)));
  if (linkedJobCompanyId) return linkedJobCompanyId;
  return context.companyNameMap.get(normalizeName(lead?.company_name)) || UNASSIGNED_COMPANY_ID;
}

function inferEstimateCompanyId(estimate, context) {
  const existingCompanyId = getRecordCompanyId(estimate);
  if (existingCompanyId) return existingCompanyId;
  const linkedJobCompanyId = getRecordCompanyId(context.jobsById.get(clean(estimate?.linked_job_id || estimate?.job_id)));
  if (linkedJobCompanyId) return linkedJobCompanyId;
  const linkedLead = context.leadsById.get(clean(estimate?.linked_lead_id));
  const linkedLeadCompanyId = getRecordCompanyId(linkedLead);
  if (linkedLeadCompanyId) return linkedLeadCompanyId;
  return context.companyNameMap.get(normalizeName(estimate?.company_name)) || UNASSIGNED_COMPANY_ID;
}

async function migrateEntity(entityName, records, inferCompanyId, entityApi, dryRun) {
  const result = {
    entity: entityName,
    migrated: 0,
    skipped: 0,
    unassigned: 0,
    errors: [],
    sampleUnassignedIds: [],
    sampleInferredAssignments: [],
  };
  for (const record of records) {
    if (!record?.id) {
      result.skipped += 1;
      continue;
    }
    if (getRecordCompanyId(record)) {
      result.skipped += 1;
      continue;
    }

    const companyId = inferCompanyId(record);
    if (companyId === UNASSIGNED_COMPANY_ID) {
      result.unassigned += 1;
      if (result.sampleUnassignedIds.length < 10) result.sampleUnassignedIds.push(record.id);
    } else if (result.sampleInferredAssignments.length < 10) {
      result.sampleInferredAssignments.push({ id: record.id, company_id: companyId });
    }
    if (!dryRun) {
      try {
        await entityApi.update(record.id, { company_id: companyId });
      } catch (error) {
        result.errors.push({ id: record.id, error: error?.message || "Update failed" });
        continue;
      }
    }
    result.migrated += 1;
  }
  return result;
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
    const dryRun = body.dryRun !== false;
    if (!dryRun && body.confirm !== LIVE_MIGRATION_CONFIRM) {
      return json({
        error: "Live migration requires explicit confirmation.",
        requiredConfirm: LIVE_MIGRATION_CONFIRM,
        example: { dryRun: false, confirm: LIVE_MIGRATION_CONFIRM },
      }, 400);
    }

    const base44 = createClientFromRequest(req);
    await requireAdmin(base44);
    const entities = base44.asServiceRole?.entities || base44.entities;

    const [
      companies,
      jobs,
      vendors,
      leads,
      estimates,
      bills,
      purchaseOrders,
      invoices,
      expenses,
    ] = await Promise.all([
      listRecords(entities.Company, "name", 1000),
      listRecords(entities.Job, "-created_date", 2000),
      listRecords(entities.Vendor, "company_name", 2000),
      listRecords(entities.Lead, "-created_date", 2000),
      listRecords(entities.Estimate, "-created_date", 2000),
      listRecords(entities.Bill, "-created_date", 2000),
      listRecords(entities.PurchaseOrder, "-created_date", 2000),
      listRecords(entities.Invoice, "-created_date", 2000),
      listRecords(entities.Expense, "-created_date", 2000),
    ]);

    const context = {
      companyNameMap: createCompanyNameMap(companies),
      jobsById: createJobMap(jobs),
      leadsById: new Map(leads.filter((lead) => lead?.id).map((lead) => [lead.id, lead])),
      bills,
      purchaseOrders,
      invoices,
      expenses,
    };

    const results = [
      await migrateEntity("Vendor", vendors, (record) => inferVendorCompanyId(record, context), entities.Vendor, dryRun),
      await migrateEntity("Lead", leads, (record) => inferLeadCompanyId(record, context), entities.Lead, dryRun),
      await migrateEntity("Estimate", estimates, (record) => inferEstimateCompanyId(record, context), entities.Estimate, dryRun),
    ];

    return json({
      ok: true,
      dryRun,
      fallbackCompanyId: UNASSIGNED_COMPANY_ID,
      results,
      manualReviewInstructions: [
        "Run dryRun first and review each entity's sampleUnassignedIds before any live migration.",
        `Records assigned to ${UNASSIGNED_COMPANY_ID} require manual company ownership review after migration.`,
        `A live run requires { "dryRun": false, "confirm": "${LIVE_MIGRATION_CONFIRM}" }.`,
      ],
      totals: results.reduce((sum, result) => ({
        migrated: sum.migrated + result.migrated,
        skipped: sum.skipped + result.skipped,
        unassigned: sum.unassigned + result.unassigned,
        errors: sum.errors + result.errors.length,
      }), { migrated: 0, skipped: 0, unassigned: 0, errors: 0 }),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
