import { format } from 'date-fns';

/**
 * Generate PDF-ready HTML for draft work orders
 */
export function generateDraftPdfHtml(drafts, company) {
  const now = new Date();
  const dateStr = format(now, 'MMMM d, yyyy · h:mm a');

  const rows = drafts.map(d => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-weight: 600;">${escapeHtml(d.title)}</td>
      <td style="padding: 12px;">${escapeHtml(d.description || '')}</td>
      <td style="padding: 12px;">${escapeHtml(d.suggested_company_name || 'Unassigned')}</td>
      <td style="padding: 12px;">${escapeHtml(d.service_line?.replace(/_/g, ' ') || 'Other')}</td>
      <td style="padding: 12px; text-align: center; color: ${d.confidence_score >= 70 ? '#16a34a' : d.confidence_score >= 40 ? '#ea580c' : '#dc2626'};">
        <strong>${d.confidence_score}%</strong>
      </td>
      <td style="padding: 12px;">${escapeHtml(d.review_status)}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ESX Draft Work Orders</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.5;
          color: #1f2937;
          margin: 0;
          padding: 20px;
          background: white;
        }
        .header {
          margin-bottom: 30px;
          border-bottom: 2px solid #059669;
          padding-bottom: 15px;
        }
        .header h1 {
          margin: 0 0 5px 0;
          font-size: 28px;
          color: #059669;
        }
        .meta {
          font-size: 12px;
          color: #6b7280;
          margin-bottom: 20px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        th {
          background: #f3f4f6;
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .draft-card {
          page-break-inside: avoid;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          background: #f9fafb;
        }
        .draft-card h3 {
          margin: 0 0 10px 0;
          font-size: 16px;
          color: #1f2937;
        }
        .draft-field {
          display: flex;
          margin-bottom: 12px;
        }
        .draft-field-label {
          font-weight: 600;
          width: 150px;
          color: #6b7280;
          font-size: 12px;
        }
        .draft-field-value {
          flex: 1;
          color: #1f2937;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
        }
        @media print {
          body { padding: 0; }
          .draft-card { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>SRH System ESX Draft Work Orders</h1>
        <p class="meta">
          <strong>Company:</strong> ${escapeHtml(company?.name || 'Unknown')}<br/>
          <strong>Generated:</strong> ${dateStr}<br/>
          <strong>Total Drafts:</strong> ${drafts.length}
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Description</th>
            <th>Assigned Company</th>
            <th>Service Line</th>
            <th>Confidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="page-break-before: always; margin-top: 40px;">
        <h2 style="margin-top: 0;">Detailed Work Orders</h2>
        ${drafts.map(d => `
          <div class="draft-card">
            <h3>${escapeHtml(d.title)}</h3>
            <div class="draft-field">
              <div class="draft-field-label">Description:</div>
              <div class="draft-field-value">${escapeHtml(d.description || '—')}</div>
            </div>
            <div class="draft-field">
              <div class="draft-field-label">Company:</div>
              <div class="draft-field-value">${escapeHtml(d.suggested_company_name || 'Unassigned')}</div>
            </div>
            <div class="draft-field">
              <div class="draft-field-label">Subcontractor:</div>
              <div class="draft-field-value">${escapeHtml(d.suggested_subcontractor_name || '—')}</div>
            </div>
            <div class="draft-field">
              <div class="draft-field-label">Service Line:</div>
              <div class="draft-field-value">${escapeHtml(d.service_line?.replace(/_/g, ' ') || 'Other')}</div>
            </div>
            <div class="draft-field">
              <div class="draft-field-label">Labor Category:</div>
              <div class="draft-field-value">${escapeHtml(d.estimated_labor_category || '—')}</div>
            </div>
            <div class="draft-field">
              <div class="draft-field-label">Confidence:</div>
              <div class="draft-field-value">${d.confidence_score}%</div>
            </div>
            <div class="draft-field">
              <div class="draft-field-label">Status:</div>
              <div class="draft-field-value">${escapeHtml(d.review_status)}</div>
            </div>
            <div class="draft-field">
              <div class="draft-field-label">ESX Source:</div>
              <div class="draft-field-value">${escapeHtml(d.source_import_id || '—')}</div>
            </div>
            ${d.reviewer_notes ? `
              <div class="draft-field">
                <div class="draft-field-label">Reviewer Notes:</div>
                <div class="draft-field-value"><em>${escapeHtml(d.reviewer_notes)}</em></div>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="footer">
        <p>This document was auto-generated by the SRH System. Draft work orders are pending human review and approval.</p>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Export drafts as PDF using browser print dialog
 */
export function openPrintDialog(drafts, company) {
  const html = generateDraftPdfHtml(drafts, company);
  const w = window.open('', '', 'width=1000,height=600');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 250);
}

/**
 * Download PDF using jsPDF if available, otherwise use print dialog
 */
export async function downloadDraftsPdf(drafts, company) {
  try {
    const { jsPDF } = await import('jspdf');
    const { html2canvas } = await import('html2canvas');
    
    const html = generateDraftPdfHtml(drafts, company);
    const canvas = await html2canvas(html);
    const pdf = new jsPDF();
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
    pdf.save('esx-draft-work-orders.pdf');
  } catch {
    // Fallback to print dialog
    openPrintDialog(drafts, company);
  }
}