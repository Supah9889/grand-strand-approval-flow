# Mutation Performance Optimization Guide

**Date:** 2026-03-25  
**Focus:** useOptimisticMutation Implementation

---

## Overview

The `useOptimisticMutation` hook provides optimistic UI updates, making your app feel faster by updating the UI immediately before the server confirms the change. This guide documents where and how to implement it.

---

## The useOptimisticMutation Hook

### Location
`hooks/useOptimisticMutation.js`

### API

```jsx
const mutation = useOptimisticMutation({
  mutationFn: async (variables) => { /* API call */ },
  queryKey: ['entityName'],
  optimisticUpdate: (previousData, variables) => { /* Updated cache */ },
  rollback: (previousData) => { /* Rollback data */ },
  onSuccess: () => { /* Callback */ },
  onError: () => { /* Error callback */ },
});

// Usage
mutation.mutate({ ...data });
```

### How It Works

```
1. optimisticUpdate runs immediately
   ↓ (Updates React Query cache instantly)
   ↓ (UI re-renders with new data)
2. mutationFn executes (API call)
   ├─ SUCCESS → invalidateQueries (refetch from server)
   └─ ERROR   → rollback (restore previous data)
```

---

## Implementation Checklist

### ✅ Current Status

**Already Using optimisticMutation:**
- TimeEntry status updates
- Expense approval changes
- Some task status transitions

**Using Direct useMutation (Could Optimize):**
- Lead creation
- Invoice/Bill creation
- Invoice/Bill status changes
- Payment recording
- Task CRUD operations
- Permission toggles
- Employee status changes

---

## When to Use Optimistic Mutations

### ✅ **USE optimistic mutations for:**

1. **Status/State Transitions** (Immediate feedback beneficial)
   - Lead status changes: new_lead → contacted → qualified
   - Task status: open → in_progress → completed
   - Permission toggles: enabled ↔ disabled
   - Invoice status: draft → sent → approved

2. **List Mutations** (Add/remove from cache efficiently)
   - Creating new leads, tasks, bills
   - Deleting records from a list
   - Updating list item properties

3. **Quick User Actions** (Perceived performance matters)
   - Clicking a checkbox/toggle
   - Changing a dropdown value
   - Marking item as important/done

4. **High-Frequency Edits** (Rapid user interaction)
   - Quick form updates
   - Inline editing
   - Batch operations

### ❌ **DON'T use optimistic mutations for:**

1. **Complex Calculations** (Server transformation needed)
   - Financial calculations
   - Report generation
   - Complex data aggregations

2. **Dependent Operations** (Order matters)
   - Linked record creation
   - Multi-step workflows
   - Transactions requiring consistency

3. **Low User Concern** (Speed not critical)
   - Admin background tasks
   - One-time imports
   - Maintenance operations

4. **High-Risk Data** (Must be accurate)
   - Sensitive financial records
   - Compliance/audit data
   - Data requiring immediate consistency

---

## Implementation Examples

### Example 1: Lead Status Change

**Before (Direct useMutation):**
```jsx
const updateLeadMutation = useMutation({
  mutationFn: ({ id, status }) => 
    base44.entities.Lead.update(id, { status }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    toast.success('Lead status updated');
  },
});

// User sees delay before UI updates
```

**After (With Optimistic Update):**
```jsx
const updateLeadMutation = useOptimisticMutation({
  mutationFn: ({ id, status }) => 
    base44.entities.Lead.update(id, { status }),
  queryKey: ['leads'],
  optimisticUpdate: (previousLeads, { id, status }) => 
    previousLeads.map(l => 
      l.id === id ? { ...l, status } : l
    ),
  rollback: (previousLeads) => previousLeads,
  onSuccess: () => toast.success('Lead status updated'),
  onError: () => toast.error('Failed to update'),
});

// UI updates instantly, then syncs with server
```

### Example 2: Task Creation

**Before:**
```jsx
const createTaskMutation = useMutation({
  mutationFn: (data) => base44.entities.Task.create(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    setShowForm(false);
    toast.success('Task created');
  },
});
```

**After:**
```jsx
const createTaskMutation = useOptimisticMutation({
  mutationFn: (data) => base44.entities.Task.create(data),
  queryKey: ['tasks'],
  optimisticUpdate: (previousTasks, taskData) => [
    {
      ...taskData,
      id: `temp-${Date.now()}`,  // Temporary ID
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
    },
    ...previousTasks,
  ],
  rollback: (previousTasks) => previousTasks,
  onSuccess: () => {
    setShowForm(false);
    toast.success('Task created');
  },
  onError: () => toast.error('Failed to create task'),
});
```

### Example 3: Permission Toggle

**Implementation:**
```jsx
const togglePermissionMutation = useOptimisticMutation({
  mutationFn: ({ employee_id, permission, enabled }) =>
    base44.entities.Employee.update(employee_id, {
      permission_overrides: { ...overrides, [permission]: enabled }
    }),
  queryKey: ['employees'],
  optimisticUpdate: (previousEmployees, { employee_id, permission, enabled }) =>
    previousEmployees.map(emp =>
      emp.id === employee_id
        ? {
            ...emp,
            permission_overrides: {
              ...(emp.permission_overrides || {}),
              [permission]: enabled,
            },
          }
        : emp
    ),
  rollback: (previousEmployees) => previousEmployees,
  onSuccess: () => toast.success('Permission updated'),
  onError: () => toast.error('Failed to update permission'),
});

// Usage: Toggle button provides instant feedback
<button 
  onClick={() => togglePermissionMutation.mutate({ 
    employee_id: id, 
    permission: 'can_delete_jobs',
    enabled: !isEnabled 
  })}
>
  Permission Toggle
</button>
```

---

## Migration Pathway

### Phase 1: High-Impact Status Changes
1. Lead status updates
2. Task status updates
3. Invoice/Bill status changes
4. Permission toggles

### Phase 2: List Operations
1. Lead creation
2. Task creation
3. Bill creation
4. Expense creation

### Phase 3: Additional Optimizations
1. Quick form field changes
2. Priority/assignment updates
3. Category/type changes
4. Batch operations

---

## Testing Optimistic Mutations

### Manual Testing Checklist

1. **Network Delay Simulation**
   - Open DevTools → Network tab
   - Set throttling to "Slow 3G"
   - Verify UI updates immediately before response

2. **Failure Scenarios**
   - Simulate offline mode
   - Verify rollback restores original state
   - Confirm error toast displayed

3. **Concurrent Updates**
   - Rapid clicks should queue properly
   - No race conditions in UI
   - All updates eventually consistent

4. **List Consistency**
   - New items appear immediately
   - Deleted items disappear immediately
   - Re-fetched data matches server state

### Code Testing Example

```jsx
// Test that optimisticUpdate works correctly
test('optimistic update appends new task', () => {
  const previousTasks = [{ id: '1', title: 'Task 1' }];
  const newTask = { title: 'Task 2' };
  
  const result = optimisticUpdate(previousTasks, newTask);
  
  expect(result[0].title).toBe('Task 2');
  expect(result[1].id).toBe('1');
});

// Test rollback on error
test('rollback restores previous data', () => {
  const previousTasks = [{ id: '1', title: 'Task 1' }];
  
  const result = rollback(previousTasks);
  
  expect(result).toEqual(previousTasks);
});
```

---

## Common Patterns

### Pattern 1: Simple Status Toggle
```jsx
optimisticUpdate: (prevData, { id, status }) =>
  prevData.map(item =>
    item.id === id ? { ...item, status } : item
  )
```

### Pattern 2: Prepend New Item
```jsx
optimisticUpdate: (prevData, newItem) => [
  { ...newItem, id: `temp-${Date.now()}` },
  ...prevData,
]
```

### Pattern 3: Remove Item
```jsx
optimisticUpdate: (prevData, { id }) =>
  prevData.filter(item => item.id !== id)
```

### Pattern 4: Update Single Property
```jsx
optimisticUpdate: (prevData, { id, field, value }) =>
  prevData.map(item =>
    item.id === id ? { ...item, [field]: value } : item
  )
```

---

## Performance Impact

### Before Optimization
- Status change → API call (500ms-1s) → UI update
- User sees delay, feels laggy

### After Optimization
- Status change → UI update (instant) → API call (background)
- User sees immediate feedback
- Feels 10-100x faster depending on network

### Metrics
- **Perceived Performance:** 500ms → 0ms (instant)
- **App Responsiveness:** Significantly improved
- **User Satisfaction:** Noticeably better feel

---

## Troubleshooting

### Issue: Data Out of Sync
**Cause:** optimisticUpdate doesn't match server response  
**Solution:** Ensure optimisticUpdate logic matches server transformation

### Issue: Rollback Doesn't Work
**Cause:** rollback function not properly implemented  
**Solution:** Return exact copy of previous data: `rollback: (prev) => prev`

### Issue: Temporary IDs Visible
**Cause:** New items show "temp-123" IDs briefly  
**Solution:** Hide temporary IDs in UI or use UUID library for real-looking IDs

### Issue: Mutations Queue Up
**Cause:** Multiple mutations fired rapidly  
**Solution:** Disable button during mutation with `mutation.isPending`

---

## Best Practices

1. **Always Provide rollback** - Ensure data consistency on errors
2. **Use Temporary IDs Wisely** - Don't expose internal mechanics to users
3. **Clear Success/Error Messages** - Always toast feedback
4. **Disable During Mutation** - Prevent duplicate submissions
5. **Test Error Scenarios** - Verify rollback behavior
6. **Keep optimisticUpdate Simple** - Avoid complex transformations
7. **Invalidate on Success** - Ensure server truth wins

---

## Conclusion

Using `useOptimisticMutation` for appropriate operations significantly improves perceived performance and user satisfaction. Prioritize implementation for:

1. **Status changes** (high visibility)
2. **List mutations** (frequent user action)
3. **Quick toggles** (low risk, high frequency)

Keep direct `useMutation` for complex or risky operations where accuracy is paramount.