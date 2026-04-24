# Quick Reference: Accessibility, Mutations & Navigation

**For Developers:** Quick patterns and usage guides

---

## 1. Adding aria-labels (Accessibility)

### Form Input Pattern
```jsx
<label htmlFor="fieldId">Label Text</label>
<Input 
  id="fieldId"
  aria-label="Descriptive label for screen readers"
  placeholder="..."
  value={value}
  onChange={handler}
/>
```

### Button Pattern
```jsx
<button 
  aria-label="Clear action description"
  onClick={handler}
>
  Icon / Text
</button>

// Toggle button
<button 
  aria-label="Toggle permission name"
  aria-pressed={isActive}
  onClick={handler}
/>
```

### Search Input Pattern
```jsx
<Input 
  aria-label="Search leads by name, email, or address"
  placeholder="Search..."
  value={search}
  onChange={handler}
/>
```

### List Item Pattern
```jsx
<button 
  aria-label="View lead: John Doe at 123 Main St"
  onClick={() => navigate(`/path/${id}`)}
>
  Item content
</button>
```

---

## 2. Using useOptimisticMutation (Performance)

### Import
```jsx
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';
```

### Basic Usage
```jsx
const mutation = useOptimisticMutation({
  mutationFn: (data) => base44.entities.Lead.update(data.id, data),
  queryKey: ['leads'],
  optimisticUpdate: (prevLeads, { id, status }) =>
    prevLeads.map(l => l.id === id ? { ...l, status } : l),
  rollback: (prevLeads) => prevLeads,
  onSuccess: () => toast.success('Updated'),
  onError: () => toast.error('Failed'),
});

// Call it
mutation.mutate({ id: '123', status: 'qualified' });

// Check loading state
{mutation.isPending && <Loader />}
```

### Common Patterns

**Status Change:**
```jsx
optimisticUpdate: (prev, { id, status }) =>
  prev.map(item => item.id === id ? { ...item, status } : item)
```

**Add Item:**
```jsx
optimisticUpdate: (prev, newItem) => [
  { ...newItem, id: `temp-${Date.now()}` },
  ...prev,
]
```

**Delete Item:**
```jsx
optimisticUpdate: (prev, { id }) =>
  prev.filter(item => item.id !== id)
```

**Toggle Property:**
```jsx
optimisticUpdate: (prev, { id, field }) =>
  prev.map(item =>
    item.id === id 
      ? { ...item, [field]: !item[field] } 
      : item
  )
```

---

## 3. Android Back Button Navigation

### How It Works

The back button respects your navigation stack:

```
Open App → Page A
  ├─ Navigate to Page B
  │  ├─ Back button → Page A ✅
  ├─ Navigate to Page C
  │  ├─ Back button → Page B ✅
  │  ├─ Back button → Page A ✅
  │  ├─ Back button → Minimize app ✅
```

### In NavigationContext

```jsx
// Push a new route onto the stack
pushRoute('dashboard', '/job-hub?jobId=123');

// Pop back to previous route
popRoute('dashboard');  // Returns true if successful

// Get current stack
getTabStack('dashboard');  // Returns array of routes

// Clear stack (on logout)
clearTabStack('dashboard');  // Resets to ['/']
```

### In Your Component

```jsx
import { useNavigation } from '@/lib/NavigationContext';

export default function MyPage() {
  const { pushRoute, popRoute } = useNavigation();
  
  const goToDetail = (id) => {
    pushRoute('dashboard', `/job-hub?jobId=${id}`);
  };
  
  const goBack = () => {
    popRoute('dashboard');
  };
  
  return (
    <>
      <button onClick={goBack}>← Back</button>
      <button onClick={() => goToDetail('123')}>Details</button>
    </>
  );
}
```

### Graceful Fallbacks

- **Android with Cordova:** Uses navigator.app.exitApp() or navigator.device.exitApp()
- **Web browser:** Safely navigates to /dashboard, doesn't crash
- **iOS:** Same as Android (Cordova integration)

---

## 4. Accessibility Testing

### Quick Checklist

- [ ] All buttons have `aria-label`
- [ ] All form inputs have `aria-label` + `id` + `htmlFor` on label
- [ ] Toggle buttons have `aria-pressed={isActive}`
- [ ] Search inputs describe what they search
- [ ] List items describe the content (name, location, etc.)
- [ ] Close buttons labeled "Close [form name]"
- [ ] No keyboard traps (Tab should move through page logically)

### Testing Commands

```bash
# Lighthouse audit
lighthouse https://your-app.com --only-categories=accessibility

# Browser DevTools
# → F12 → Lighthouse tab → Accessibility
# Target score: 90+
```

### Screen Reader Testing

1. **Windows:** NVDA (free)
2. **Mac:** VoiceOver (built-in, Cmd+F5)
3. **iOS:** VoiceOver (Settings → Accessibility)
4. **Android:** TalkBack (Settings → Accessibility)

---

## 5. Navigation Tab Routes

Each bottom tab maintains its own history stack:

```jsx
const tabRouteMap = {
  'dashboard': /^\/(dashboard|job-hub|admin-overview)/,
  'time': /^\/(time-clock|time-entries)/,
  'finance': /^\/(invoices|expenses|payments|bills|purchase-orders)/,
  'operations': /^\/(tasks|daily-logs|warranty)/,
  'settings': /^\/(mobile-settings|profile|verification)/,
};
```

When you switch tabs, each returns to where you left off.

---

## 6. Common Mistakes to Avoid

### ❌ Missing aria-label
```jsx
// BAD
<button onClick={handleCreate}>+</button>

// GOOD
<button aria-label="Create new invoice" onClick={handleCreate}>+</button>
```

### ❌ No form label connection
```jsx
// BAD
<label>Email</label>
<Input />

// GOOD
<label htmlFor="email">Email</label>
<Input id="email" />
```

### ❌ Using optimisticMutation for complex operations
```jsx
// BAD - Financial calculations need accuracy
const mutation = useOptimisticMutation({
  mutationFn: (data) => calculateInvoiceTotal(data),
  // ...
});

// GOOD - Use direct useMutation for complex logic
const mutation = useMutation({
  mutationFn: (data) => calculateInvoiceTotal(data),
  onSuccess: () => invalidateQueries(['invoices']),
});
```

### ❌ Not disabling button during mutation
```jsx
// BAD - User can click multiple times
<Button onClick={() => mutation.mutate(data)}>Save</Button>

// GOOD
<Button 
  onClick={() => mutation.mutate(data)}
  disabled={mutation.isPending}
>
  {mutation.isPending ? 'Saving...' : 'Save'}
</Button>
```

---

## 7. Files to Know

| File | Purpose |
|------|---------|
| `hooks/useOptimisticMutation.js` | Optimistic mutation hook |
| `lib/NavigationContext.jsx` | Stack-based navigation + back button |
| `components/BottomSheetSelect.jsx` | Mobile-optimized select |
| `components/PullToRefresh.jsx` | Pull-to-refresh gesture |
| `docs/ACCESSIBILITY_AUDIT.md` | Detailed accessibility guide |
| `docs/MUTATION_OPTIMIZATION_GUIDE.md` | Performance optimization patterns |

---

## 8. When to Use What

### Use useOptimisticMutation for:
- ✅ Status changes (quick feedback)
- ✅ List add/remove (fast visual update)
- ✅ Permission toggles (immediate reflection)
- ✅ Priority changes (low-risk edits)

### Use regular useMutation for:
- ❌ Complex calculations (financial data)
- ❌ Multi-step workflows (dependent operations)
- ❌ Sensitive data (must match server exactly)
- ❌ Background tasks (not user-facing)

### Add aria-label to:
- ✅ All buttons
- ✅ All form inputs
- ✅ Search fields
- ✅ List items
- ✅ Icon-only buttons

### Don't add aria-label to:
- ❌ Text that already has visible label (use htmlFor instead)
- ❌ Decorative icons (use `aria-hidden="true"`)
- ❌ Obvious actions with clear visual labels

---

## 9. Code Examples by Task

### Task: Add New Lead Form
```jsx
import { useOptimisticMutation } from '@/hooks/useOptimisticMutation';

const createLeadMutation = useOptimisticMutation({
  mutationFn: (data) => base44.entities.Lead.create(data),
  queryKey: ['leads'],
  optimisticUpdate: (prev, newLead) => [
    { ...newLead, id: `temp-${Date.now()}` },
    ...prev,
  ],
  onSuccess: () => {
    setShowForm(false);
    toast.success('Lead created');
  },
  onError: () => toast.error('Failed to create lead'),
});

return (
  <form onSubmit={handleSubmit}>
    <label htmlFor="contact_name">Contact Name</label>
    <Input 
      id="contact_name"
      aria-label="Contact name"
      placeholder="John Doe"
      value={name}
      onChange={setName}
    />
    <Button 
      type="submit"
      disabled={createLeadMutation.isPending}
      onClick={() => createLeadMutation.mutate(formData)}
    >
      {createLeadMutation.isPending ? 'Creating...' : 'Create Lead'}
    </Button>
  </form>
);
```

### Task: Add Status Change with Back Button
```jsx
import { useNavigation } from '@/lib/NavigationContext';

const { popRoute } = useNavigation();

const updateStatusMutation = useOptimisticMutation({
  mutationFn: (data) => base44.entities.Lead.update(data.id, data),
  queryKey: ['leads'],
  optimisticUpdate: (prev, { id, status }) =>
    prev.map(l => l.id === id ? { ...l, status } : l),
});

return (
  <>
    <button 
      aria-label="Go back to leads list"
      onClick={() => popRoute('dashboard')}
    >
      ← Back
    </button>
    
    <select 
      aria-label="Lead status"
      value={status}
      onChange={(e) => updateStatusMutation.mutate({
        id: lead.id,
        status: e.target.value,
      })}
    >
      <option>new_lead</option>
      <option>contacted</option>
      <option>qualified</option>
    </select>
  </>
);
```

---

## 10. Support & Questions

- **Accessibility:** See `docs/ACCESSIBILITY_AUDIT.md`
- **Performance:** See `docs/MUTATION_OPTIMIZATION_GUIDE.md`
- **Navigation:** See `lib/NavigationContext.jsx` comments
- **Full Audit:** See `docs/AUDIT_SUMMARY.md`

---

**Last Updated:** 2026-03-25  
**Next Review:** Quarterly or after major changes