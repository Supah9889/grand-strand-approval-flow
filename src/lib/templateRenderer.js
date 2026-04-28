const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function buildSignatureTemplateData(job = {}, signatureRecord = {}) {
  return {
    customer_name: job.customer_name,
    job_address: job.address,
    price: job.price,
    approval_statement: signatureRecord.approval_statement,
    signed_date: signatureRecord.signed_date,
    signature_image: signatureRecord.signature_url,
  };
}

function valueToHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplate(template = '', data = {}) {
  return String(template).replace(PLACEHOLDER_PATTERN, (_, key) => valueToHtml(data[key]));
}

export function renderSignatureTemplate(template = '', job = {}, signatureRecord = {}) {
  return renderTemplate(template, buildSignatureTemplateData(job, signatureRecord));
}
