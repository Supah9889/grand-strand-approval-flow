/**
 * FormExample - Demonstrates migration from standard Select to BottomSheetSelect
 * 
 * BEFORE (standard select):
 * import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
 * <Select value={status} onValueChange={setStatus}>
 *   <SelectTrigger><SelectValue /></SelectTrigger>
 *   <SelectContent>
 *     <SelectItem value="active">Active</SelectItem>
 *     <SelectItem value="inactive">Inactive</SelectItem>
 *   </SelectContent>
 * </Select>
 * 
 * AFTER (BottomSheetSelect):
 * import BottomSheetSelect from '@/components/BottomSheetSelect';
 * <BottomSheetSelect
 *   value={status}
 *   onChange={setStatus}
 *   label="Select Status"
 *   options={[
 *     { label: 'Active', value: 'active' },
 *     { label: 'Inactive', value: 'inactive' }
 *   ]}
 * />
 * 
 * MIGRATION GUIDE:
 * 1. Replace Select component with BottomSheetSelect
 * 2. Convert options to array format: { label, value }
 * 3. Remove SelectTrigger, SelectValue, SelectContent, SelectItem
 * 4. Use onChange callback instead of onValueChange
 * 5. Simplify styling - BottomSheetSelect handles mobile optimization
 */

export const MIGRATION_EXAMPLES = {
  // Example 1: Status select
  status: {
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
      { label: 'Pending', value: 'pending' },
    ],
  },

  // Example 2: Job type select
  jobType: {
    options: [
      { label: 'Interior Painting', value: 'interior_painting' },
      { label: 'Exterior Painting', value: 'exterior_painting' },
      { label: 'Drywall Repair', value: 'drywall_repair' },
      { label: 'Cabinet Painting', value: 'cabinet_painting' },
    ],
  },

  // Example 3: Priority select
  priority: {
    options: [
      { label: 'Low', value: 'low' },
      { label: 'Normal', value: 'normal' },
      { label: 'High', value: 'high' },
      { label: 'Urgent', value: 'urgent' },
    ],
  },
};