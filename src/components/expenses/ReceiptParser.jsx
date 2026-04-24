/**
 * ReceiptParser — calls LLM to extract structured receipt data from a file URL.
 * Returns a normalized receipt object with line items and totals.
 */
import { base44 } from '@/api/base44Client';

export const UNIT_OPTIONS = [
  'EACH', 'PINT', 'QUART', 'GALLON', 'CASE', 'BOX', 'BAG',
  'ROLL', 'TUBE', 'PACK', 'SET', 'HOUR', 'DAY', 'FEET',
  'INCH', 'POUND', 'OUNCE', '--', 'OTHER',
];

export function makeBlankItem() {
  return {
    _id: Math.random().toString(36).slice(2),
    title: '',
    unit_cost: '',
    quantity: '1',
    unit: 'EACH',
    cost_code: '',
    line_total: '',
    sku: '',
    original_price: '',
    discount_amount: '',
  };
}

/**
 * Calculate match status between computed total and receipt total.
 * Returns: 'matched' | 'needs_review' | 'mismatch'
 */
export function calcMatchStatus(lineItems, receiptTotal, taxAmount, discountTotal) {
  const itemSum = lineItems.reduce((s, item) => {
    const qty = parseFloat(item.quantity) || 1;
    const cost = parseFloat(item.unit_cost) || 0;
    return s + qty * cost;
  }, 0);

  const computed = itemSum + (parseFloat(taxAmount) || 0) - (parseFloat(discountTotal) || 0);
  const receipt = parseFloat(receiptTotal) || 0;

  if (receipt === 0) return 'needs_review';
  const diff = Math.abs(computed - receipt);
  if (diff <= 0.02) return 'matched';
  if (diff <= receipt * 0.05) return 'needs_review'; // within 5%
  return 'mismatch';
}

export async function parseReceiptFile(fileUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a receipt parsing expert. Extract ALL structured information from this receipt document.

For the receipt header, extract:
- vendor_name (store/company name)
- store_location (city, state, or address if shown)
- receipt_date (ISO format YYYY-MM-DD if possible)
- receipt_number (transaction/receipt/order number)
- subtotal (pre-tax total, number only)
- discount_total (total discounts/savings shown, number only, positive value)
- tax_amount (tax charged, number only)
- final_total (the total amount paid, number only)
- payment_method (cash/card/check etc if visible)
- notes (any relevant memo or notes)
- currency (USD if not stated)
- parse_confidence (high/medium/low — your confidence in overall extraction quality)

For EACH line item on the receipt, extract:
- title (product/item name — be descriptive)
- quantity (number)
- unit_cost (unit price AFTER any item-level discount, number only)
- unit (EACH/GALLON/PINT/QUART/CASE/BOX/BAG/ROLL/TUBE/PACK/SET/HOUR/DAY/FEET/INCH/POUND/OUNCE/-- — pick best match or "--" if unclear)
- line_total (final price for this line after discounts, number only)
- original_price (original unit price before any discount, if visible, number only)
- discount_amount (discount on this line if visible, positive number)
- sku (product code/SKU/UPC if visible)

IMPORTANT: Prefer post-discount prices. If an item shows a markdown, use the final price.
If the receipt shows a store-level or total discount (not per-item), set discount_total at the header level.
Return a JSON object with keys: vendor_name, store_location, receipt_date, receipt_number, subtotal, discount_total, tax_amount, final_total, payment_method, notes, currency, parse_confidence, line_items (array).
If a field cannot be determined, use null.`,
    file_urls: [fileUrl],
    response_json_schema: {
      type: 'object',
      properties: {
        vendor_name: { type: 'string' },
        store_location: { type: 'string' },
        receipt_date: { type: 'string' },
        receipt_number: { type: 'string' },
        subtotal: { type: 'number' },
        discount_total: { type: 'number' },
        tax_amount: { type: 'number' },
        final_total: { type: 'number' },
        payment_method: { type: 'string' },
        notes: { type: 'string' },
        currency: { type: 'string' },
        parse_confidence: { type: 'string' },
        line_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              quantity: { type: 'number' },
              unit_cost: { type: 'number' },
              unit: { type: 'string' },
              line_total: { type: 'number' },
              original_price: { type: 'number' },
              discount_amount: { type: 'number' },
              sku: { type: 'string' },
            },
          },
        },
      },
    },
  });

  // Normalize line items
  const lineItems = (result.line_items || []).map(item => ({
    _id: Math.random().toString(36).slice(2),
    title: item.title || '',
    quantity: String(item.quantity ?? 1),
    unit_cost: String(item.unit_cost ?? ''),
    unit: UNIT_OPTIONS.includes((item.unit || '').toUpperCase()) ? item.unit.toUpperCase() : (item.unit ? 'OTHER' : 'EACH'),
    line_total: String(item.line_total ?? ''),
    original_price: String(item.original_price ?? ''),
    discount_amount: String(item.discount_amount ?? ''),
    sku: item.sku || '',
    cost_code: '',
  }));

  return {
    vendor_name: result.vendor_name || '',
    store_location: result.store_location || '',
    receipt_date: result.receipt_date || '',
    receipt_number: result.receipt_number || '',
    subtotal: result.subtotal != null ? String(result.subtotal) : '',
    discount_total: result.discount_total != null ? String(result.discount_total) : '',
    tax_amount: result.tax_amount != null ? String(result.tax_amount) : '',
    final_total: result.final_total != null ? String(result.final_total) : '',
    payment_method: result.payment_method || '',
    notes: result.notes || '',
    currency: result.currency || 'USD',
    parse_confidence: result.parse_confidence || 'medium',
    line_items: lineItems.length > 0 ? lineItems : [makeBlankItem()],
  };
}