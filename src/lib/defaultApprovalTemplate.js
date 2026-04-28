import { renderSignatureTemplate } from '@/lib/templateRenderer';

export const DEFAULT_APPROVAL_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Customer Approval / Work Authorization</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        color: #1f2937;
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
        line-height: 1.5;
      }
      main {
        max-width: 760px;
        margin: 0 auto;
      }
      header {
        border-bottom: 2px solid #e5e7eb;
        margin-bottom: 28px;
        padding-bottom: 18px;
      }
      h1 {
        margin: 0;
        color: #111827;
        font-size: 24px;
      }
      .app-name {
        color: #4b5563;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .section {
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 22px;
        padding-bottom: 22px;
      }
      .label {
        color: #6b7280;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin: 0 0 4px;
        text-transform: uppercase;
      }
      .value {
        margin: 0 0 14px;
        font-size: 15px;
      }
      .statement {
        background: #f9fafb;
        border-left: 4px solid #9ca3af;
        padding: 14px 16px;
      }
      .signature {
        border: 1px solid #d1d5db;
        border-radius: 4px;
        margin-top: 8px;
        max-height: 120px;
        max-width: 320px;
        padding: 8px;
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="app-name">Grand Strand Approval Flow</p>
        <h1>Customer Approval / Work Authorization</h1>
      </header>

      <section class="section">
        <p class="label">Customer Name</p>
        <p class="value">{{customer_name}}</p>

        <p class="label">Job Address</p>
        <p class="value">{{job_address}}</p>

        <p class="label">Price</p>
        <p class="value">{{price}}</p>
      </section>

      <section class="section">
        <p class="label">Approval Statement</p>
        <p class="value statement">{{approval_statement}}</p>

        <p class="label">Terms Version</p>
        <p class="value">{{terms_version}}</p>
      </section>

      <section>
        <p class="label">Signed Date</p>
        <p class="value">{{signed_date}}</p>

        <p class="label">Signature</p>
        <img class="signature" src="{{signature_image}}" alt="Customer signature" />
      </section>
    </main>
  </body>
</html>`;

export function renderDefaultApprovalDocument(job, signatureRecord) {
  return renderSignatureTemplate(DEFAULT_APPROVAL_TEMPLATE, job, signatureRecord);
}
