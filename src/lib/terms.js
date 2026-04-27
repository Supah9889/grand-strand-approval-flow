// Single source of truth for Terms of Service versioning.
// Bump TERMS_VERSION whenever the terms text changes.
export const TERMS_VERSION = 'v1.2';

export const TERMS_TEXT = `By signing this approval, you ("Customer") agree to the following terms with Grand Strand Custom Painting ("Company"):

1. Scope of Work: The Company will perform the painting services described in the job details above. Any changes to the scope must be agreed upon in writing by both parties.

2. Payment: The total price listed is due upon completion of the work unless otherwise agreed. Payment terms are net 30 days from invoice date.

3. Warranty: The Company warrants workmanship for a period of two (2) years from the date of completion. This warranty does not cover damage caused by neglect, abuse, or acts of nature.

4. Liability: The Company carries general liability insurance. The Company is not responsible for pre-existing conditions not disclosed prior to the start of work.

5. Cancellation: Either party may cancel with 48 hours written notice. Cancellation after work has begun may be subject to charges for work completed.

6. Customer Responsibilities: The Customer agrees to provide reasonable access to the work area and to remove or protect personal property in the work area.

7. Electronic Signature: By providing your electronic signature, you acknowledge that it carries the same legal weight as a handwritten signature.`;

export function buildApprovalStatement(customerName, address, price) {
  const signer = customerName || 'the customer';
  const jobAddress = address || 'the listed job address';
  const amount = Number(price);
  const priceText = Number.isFinite(amount)
    ? `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'the listed contract price';

  return `I, ${signer}, hereby approve the painting work at ${jobAddress} for a total price of ${priceText}. I have read and agree to the Terms of Service (${TERMS_VERSION}) as presented to me at the time of signing.`;
}
