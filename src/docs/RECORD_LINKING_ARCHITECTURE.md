# Record Linking Architecture

This document describes how the platform implements cross-module record linking to create a unified job-centric system.

## Overview

The platform treats **Jobs as master records** that act as the central hub for all operational data. Related records (invoices, expenses, time entries, assignments, portal users, etc.) maintain structured relationships back to their parent job, enabling automatic updates, accurate summaries, and clean navigation across modules.

## Core Linking Principles

### 1. Jobs as Master Records

Every job is the primary record that:
- Acts as the central hub for connected operational data
- Maintains counts, totals, and status summaries of related items
- Updates automatically when related records change
- Serves as the single point of truth for job-level information

### 2. Structured Relationships

All related records store:
- `job_id` — unique job identifier
- `job_address` — cached job address for display without extra lookups
- Clear, consistent references that enable fast filtering and relationship validation

Supported related record types:
- **Financial**: Invoices, Estimates, Expenses, Change Orders, Bills
- **Operational**: Time Entries, Tasks, Daily Logs, Assignments
- **Access**: Portal Users, Internal User Assignments
- **Documents**: Attachments/Files

### 3. Visibility & Navigation

Related items are visible from:
- **Job Detail Pages**: Organized tabs/sections showing all related records
- **Record Cards**: Clickable links back to the parent job
- **Search Results**: Job context included in search result items
- **Filters**: Jobs as filter criteria across modules

## Implementation Details

### Record Linking Utilities (`lib/recordLinking.js`)

Core utilities for relationship management:

```javascript
// Fetch all related records for a job
const relatedRecords = await fetchJobRelatedRecords(jobId);
// Returns: { invoices, expenses, timeEntries, estimates, assignments, portalUsers, ... }

// Calculate job rollup summaries
const rollups = calculateJobRollups(relatedRecords);
// Returns: invoice counts, totals, time hours, expense totals, etc.

// Validate job link integrity
const isValid = await validateJobLink(record, expectedJobId);

// Normalize a record with job relationship
const normalized = normalizeJobLink(record, jobData);
```

### Related Records Component (`components/jobs/JobRelatedRecords.jsx`)

Displays organized related records on job pages:
- Grouped by category (Financial, Operational, Portal, Documents)
- Click-to-navigate to linked records
- Expandable sections for easy browsing
- Shows up to 10 items per type with overflow indication

### Job Hub Integration

The Job Hub page now shows:
1. **Details Tab**: 
   - Job metadata and description
   - Related records summary with counts and totals
   - Expandable JobRelatedRecords component

2. **Individual Tabs**: 
   - Invoices, Estimates, Expenses, Change Orders, Time Entries, Tasks, etc.
   - Pre-filtered to show only records for this job

3. **Team/Clients Tabs**:
   - Assignments and Portal Users for this specific job

## Relationship Enforcement

### On Create

When creating a record linked to a job:
- Job ID is populated automatically or required in the form
- Relationship is validated before save
- Audit log entry created with job context

Example (Invoices):
```javascript
// Job linking is now required - cannot save without a job_id
if (!data.job_id) {
  toast.error('Job linking is required. Please select a job.');
  return;
}
```

### On Edit

When editing a linked record:
- Original job relationship is preserved
- If job is changed, both old and new jobs are updated appropriately
- Relationship change is logged to audit trail

Example (Invoices):
```javascript
// Detect job change
if (oldJobId !== newJobId) {
  audit_linking.jobChanged(
    inv.id, 
    role, 
    'Invoice', 
    oldJobId, 
    newJobId, 
    oldAddr, 
    newAddr
  );
}
```

### On Archive/Delete

When archiving or deleting a linked record:
- The record is removed from active job summaries
- Archived/deleted counts remain available through filters
- Historical traceability preserved in audit log
- Job counts/totals update cleanly

## Relationship-Based Audit Logging

New audit helpers for relationship tracking:

```javascript
// Link a record to a job
audit_linking.jobLinked(recordId, actor, recordType, jobId, jobAddress);

// Unlink a record from a job
audit_linking.jobUnlinked(recordId, actor, recordType, jobId, jobAddress);

// Change which job a record belongs to
audit_linking.jobChanged(recordId, actor, recordType, oldJobId, newJobId, oldAddr, newAddr);
```

## Rollup Calculations

Jobs maintain automatically-updated rollup information:

```javascript
{
  // Invoice summary
  invoiceCount: 5,              // Active invoices
  invoiceArchivedCount: 2,      // Archived invoices
  invoiceTotal: 25000,          // Total amount
  invoiceBalance: 5000,         // Outstanding balance
  invoiceStatuses: { draft: 1, sent: 2, paid: 2 },

  // Expense summary
  expenseCount: 8,              // Active expenses
  expenseArchivedCount: 1,      // Archived expenses
  expenseTotal: 3500,           // Total amount

  // Time entry summary
  totalHours: 120,              // Total hours logged
  approvedHours: 100,           // Approved hours
  pendingHours: 20,             // Pending approval

  // Related counts
  estimateCount: 3,
  assignmentCount: 5,
  portalUserCount: 2,
  taskCount: 12,
  dailyLogCount: 8,
  fileCount: 15,
}
```

## Navigation Patterns

### From Job to Related Record

```
Job Hub → Click related record → Open record detail page
```

### From Related Record Back to Job

```
Invoice/Expense/Time Entry → Click "View Job" link → Open Job Hub
```

### Cross-Module Discovery

```
Invoice List → Filter by Job → See all invoices for specific job
Expense List → Filter by Job → See all expenses for specific job
Time Entries → Filter by Job → See all time entries for specific job
```

## Data Consistency

### Active vs Archived/Deleted

**Active views** show:
- Records with `status !== 'closed'` (for invoices)
- Records with `approval_status !== 'archived'` (for expenses)
- Undeleted records

**Archived/Deleted records**:
- Hidden from active lists by default
- Retrievable via filter selection
- Still included in audit logs for traceability
- Preserved for historical/accounting reasons

### Query Invalidation

When related records change, the following queries are invalidated:
- Job data (to refresh cached relationships)
- All related record queries (invoices, expenses, time entries, etc.)
- Rollup calculations are recalculated from fresh data

## Performance Considerations

### Batched Fetching

Related records are fetched in parallel:
```javascript
const [invoices, expenses, timeEntries, ...] = await Promise.all([...]);
```

### Lazy Loading

Related records are fetched only when:
- The Job Hub is opened
- The "Details" tab is active
- User has admin permissions

### Caching

React Query caches related record queries with keys:
```javascript
queryKey: ['job-related-records', jobId]
```

## Future Enhancements

### Search Integration
- Search results can filter by job relationship
- Display job context in search results

### Reporting
- Job-based reporting aggregates related records
- Rollup information feeds into financial/operational dashboards

### Mobile Optimization
- Simplified related records view for mobile
- Quick-access to most important related items

### Real-Time Updates
- Consider WebSocket subscriptions for live relationship updates
- Push notifications when related records change significantly

## Implementation Checklist

- [x] Core linking utilities (`lib/recordLinking.js`)
- [x] Related records component (`components/jobs/JobRelatedRecords.jsx`)
- [x] Job Hub integration with rollups and related records display
- [x] Invoice job linking enforcement (required field)
- [x] Audit logging for relationship changes
- [x] Job Hub tabs pre-filtered by job_id
- [ ] Expenses job linking enforcement
- [ ] Time Entries job linking enforcement
- [ ] Estimates job linking enforcement
- [ ] Change Orders job linking enforcement
- [ ] Portal Users job linking enforcement
- [ ] Assignments job linking enforcement
- [ ] Task descriptions and improvements
- [ ] Attachment association with jobs
- [ ] Search/filter by job relationship
- [ ] Financial dashboard rollup feeds

## Testing Record Linking

### Manual Testing

1. **Create Invoice for Job**
   - Navigate to Invoices
   - Create new invoice
   - Verify job field is required
   - Submit, verify audit log entry
   - Open Job Hub for that job
   - Verify invoice appears in Related Records

2. **Edit Invoice Job**
   - Open Invoice in edit mode
   - Change linked job
   - Save and verify:
     - Audit log shows job change
     - Old job's summary updates (removes invoice)
     - New job's summary updates (adds invoice)

3. **Archive Invoice**
   - Archive an invoice
   - Verify job's active invoice count decreases
   - Verify archived count increases
   - Navigate to job, verify invoice appears in "Archived Only" filter

4. **Delete Invoice**
   - Delete an invoice
   - Verify completely removed from job summaries
   - Verify still in audit log for traceability

### Automated Testing

Future test suites should validate:
- Relationship creation/modification/deletion
- Rollup calculation accuracy
- Query invalidation timing
- Navigation between related records
- Audit logging completeness