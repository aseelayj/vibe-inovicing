function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderQuoteEmailHtml(data: {
  businessName: string;
  clientName: string;
  quoteNumber: string;
  total: string;
  currency: string;
  expiryDate: string | null;
  body: string;
  headerColor?: string;
  trackingPixelUrl?: string;
}): string {
  const bn = escapeHtml(data.businessName);
  const cn = escapeHtml(data.clientName);
  const qn = escapeHtml(data.quoteNumber);
  const tot = escapeHtml(data.total);
  const exp = data.expiryDate ? escapeHtml(data.expiryDate) : null;
  const bd = escapeHtml(data.body);
  const color = data.headerColor || '#7c3aed';
  const pixel = data.trackingPixelUrl
    ? `<img src="${data.trackingPixelUrl}" width="1" height="1" alt="" style="display:none;" />`
    : '';

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
            <td style="background: ${color}; padding: 24px 32px;">
              <h1 style="color: white; margin: 0; font-size: 20px;
                font-weight: 600;">${bn}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px; color: #1f2937;
                font-size: 15px;">
                Hi ${cn},
              </p>
              <div style="color: #4b5563; font-size: 14px;
                line-height: 1.6; margin-bottom: 24px;
                white-space: pre-wrap;">${bd}</div>

              <!-- Quote Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background: #f9fafb; border-radius: 8px;
                border: 1px solid #e5e7eb; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%">
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;
                          padding-bottom: 8px;">Quote Number</td>
                        <td style="text-align: right; font-weight: 600;
                          color: #1f2937; font-size: 14px;
                          padding-bottom: 8px;">${qn}</td>
                      </tr>
                      ${exp ? `
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;
                          padding-bottom: 8px;">Valid Until</td>
                        <td style="text-align: right; font-weight: 600;
                          color: #1f2937; font-size: 14px;
                          padding-bottom: 8px;">${exp}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="color: #6b7280; font-size: 13px;
                          border-top: 1px solid #e5e7eb;
                          padding-top: 12px;">Total Amount</td>
                        <td style="text-align: right; font-weight: 700;
                          color: ${color}; font-size: 18px;
                          border-top: 1px solid #e5e7eb;
                          padding-top: 12px;">${tot}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #6b7280; font-size: 13px;">
                Please find the quote attached as a PDF.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 20px 32px;
              border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;
                text-align: center;">
                Sent from ${bn} via Vibe Invoicing
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${pixel}
</body>
</html>`;
}
