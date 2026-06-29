# Schema Ownership Matrix

Phase 2 target: every operational record must either carry an explicit `company_id`, inherit ownership from a parent `Job`, be restricted to global admin configuration, or be accessible only through a scoped public token/grant.

Ownership categories:

- A - Explicit company ownership.
- B - Inherits ownership through parent `Job`.
- C - Global admin only / configuration / migration metadata.
- D - Public token or grant based, with backing company/job ownership.

## Matrix

| Entity | Category | Ownership Basis | Phase 2 Recommendation |
| --- | --- | --- | --- |
| AccessConfig | C | Global unlock/config | Keep global admin-only. |
| AirSampleTest | A | `company_id` plus `job_id` | Already safely company scoped. |
| ApprovedEmail | C | Global approved-login list | Keep global admin-only. |
| Attachment | B | Attached record/job context | Needs relationship map before broad use. |
| AuditLog | B | `job_id` where present | Job-scoped acceptable; global events should remain admin-only. |
| Bill | B | `job_id`, `vendor_id` | Job-scoped acceptable; add relationship map for vendor rollups. |
| CalendarEvent | B | `job_id` | Job-scoped acceptable. |
| ChangeOrder | B | `job_id` | Job-scoped acceptable. |
| ChangeOrderActivity | B | Parent `ChangeOrder` | Needs relationship map through `co_id`. |
| Company | C | Tenant registry | Keep global admin-only. |
| CompanyCostCode | A | `company_id` | Already safely company scoped. |
| CompanyMembership | A | `company_id` | Already safely company scoped. |
| CostCode | C | Shared accounting template | Keep global or migrate to `CompanyCostCode`. |
| Customer | A | `company_id` | Already safely company scoped. |
| CustomField | C | Admin config | Keep admin-only until company ownership is required. |
| DailyLog | B | `job_id` | Job-scoped acceptable. |
| DocumentationRequirement | C | Template/config | Keep admin-only or add company ownership later. |
| DocumentTemplate | C | Template/config | Keep admin-only or add company ownership later. |
| DryingLog | A | `company_id` plus `job_id` | Already safely company scoped. |
| EdgeCaseTestRun | C | QA metadata | Keep admin-only. |
| Employee | C | Internal staff registry | Keep admin-only; company access comes from memberships. |
| Estimate | A | `company_id`, optional `linked_job_id` | `company_id` added in Phase 2; run migration. |
| EstimateActivity | B | Parent `Estimate` | Needs relationship map through `estimate_id`. |
| ESXDraftWorkOrder | C | Import staging | Keep admin-only until converted. |
| ESXSampleTest | A | Restoration/job context | Verify `company_id` before broad reporting. |
| Expense | B | `job_id` | Job-scoped acceptable. |
| GeoSettings | C | Global/admin settings | Keep admin-only. |
| ImportBatch | C | Import metadata | Keep admin-only. |
| Invoice | B | `job_id`, `customer_id` | Job-scoped acceptable; customer relationship map recommended. |
| Job | A | `company_id` | Already safely company scoped. |
| JobAssignment | B | `job_id` | Job-scoped acceptable. |
| JobBudget | B | `job_id` | Job-scoped acceptable; financial guard required. |
| JobComment | B | `job_id` | Job-scoped acceptable. |
| JobContact | B | `job_id` | Job-scoped acceptable. |
| JobFile | B | `job_id` and R2 key prefix | Job-scoped acceptable; R2 functions enforce ownership. |
| JobNote | B | `job_id` | Job-scoped acceptable. |
| JobTemplate | C | Template/config | Keep admin-only or add company ownership later. |
| JobType | C | Shared type config | Keep global admin-only. |
| Lead | A | `company_id`, optional `linked_job_id` | `company_id` added in Phase 2; run migration. |
| LeadActivity | B | Parent `Lead` | Needs relationship map through `lead_id`. |
| Legacy*Record / LegacyImport | C | Import/legacy staging | Keep admin-only unless converted. |
| MoistureReading | A | `company_id` plus `job_id` | Already safely company scoped. |
| NexusItem | A | `company_id`, optional job link | Already safely company scoped. |
| Payment | B | `job_id` | Job-scoped acceptable; financial guard required. |
| PortalUser | D | `access_token`, `job_id`/linked jobs | Public token based; needs server-side portal resolver in later phase. |
| Property | A | `company_id`, `customer_id` | Already safely company scoped. |
| ProvenJobsExportChecklist | C | Admin checklist | Keep admin-only. |
| PurchaseOrder | B | `job_id` | Job-scoped acceptable. |
| QBExportBatch | C | Admin export metadata | Keep admin-only; add company id in a later phase if per-company history matters. |
| RestorationEquipment | A | `company_id`, optional `current_job_id` | Already safely company scoped. |
| ReviewDecision | C | Review/admin workflow | Keep admin-only unless tied to company later. |
| ReviewFeedback | C | Review/admin workflow | Keep admin-only unless tied to job/company later. |
| RolePermission | C | Global role defaults | Keep global admin-only. |
| RolloutChecklist | C | Admin rollout checklist | Keep admin-only. |
| Room | B | Restoration parent/job context | Needs relationship map to job/company. |
| ScheduleEvent | A | `company_id`, optional `job_id` | Already safely company scoped. |
| SignatureRecord | D | Signing grant/job context | Public grant based with parent job ownership. |
| StagedCalendarEvent / StagedDailyLog / StagedJob | C | Import staging | Keep admin-only until promoted. |
| SubcontractNote | A/B | `origin_company_id`, `performing_company_id`, `job_id` | Cross-company by design; require explicit origin/performing checks. |
| Task | B | `job_id` | Job-scoped acceptable. |
| TimeEntry | A | `company_id`, optional `job_id` | Already safely company scoped. |
| User | C | Base44 user/app profile | Keep global/admin controlled. |
| Vendor | A | `company_id` | `company_id` added in Phase 2; run migration. |
| VendorComplianceDocument | B | Parent `Vendor` | Needs vendor-to-company relationship map. |
| WarrantyItem | B | `job_id` | Job-scoped acceptable. |
| WorkOrder | A/B | `company_id`, `job_id`, origin/performing fields | Already scoped; cross-company checks required for subcontract work. |
| WorkOrderTemplate | C | Template/config | Keep admin-only or add company ownership later. |
| XactimateImport | C | Import metadata | Keep admin-only. |

## High-Priority Schema Recommendations

| Entity | Recommendation |
| --- | --- |
| Vendor | `company_id` added; backfill from related bills, purchase orders, invoices, and expenses. |
| Lead | `company_id` added; backfill from linked job or company-name mapping. |
| Estimate | `company_id` added; backfill from linked job, linked lead, or company-name mapping. |
| Customer | Already safely company scoped. |
| Subcontractor/SubcontractNote | Cross-company model is valid; keep origin/performing company checks explicit. |
| JobContact | Job-scoped and acceptable. |
| Property | Already safely company scoped. |
| PurchaseOrder | Job-scoped and acceptable; add relationship map for vendor reporting. |
| Bill | Job-scoped and acceptable; add relationship map for vendor reporting. |
| Payment | Job-scoped and acceptable; financial guard required. |
| Invoice | Job-scoped and acceptable; customer relationship map recommended. |
