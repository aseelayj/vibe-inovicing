function formatCurrency(amount: number | string, currency = 'USD') {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(num);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function renderInvoiceHtml(data: {
  invoice: any;
  lineItems: any[];
  client: any;
  settings: any;
}): string {
  const { invoice, lineItems, client, settings } = data;
  const currency = invoice.currency || 'USD';

  const lineItemsHtml = lineItems.map((item, i) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        ${i + 1}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
        ${item.description}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;
        text-align: right;">${parseFloat(item.quantity)}</td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;
        text-align: right;">
        ${formatCurrency(item.unitPrice, currency)}
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;
        text-align: right;">
        ${formatCurrency(item.amount, currency)}
      </td>
    </tr>
  `).join('');

  const statusLabel = invoice.status.replace('_', ' ').toUpperCase();
  const statusColor = invoice.status === 'paid' ? '#16a34a'
    : invoice.status === 'overdue' ? '#dc2626' : '#2563eb';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      font-size: 14px;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header {
      display: flex; justify-content: space-between;
      align-items: flex-start; margin-bottom: 40px;
    }
    .company-name {
      font-size: 24px; font-weight: 700; color: #1f2937;
    }
    .company-details { color: #6b7280; font-size: 13px; margin-top: 4px; }
    .invoice-title {
      font-size: 32px; font-weight: 700; color: #2563eb;
      text-align: right;
    }
    .invoice-number {
      font-size: 14px; color: #6b7280; text-align: right; margin-top: 4px;
    }
    .status-badge {
      display: inline-block; padding: 4px 12px; border-radius: 9999px;
      font-size: 12px; font-weight: 600; text-transform: uppercase;
      color: white; margin-top: 8px;
    }
    .meta-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 32px; margin-bottom: 32px;
    }
    .meta-label {
      font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
      color: #9ca3af; font-weight: 600; margin-bottom: 4px;
    }
    .meta-value { font-size: 14px; color: #1f2937; }
    table {
      width: 100%; border-collapse: collapse; margin-bottom: 24px;
    }
    th {
      padding: 12px 16px; text-align: left; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.05em;
      color: #6b7280; font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
      background: #f9fafb;
    }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) {
      text-align: right;
    }
    .totals-row {
      display: flex; justify-content: flex-end; margin-bottom: 8px;
    }
    .totals-label {
      width: 150px; text-align: right; padding-right: 16px;
      color: #6b7280;
    }
    .totals-value { width: 120px; text-align: right; font-weight: 500; }
    .totals-total {
      font-size: 18px; font-weight: 700; color: #2563eb;
      border-top: 2px solid #2563eb; padding-top: 8px;
    }
    .notes-section {
      margin-top: 32px; padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    .notes-title {
      font-size: 12px; font-weight: 600; color: #6b7280;
      text-transform: uppercase; margin-bottom: 8px;
    }
    .notes-content { color: #4b5563; font-size: 13px; }
    .footer {
      margin-top: 48px; text-align: center;
      color: #9ca3af; font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="company-name">${settings.businessName}</div>
        <div class="company-details">
          ${settings.businessEmail}<br>
          ${settings.businessPhone || ''}<br>
          ${settings.businessAddress || ''}
        </div>
      </div>
      <div>
        <div class="invoice-title">INVOICE</div>
        <div class="invoice-number">${invoice.invoiceNumber}</div>
        <div style="text-align: right;">
          <span class="status-badge"
            style="background: ${statusColor}">
            ${statusLabel}
          </span>
        </div>
      </div>
    </div>

    <div class="meta-grid">
      <div>
        <div class="meta-label">Bill To</div>
        <div class="meta-value" style="font-weight: 600;">
          ${client?.name || 'N/A'}
        </div>
        ${client?.company
          ? `<div class="meta-value">${client.company}</div>` : ''}
        ${client?.email
          ? `<div class="meta-value">${client.email}</div>` : ''}
        ${client?.addressLine1
          ? `<div class="meta-value">${client.addressLine1}</div>` : ''}
        ${client?.city
          ? `<div class="meta-value">${client.city}${
            client.state ? ', ' + client.state : ''
          } ${client.postalCode || ''}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div style="margin-bottom: 12px;">
          <div class="meta-label">Issue Date</div>
          <div class="meta-value">${formatDate(invoice.issueDate)}</div>
        </div>
        <div style="margin-bottom: 12px;">
          <div class="meta-label">Due Date</div>
          <div class="meta-value">${formatDate(invoice.dueDate)}</div>
        </div>
        ${invoice.amountPaid && parseFloat(invoice.amountPaid) > 0 ? `
        <div>
          <div class="meta-label">Amount Paid</div>
          <div class="meta-value" style="color: #16a34a;">
            ${formatCurrency(invoice.amountPaid, currency)}
          </div>
        </div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Description</th>
          <th style="width: 80px;">Qty</th>
          <th style="width: 120px;">Unit Price</th>
          <th style="width: 120px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
    </table>

    <div style="display: flex; flex-direction: column; align-items: flex-end;">
      <div class="totals-row">
        <div class="totals-label">Subtotal</div>
        <div class="totals-value">
          ${formatCurrency(invoice.subtotal, currency)}
        </div>
      </div>
      ${parseFloat(invoice.taxRate) > 0 ? `
      <div class="totals-row">
        <div class="totals-label">Tax (${invoice.taxRate}%)</div>
        <div class="totals-value">
          ${formatCurrency(invoice.taxAmount, currency)}
        </div>
      </div>` : ''}
      ${parseFloat(invoice.discountAmount) > 0 ? `
      <div class="totals-row">
        <div class="totals-label">Discount</div>
        <div class="totals-value" style="color: #dc2626;">
          -${formatCurrency(invoice.discountAmount, currency)}
        </div>
      </div>` : ''}
      <div class="totals-row">
        <div class="totals-label totals-total">Total</div>
        <div class="totals-value totals-total">
          ${formatCurrency(invoice.total, currency)}
        </div>
      </div>
      ${parseFloat(invoice.amountPaid) > 0
        && parseFloat(invoice.amountPaid) < parseFloat(invoice.total)
        ? `
      <div class="totals-row" style="margin-top: 8px;">
        <div class="totals-label" style="color: #dc2626; font-weight: 600;">
          Balance Due
        </div>
        <div class="totals-value" style="color: #dc2626; font-weight: 600;">
          ${formatCurrency(
            parseFloat(invoice.total) - parseFloat(invoice.amountPaid),
            currency,
          )}
        </div>
      </div>` : ''}
    </div>

    ${invoice.notes ? `
    <div class="notes-section">
      <div class="notes-title">Notes</div>
      <div class="notes-content">${invoice.notes}</div>
    </div>` : ''}

    ${invoice.terms ? `
    <div class="notes-section" style="margin-top: 16px;">
      <div class="notes-title">Terms & Conditions</div>
      <div class="notes-content">${invoice.terms}</div>
    </div>` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p style="margin-top: 4px;">${settings.businessName}</p>
    </div>
  </div>
</body>
</html>`;
}
