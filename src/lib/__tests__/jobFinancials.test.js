/**
 * Phase 2 — Job Financial Rollup Tests
 *
 * Tests the unified calcJobFinancials function for:
 *  - Real labor inclusion (hours + cost)
 *  - Cost bucket consistency (materials, subcontractor, fees, equipment, other)
 *  - Revenue / profit / margin accuracy
 *  - Edge cases (no data, archived expenses, no hourly rate)
 */

import { calcJobFinancials, getExpenseBucket } from '../financialHelpers';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTimeEntry(overrides = {}) {
  return {
    duration_minutes: 120,   // 2 hours
    total_hours: 2,
    hourly_rate: 50,
    labor_cost: 0,
    ...overrides,
  };
}

function makeExpense(overrides = {}) {
  return {
    total_amount: 100,
    category: 'materials',
    cost_code: null,
    inbox_status: 'confirmed',
    ...overrides,
  };
}

function makeBill(overrides = {}) {
  return {
    amount: 500,
    status: 'open',
    ...overrides,
  };
}

function makeInvoice(overrides = {}) {
  return {
    amount: 1000,
    status: 'sent',
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    amount: 400,
    ...overrides,
  };
}

// ─── getExpenseBucket ────────────────────────────────────────────────────────

describe('getExpenseBucket', () => {
  test('cost_code takes priority over category', () => {
    const exp = makeExpense({ category: 'other', cost_code: 'Paint Expenses' });
    expect(getExpenseBucket(exp)).toBe('materials');
  });

  test('Labor/Sub cost codes map to subcontractor', () => {
    expect(getExpenseBucket({ cost_code: 'Painting Labor/Sub' })).toBe('subcontractor');
    expect(getExpenseBucket({ cost_code: 'Carpentry Labor/Sub' })).toBe('subcontractor');
    expect(getExpenseBucket({ cost_code: 'Drywall Labor/Sub' })).toBe('subcontractor');
    expect(getExpenseBucket({ cost_code: 'Other Labor/Sub' })).toBe('subcontractor');
  });

  test('expense category: materials → materials', () => {
    expect(getExpenseBucket(makeExpense({ category: 'materials' }))).toBe('materials');
  });

  test('expense category: tools_equipment → equipment', () => {
    expect(getExpenseBucket(makeExpense({ category: 'tools_equipment' }))).toBe('equipment');
  });

  test('expense category: permit_fees → fees', () => {
    expect(getExpenseBucket(makeExpense({ category: 'permit_fees' }))).toBe('fees');
  });

  test('expense category: subcontractor → subcontractor', () => {
    expect(getExpenseBucket(makeExpense({ category: 'subcontractor' }))).toBe('subcontractor');
  });

  test('unknown category falls back to other', () => {
    expect(getExpenseBucket({ category: 'meals' })).toBe('other');
    expect(getExpenseBucket({ category: 'office_supplies' })).toBe('other');
    expect(getExpenseBucket({})).toBe('other');
  });
});

// ─── Labor inclusion ──────────────────────────────────────────────────────────

describe('calcJobFinancials — labor inclusion', () => {
  test('labor hours computed from total_hours field', () => {
    const result = calcJobFinancials({
      timeEntries: [makeTimeEntry({ total_hours: 3, hourly_rate: 0 })],
    });
    expect(result.laborHours).toBeCloseTo(3);
  });

  test('labor hours fall back to duration_minutes / 60 when total_hours is 0', () => {
    const result = calcJobFinancials({
      timeEntries: [makeTimeEntry({ total_hours: 0, duration_minutes: 90 })],
    });
    expect(result.laborHours).toBeCloseTo(1.5);
  });

  test('labor cost uses labor_cost field when present', () => {
    const result = calcJobFinancials({
      timeEntries: [makeTimeEntry({ labor_cost: 200, hourly_rate: 0 })],
    });
    expect(result.laborCost).toBeCloseTo(200);
  });

  test('labor cost computed from hourly_rate * hours when no labor_cost', () => {
    const result = calcJobFinancials({
      timeEntries: [makeTimeEntry({ total_hours: 4, hourly_rate: 50, labor_cost: 0 })],
    });
    expect(result.laborCost).toBeCloseTo(200);
  });

  test('labor cost is 0 when no rate and no labor_cost', () => {
    const result = calcJobFinancials({
      timeEntries: [makeTimeEntry({ total_hours: 5, hourly_rate: 0, labor_cost: 0 })],
    });
    expect(result.laborCost).toBe(0);
    expect(result.laborHours).toBeCloseTo(5);  // hours still tracked
  });

  test('multiple time entries sum correctly', () => {
    const result = calcJobFinancials({
      timeEntries: [
        makeTimeEntry({ total_hours: 2, hourly_rate: 50, labor_cost: 0 }),
        makeTimeEntry({ total_hours: 3, labor_cost: 180 }),
      ],
    });
    expect(result.laborHours).toBeCloseTo(5);
    expect(result.laborCost).toBeCloseTo(100 + 180);
  });
});

// ─── Cost buckets ─────────────────────────────────────────────────────────────

describe('calcJobFinancials — cost buckets', () => {
  test('materials expense goes into materialsCost', () => {
    const result = calcJobFinancials({
      expenses: [makeExpense({ category: 'materials', total_amount: 300 })],
    });
    expect(result.materialsCost).toBeCloseTo(300);
    expect(result.subcontractorCost).toBe(0);
  });

  test('subcontractor expense goes into subcontractorCost', () => {
    const result = calcJobFinancials({
      expenses: [makeExpense({ category: 'subcontractor', total_amount: 500 })],
    });
    expect(result.subcontractorCost).toBeCloseTo(500);
    expect(result.materialsCost).toBe(0);
  });

  test('permit_fees expense goes into feesCost', () => {
    const result = calcJobFinancials({
      expenses: [makeExpense({ category: 'permit_fees', total_amount: 75 })],
    });
    expect(result.feesCost).toBeCloseTo(75);
  });

  test('tools_equipment expense goes into equipmentCost', () => {
    const result = calcJobFinancials({
      expenses: [makeExpense({ category: 'tools_equipment', total_amount: 200 })],
    });
    expect(result.equipmentCost).toBeCloseTo(200);
  });

  test('archived expenses are excluded from costs', () => {
    const result = calcJobFinancials({
      expenses: [
        makeExpense({ category: 'materials', total_amount: 300, inbox_status: 'confirmed' }),
        makeExpense({ category: 'materials', total_amount: 999, inbox_status: 'archived' }),
      ],
    });
    expect(result.materialsCost).toBeCloseTo(300);
    expect(result.totalExpenses).toBeCloseTo(300);
  });

  test('bills fold into subcontractorCost', () => {
    const result = calcJobFinancials({
      bills: [makeBill({ amount: 800, status: 'open' })],
    });
    expect(result.subcontractorCost).toBeCloseTo(800);
    expect(result.billTotal).toBeCloseTo(800);
  });

  test('closed bills are excluded', () => {
    const result = calcJobFinancials({
      bills: [makeBill({ amount: 500, status: 'closed' })],
    });
    expect(result.billTotal).toBe(0);
    expect(result.subcontractorCost).toBe(0);
  });

  test('cost code Paint Expenses overrides category to materials', () => {
    const result = calcJobFinancials({
      expenses: [makeExpense({ category: 'other', cost_code: 'Paint Expenses', total_amount: 250 })],
    });
    expect(result.materialsCost).toBeCloseTo(250);
    expect(result.otherExpenseCost).toBe(0);
  });
});

// ─── Revenue / profit / margin ───────────────────────────────────────────────

describe('calcJobFinancials — revenue, profit, margin', () => {
  test('uses job.price as estimated revenue when no budget', () => {
    const result = calcJobFinancials({ job: { price: 5000 } });
    expect(result.estimatedRevenue).toBe(5000);
    expect(result.totalExpectedRevenue).toBe(5000);
  });

  test('budget.estimated_revenue takes priority over job.price', () => {
    const result = calcJobFinancials({
      job: { price: 5000 },
      budget: { estimated_revenue: 7000 },
    });
    expect(result.estimatedRevenue).toBe(7000);
  });

  test('approved change orders add to total expected revenue', () => {
    const result = calcJobFinancials({
      budget: { estimated_revenue: 10000 },
      changeOrders: [
        { status: 'approved', total_financial_impact: 1500 },
        { status: 'draft',    total_financial_impact: 500 },
      ],
    });
    expect(result.approvedCORevenue).toBe(1500);
    expect(result.totalExpectedRevenue).toBe(11500);
  });

  test('gross profit = totalExpectedRevenue - totalJobCost', () => {
    const result = calcJobFinancials({
      budget: { estimated_revenue: 10000 },
      timeEntries: [makeTimeEntry({ total_hours: 10, hourly_rate: 100, labor_cost: 0 })],
      expenses: [makeExpense({ total_amount: 1000, category: 'materials' })],
    });
    expect(result.totalJobCost).toBeCloseTo(1000 + 1000);
    expect(result.grossProfit).toBeCloseTo(10000 - 2000);
    expect(result.grossMarginPct).toBeCloseTo(80);
  });

  test('margin is 0% when no revenue', () => {
    const result = calcJobFinancials({
      expenses: [makeExpense({ total_amount: 200 })],
    });
    expect(result.grossMarginPct).toBe(0);
  });

  test('negative margin when costs exceed revenue', () => {
    const result = calcJobFinancials({
      budget: { estimated_revenue: 1000 },
      expenses: [makeExpense({ total_amount: 2000, category: 'materials' })],
    });
    expect(result.grossProfit).toBeCloseTo(-1000);
    expect(result.grossMarginPct).toBeCloseTo(-100);
  });
});

// ─── Billing & payments ───────────────────────────────────────────────────────

describe('calcJobFinancials — billing and payments', () => {
  test('invoices in draft/closed status are excluded from invoicesSent', () => {
    const result = calcJobFinancials({
      invoices: [
        makeInvoice({ amount: 1000, status: 'sent' }),
        makeInvoice({ amount: 500, status: 'draft' }),
        makeInvoice({ amount: 200, status: 'closed' }),
      ],
    });
    expect(result.invoicesSent).toBeCloseTo(1000);
  });

  test('paymentsReceived sums all payments', () => {
    const result = calcJobFinancials({
      payments: [makePayment({ amount: 300 }), makePayment({ amount: 200 })],
    });
    expect(result.paymentsReceived).toBeCloseTo(500);
  });

  test('remainingBalance is never negative', () => {
    const result = calcJobFinancials({
      invoices: [makeInvoice({ amount: 100, status: 'paid' })],
      payments: [makePayment({ amount: 200 })],
    });
    expect(result.remainingBalance).toBe(0);
  });
});

// ─── Empty / edge cases ───────────────────────────────────────────────────────

describe('calcJobFinancials — edge cases', () => {
  test('returns zeroed structure when called with no data', () => {
    const result = calcJobFinancials({});
    expect(result.totalJobCost).toBe(0);
    expect(result.totalExpectedRevenue).toBe(0);
    expect(result.grossProfit).toBe(0);
    expect(result.grossMarginPct).toBe(0);
    expect(result.laborHours).toBe(0);
  });

  test('legacy aliases materialCost and otherCost still work', () => {
    const result = calcJobFinancials({
      expenses: [
        makeExpense({ category: 'materials', total_amount: 200 }),
        makeExpense({ category: 'meals',     total_amount: 50 }),
      ],
    });
    expect(result.materialCost).toBeCloseTo(200);   // legacy alias
    expect(result.otherCost).toBeCloseTo(50);        // legacy alias
  });
});