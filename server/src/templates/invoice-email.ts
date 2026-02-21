export function renderInvoiceEmailHtml(data: {
  businessName: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  currency: string;
  dueDate: string;
  body: string;
}): string {
  const { businessName, clientName, invoiceNumber, total, currency, dueDate, body } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif;
  background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background: white; border-radius: 8px;
          overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: #2563eb; padding: 24px 32px;">
              <h1 style="color: white; margin: 0; font-size: 20px;
                font-weight: 600;">${businessName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #1f2937;
                font-size: 15px;">
                Hi ${clientName},
              </p>
              <div style="color: #4b5563; font-size: 14px;
                line-height: 1.6; margin-bottom: 24px;
                white-space: pre-wrap;">${body}</div>

              <!-- Invoice Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background: #f9fafb; border-radius: 8px;
                border: 1px solid #e5e7eb; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;
                          padding-bottom: 8px;">Invoice Number</td>
                        <td style="text-align: right; font-weight: 600;
                          color: #1f2937; font-size: 14px;
                          padding-bottom: 8px;">${invoiceNumber}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;
                          padding-bottom: 8px;">Due Date</td>
                        <td style="text-align: right; font-weight: 600;
                          color: #1f2937; font-size: 14px;
                          padding-bottom: 8px;">${dueDate}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;
                          border-top: 1px solid #e5e7eb;
                          padding-top: 12px;">Total Amount</td>
                        <td style="text-align: right; font-weight: 700;
                          color: #2563eb; font-size: 18px;
                          border-top: 1px solid #e5e7eb;
                          padding-top: 12px;">${total}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #6b7280; font-size: 13px;">
                Please find the invoice attached as a PDF.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px;
              border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;
                text-align: center;">
                Sent from ${businessName} via Vibe Invoicing
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderReminderEmailHtml(data: {
  businessName: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
  daysOverdue: number;
  body: string;
}): string {
  const { businessName, clientName, invoiceNumber, total, dueDate, daysOverdue, body } = data;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0"
    style="padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
          style="background: white; border-radius: 8px;
          overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: #dc2626; padding: 24px 32px;">
              <h1 style="color: white; margin: 0; font-size: 20px;">
                Payment Reminder
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #1f2937;
                font-size: 15px;">
                Hi ${clientName},
              </p>
              <div style="color: #4b5563; font-size: 14px;
                line-height: 1.6; margin-bottom: 24px;
                white-space: pre-wrap;">${body}</div>
              <table width="100%" style="background: #fef2f2;
                border-radius: 8px; border: 1px solid #fecaca;
                margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; color: #991b1b;
                      font-weight: 600; font-size: 14px;">
                      Invoice ${invoiceNumber}
                      ${daysOverdue > 0
                        ? `- ${daysOverdue} days overdue` : ''}
                    </p>
                    <p style="margin: 0; color: #dc2626;
                      font-size: 24px; font-weight: 700;">
                      ${total}
                    </p>
                    <p style="margin: 8px 0 0; color: #991b1b;
                      font-size: 13px;">
                      Due: ${dueDate}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px;
              border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;
                text-align: center;">
                Sent from ${businessName} via Vibe Invoicing
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
