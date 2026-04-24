import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fmt } from '@/lib/financialHelpers';

function Row({ label, value, bold, positive, negative, indent }) {
  return (
    <div className={`flex items-center justify-between py-1 ${indent ? 'pl-4' : ''} ${bold ? 'border-t border-border mt-1 pt-2' : ''}`}>
      <span className={`text-sm ${bold ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-sm font-${bold ? 'black' : 'medium'} ${positive ? 'text-green-600' : negative ? 'text-red-600' : 'text-foreground'}`}>
        ${fmt(value)}
      </span>
    </div>
  );
}

export default function FinancialSummaryCard({ financials, budget }) {
  const {
    estimatedRevenue, approvedCORevenue, totalExpectedRevenue,
    laborCost, laborHours,
    materialsCost, subcontractorCost, feesCost, equipmentCost, otherExpenseCost,
    totalJobCost,
    invoicesSent, paymentsReceived, remainingBalance,
    grossProfit, grossMarginPct,
  } = financials;

  const isHealthy = grossMarginPct >= 20;
  const isWarning = grossMarginPct >= 5 && grossMarginPct < 20;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Summary</p>
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${isHealthy ? 'bg-green-100 text-green-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
          {isHealthy ? <TrendingUp className="w-3 h-3" /> : isWarning ? <Minus className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {grossMarginPct.toFixed(1)}% margin
        </div>
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Revenue</p>
      <Row label="Estimated Revenue" value={estimatedRevenue} />
      {approvedCORevenue !== 0 && <Row label="Approved Change Orders" value={approvedCORevenue} positive={approvedCORevenue > 0} negative={approvedCORevenue < 0} indent />}
      <Row label="Total Expected Revenue" value={totalExpectedRevenue} bold />

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3">Job Costs</p>
      <Row label={`Labor (${(laborHours || 0).toFixed(1)} hrs)`} value={laborCost} indent />
      {materialsCost > 0 && <Row label="Materials" value={materialsCost} indent />}
      {subcontractorCost > 0 && <Row label="Subcontractor / Bills" value={subcontractorCost} indent />}
      {feesCost > 0 && <Row label="Permits & Fees" value={feesCost} indent />}
      {equipmentCost > 0 && <Row label="Equipment" value={equipmentCost} indent />}
      {otherExpenseCost > 0 && <Row label="Other" value={otherExpenseCost} indent />}
      <Row label="Total Job Cost" value={totalJobCost} bold />

      {budget && (
        <div className="pt-2 pb-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Budget vs Actual</p>
          <Row label="Cost Budget" value={budget.total_cost_budget || 0} />
          <Row label="Actual Cost" value={totalJobCost} negative={totalJobCost > Number(budget.total_cost_budget || 0)} />
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">Variance</span>
            <span className={`text-sm font-medium ${(Number(budget.total_cost_budget || 0) - totalJobCost) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(Number(budget.total_cost_budget || 0) - totalJobCost) >= 0 ? '+' : ''}${fmt(Number(budget.total_cost_budget || 0) - totalJobCost)}
            </span>
          </div>
        </div>
      )}

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3">Billing & Payments</p>
      <Row label="Invoiced" value={invoicesSent} />
      <Row label="Received" value={paymentsReceived} positive />
      <Row label="Remaining Balance" value={remainingBalance} negative={remainingBalance > 0} bold />

      <div className="pt-3 border-t border-border mt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Gross Profit</span>
          <span className={`text-lg font-black ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {grossProfit >= 0 ? '+' : ''}${fmt(grossProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}