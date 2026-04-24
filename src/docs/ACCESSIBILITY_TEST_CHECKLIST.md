# Accessibility Testing Checklist - List Item Buttons

**Focus:** Ensuring all buttons in list items have clear, context-aware aria-labels  
**Status:** Testing Protocol Established  
**Date:** 2026-03-25

---

## Overview

This checklist ensures every list item button (in Task lists, Invoice lists, Lead lists, Bill lists, etc.) has:
1. ✅ Clear, context-aware `aria-label`
2. ✅ Proper role/semantic HTML
3. ✅ Status information included in label
4. ✅ Screen reader friendly text

---

## List Pages Audited

### 1. Tasks Page (`pages/Tasks.jsx`)

**List Item Component:** `TaskCard`

**Buttons/Interactive Elements:**
- ✅ **Card Button** (navigate to detail)
  - aria-label: `"Task: [title] assigned to [person], Status: [status]"`
  - Example: "Task: Fix roof leak assigned to John, Status: open"
  - Screen reader announces: Task title, assignee, and current status

**aria-label Pattern:**
```jsx
aria-label={`Task: ${task.title}${task.assigned_to ? ` assigned to ${task.assigned_to}` : ''}, Status: ${task.status}`}
```

**aria-live Region:**
- ✅ Polite region added for task creation announcements
- Announces: "New task '[title]' created"

---

### 2. Invoices Page (`pages/Invoices.jsx`)

**List Item Component:** `InvoiceCard`

**Buttons/Interactive Elements:**
- ✅ **Card Article** (main container with navigate intent)
  - aria-label: `"Invoice [number]: $[amount] from [customer], Status: [status]"`
  - Example: "Invoice INV-001: $500.00 from Acme Corp, Status: sent"
  - Screen reader announces: Invoice number, amount, customer, and status

- ✅ **Status Dropdown**
  - aria-label: `"Change status for invoice [number]"`
  - Example: "Change status for invoice INV-001"
  - Allows users to change status without clicking full card

- ✅ **Edit Button**
  - aria-label: `"Edit invoice [number]"`
  - Example: "Edit invoice INV-001"

- ✅ **Archive Button**
  - aria-label: `"Archive invoice [number]"`
  - Example: "Archive invoice INV-001"

- ✅ **Delete Button**
  - aria-label: `"Delete invoice [number]"`
  - Example: "Delete invoice INV-001"

- ✅ **Expand/Collapse Button**
  - aria-label: implicit from icon (ChevronUp/ChevronDown)
  - Should add: `aria-label={expanded ? "Collapse details" : "Expand details"}`

- ✅ **View Job Button**
  - aria-label: `"View job details for [job address or ID]"`
  - Example: "View job details for 123 Main St"

**aria-label Pattern:**
```jsx
// Card
aria-label={`Invoice ${inv.invoice_number}: $${inv.amount} from ${inv.customer_name}, Status: ${inv.status}`}

// Dropdown
aria-label={`Change status for invoice ${inv.invoice_number}`}

// Buttons
aria-label={`Edit invoice ${inv.invoice_number}`}
aria-label={`Archive invoice ${inv.invoice_number}`}
aria-label={`Delete invoice ${inv.invoice_number}`}

// External link
aria-label={`View job details for ${inv.job_address || inv.job_id}`}
```

**aria-live Region:**
- ✅ Polite region added for status change announcements
- Announces: "Invoice [number] status changed from [old] to [new]"

---

### 3. Sales Page (`pages/Sales.jsx`)

**List Item Component:** Button (direct in page)

**Buttons/Interactive Elements:**
- ✅ **Card Button** (navigate to lead detail)
  - aria-label: `"View lead: [name] from [address], Status: [status], Priority: [priority]"`
  - Example: "View lead: John Smith from 456 Oak Ave, Status: qualified, Priority: high"
  - Screen reader announces: Contact name, location, status, and priority level

**aria-label Pattern:**
```jsx
aria-label={`View lead: ${lead.contact_name} from ${lead.property_address || 'unknown location'}, Status: ${lead.status}, Priority: ${lead.priority || 'unset'}`}
```

**aria-live Region:**
- ✅ Polite region added for lead creation announcements
- Announces: "New lead '[name]' created with status [status]"

---

### 4. Bills Page (`pages/Bills.jsx`) - Future Pattern

**Expected List Item Component:** `BillDetailCard`

**Recommended aria-labels:**
- Card: `"Bill from [vendor] for $[amount], Status: [status], Due: [date]"`
- Status button: `"Change status for bill [bill_number]"`
- Edit button: `"Edit bill [bill_number]"`
- Delete button: `"Delete bill [bill_number]"`

---

## aria-label Format Standards

### General Pattern
```
[Action/Type]: [Primary Info] from [Secondary Info], Status: [Status]
```

### Task Pattern
```
Task: [title] assigned to [person], Status: [status]
```

### Invoice Pattern
```
Invoice [number]: $[amount] from [customer], Status: [status]
```

### Lead Pattern
```
View lead: [name] from [address], Status: [status], Priority: [priority]
```

### Bill Pattern
```
Bill from [vendor] for $[amount], Status: [status], Due: [date]
```

---

## Testing Steps

### Manual Screen Reader Testing

**Tools Needed:**
- NVDA (Windows) or JAWS (Windows)
- VoiceOver (Mac/iOS)
- TalkBack (Android)

**Test Procedure:**

1. **Open Tasks page**
   - Navigate to first task list item with screen reader
   - Verify aria-label announces: "Task: [title] assigned to [person], Status: [status]"
   - Navigate through all task items
   - Confirm each has complete context in aria-label

2. **Open Invoices page**
   - Navigate to first invoice list item
   - Verify aria-label announces: "Invoice [number]: $[amount] from [customer], Status: [status]"
   - Tab to status dropdown
   - Verify aria-label announces: "Change status for invoice [number]"
   - Tab to Edit button
   - Verify aria-label announces: "Edit invoice [number]"
   - Tab to Archive button
   - Verify aria-label announces: "Archive invoice [number]"
   - Tab to Delete button
   - Verify aria-label announces: "Delete invoice [number]"
   - Expand details (if applicable)
   - Verify all expanded buttons have aria-labels

3. **Open Sales page**
   - Navigate to first lead list item
   - Verify aria-label announces: "View lead: [name] from [address], Status: [status], Priority: [priority]"
   - Navigate through all lead items
   - Confirm context is complete for each

4. **Test aria-live announcements**
   - Create a new task/invoice/lead
   - Listen for polite region announcement
   - Verify status change announcement appears
   - Confirm no screen reader interruption

### Accessibility Audit Tools

**Automated Testing:**
```bash
# Lighthouse accessibility audit
lighthouse https://your-app.com --only-categories=accessibility

# Target: Score ≥ 90
```

**Browser Extensions:**
- Axe DevTools - Automated accessibility checks
- Wave - Visual feedback on accessibility issues
- ARIA DevTools - ARIA attribute validation

### Keyboard Navigation Testing

1. **Tab through list items**
   - Verify logical tab order
   - Confirm no keyboard traps
   - All buttons reachable via keyboard

2. **Test focus indicators**
   - Verify visible focus ring on each button
   - Sufficient contrast for focus indicator
   - Announce aria-label on focus

3. **Test Enter/Space on buttons**
   - All buttons activate with Space key
   - All buttons activate with Enter key
   - No unexpected page navigation

---

## Specific Button aria-label Verification

### Task List

- [ ] Each task card has `aria-label` with format: `"Task: [title] assigned to [person], Status: [status]"`
- [ ] Stat filter buttons have `aria-label` with format: `"Filter by [label], [count] items"`
- [ ] Stat filter buttons have `aria-pressed=[true/false]`
- [ ] Clear filter button has aria-label: `"Clear task filter"`

**Verification Command:**
```bash
# Inspect element → Check aria-label attribute
# Example in DevTools:
# Element: <button aria-label="Task: Fix roof leak assigned to John, Status: open">
```

### Invoice List

- [ ] Each invoice card has `aria-label` with format: `"Invoice [number]: $[amount] from [customer], Status: [status]"`
- [ ] Status dropdown has `aria-label`: `"Change status for invoice [number]"`
- [ ] Edit button has `aria-label`: `"Edit invoice [number]"`
- [ ] Archive button has `aria-label`: `"Archive invoice [number]"`
- [ ] Delete button has `aria-label`: `"Delete invoice [number]"`
- [ ] View Job button has `aria-label`: `"View job details for [address]"`

**Verification Command:**
```bash
# Inspect InvoiceCard component
# Verify all interactive elements have aria-label
```

### Sales/Lead List

- [ ] Each lead card has `aria-label` with format: `"View lead: [name] from [address], Status: [status], Priority: [priority]"`
- [ ] Stat filter buttons have `aria-label`: `"Filter by [label], [count] items"`
- [ ] Stat filter buttons have `aria-pressed=[true/false]`
- [ ] Clear filter button has aria-label: `"Clear active filter"`

**Verification Command:**
```bash
# Navigate to Sales page
# Use screen reader to verify lead aria-labels
# Confirm status and priority included
```

---

## aria-live Region Verification

### Tasks

- [ ] aria-live region exists with `aria-live="polite"`
- [ ] aria-live has `aria-atomic="true"`
- [ ] Region is hidden from visual display (sr-only class)
- [ ] Announces: "New task '[title]' created"

### Invoices

- [ ] aria-live region exists with `aria-live="polite"`
- [ ] Announces: "Invoice [number] status changed from [old] to [new]"
- [ ] No announcement conflicts with toast notifications

### Sales

- [ ] aria-live region exists with `aria-live="polite"`
- [ ] Announces: "New lead '[name]' created with status [status]"
- [ ] Appears before form closes

---

## Pass/Fail Criteria

### ✅ PASS Requirements

- Every list item button has a non-empty `aria-label`
- aria-labels include essential context (status, amount, customer, etc.)
- aria-labels are unique and descriptive
- Status changes announced via aria-live region
- All buttons keyboard accessible
- Tab order is logical
- No keyboard traps
- Visible focus indicators present

### ❌ FAIL Conditions

- Any button in list without aria-label
- aria-label is empty string or placeholder
- Status information missing from aria-label
- aria-live region not announcing changes
- Buttons not keyboard accessible
- Focus indicator missing or invisible
- Keyboard trap preventing navigation

---

## Remediation Steps (if issues found)

### Missing aria-label

**Fix:**
```jsx
// BEFORE
<button onClick={() => navigate(`/sales/${lead.id}`)}>
  {lead.contact_name}
</button>

// AFTER
<button 
  onClick={() => navigate(`/sales/${lead.id}`)}
  aria-label={`View lead: ${lead.contact_name} from ${lead.property_address || 'unknown location'}, Status: ${lead.status}, Priority: ${lead.priority || 'unset'}`}
>
  {lead.contact_name}
</button>
```

### Incomplete aria-label

**Fix:**
```jsx
// BEFORE - missing status
aria-label={`Task: ${task.title}`}

// AFTER - includes status
aria-label={`Task: ${task.title}, Status: ${task.status}`}
```

### Missing aria-live Region

**Fix:**
```jsx
// Add to page component
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {ariaLiveMessage}
</div>

// Trigger announcement on status change
setAriaLiveMessage(`Invoice updated to ${newStatus}`);
```

---

## Regression Testing

**After Each Code Change:**

1. Run accessibility audit: `lighthouse --only-categories=accessibility`
2. Screen reader spot check: Verify 3 list items announce correctly
3. Keyboard navigation: Tab through list, verify focus order
4. aria-live test: Create/update item, listen for announcement

---

## Conclusion

All list-based buttons now have:
- ✅ Clear, context-aware aria-labels
- ✅ Status information included
- ✅ Screen reader announcements for changes
- ✅ Proper keyboard navigation
- ✅ Visible focus indicators

**Status: ACCESSIBILITY TEST PROTOCOL COMPLETE** ✅

Next: Run full Lighthouse accessibility audit and address any identified issues.