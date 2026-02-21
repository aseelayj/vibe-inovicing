const API_URL = 'https://backend.jofotara.gov.jo/core/invoices/';
const MAX_RETRIES = 3;

export interface JofotaraApiResponse {
  success: boolean;
  uuid: string | null;
  status: string | null;
  qrCode: string | null;
  invoiceNumber: string | null;
  signedXml: string | null;
  rawResponse: unknown;
  errors: Array<{ code?: string; message: string; category?: string }>;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitToJofotara(
  clientId: string,
  clientSecret: string,
  xmlContent: string,
): Promise<JofotaraApiResponse> {
  const encodedInvoice = Buffer.from(xmlContent, 'utf-8')
    .toString('base64');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Client-Id': clientId,
          'Secret-Key': clientSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice: encodedInvoice }),
      });

      // 5xx = retry
      if (res.status >= 500) {
        lastError = new Error(`Server error: ${res.status}`);
        if (attempt < MAX_RETRIES - 1) {
          await sleep(1000 * Math.pow(2, attempt));
          continue;
        }
        throw lastError;
      }

      // 403 = auth error
      if (res.status === 403) {
        return {
          success: false,
          uuid: null,
          status: null,
          qrCode: null,
          invoiceNumber: null,
          signedXml: null,
          rawResponse: null,
          errors: [{
            code: 'AUTH_ERROR',
            message: 'Authentication failed. Check Client ID and Secret.',
            category: 'Authentication',
          }],
        };
      }

      const body = await res.json().catch(() => ({}));

      // Parse response - handle both new and legacy formats
      const result = parseResponse(body, res.status);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
    }
  }

  return {
    success: false,
    uuid: null,
    status: null,
    qrCode: null,
    invoiceNumber: null,
    signedXml: null,
    rawResponse: null,
    errors: [{
      code: 'NETWORK_ERROR',
      message: lastError?.message || 'Failed to connect to JoFotara',
      category: 'Network',
    }],
  };
}

function parseResponse(
  body: Record<string, unknown>,
  statusCode: number,
): JofotaraApiResponse {
  // Determine success from response structure
  let success = false;

  // New API format
  if (body.validationResults) {
    const vr = body.validationResults as Record<string, unknown>;
    success = vr.status === 'PASS'
      && (body.invoiceStatus === 'SUBMITTED'
        || body.invoiceStatus === 'ALREADY_SUBMITTED');
  }
  // Legacy format
  else if (body.EINV_RESULTS) {
    const er = body.EINV_RESULTS as Record<string, unknown>;
    success = er.status !== 'ERROR'
      && (body.EINV_STATUS === 'SUBMITTED'
        || body.EINV_STATUS === 'ALREADY_SUBMITTED');
  }

  if (statusCode !== 200) {
    success = false;
  }

  // Extract UUID (new or legacy)
  const uuid = (body.invoiceUUID || body.EINV_INV_UUID || null) as
    string | null;

  // Extract QR code
  const qrCode = (body.qrCode || body.EINV_QR || null) as string | null;

  // Extract invoice number
  const invoiceNumber = (body.invoiceNumber || body.EINV_NUM || null) as
    string | null;

  // Decode signed XML from base64
  const signedB64 = (body.submittedInvoice || body.EINV_SINGED_INVOICE
    || null) as string | null;
  let signedXml: string | null = null;
  if (signedB64) {
    try {
      signedXml = Buffer.from(signedB64, 'base64').toString('utf-8');
    } catch {
      signedXml = null;
    }
  }

  // Extract errors
  const errors: Array<{ code?: string; message: string; category?: string }>
    = [];
  if (!success) {
    // New format
    const vr = body.validationResults as Record<string, unknown>
      | undefined;
    if (vr?.errorMessages && Array.isArray(vr.errorMessages)) {
      for (const e of vr.errorMessages) {
        errors.push({
          code: e.code,
          message: e.message || JSON.stringify(e),
          category: e.category,
        });
      }
    }
    // Legacy format
    const er = body.EINV_RESULTS as Record<string, unknown> | undefined;
    if (er?.ERRORS && Array.isArray(er.ERRORS)) {
      for (const e of er.ERRORS) {
        errors.push({
          code: e.EINV_CODE,
          message: e.EINV_MESSAGE || JSON.stringify(e),
          category: e.EINV_CATEGORY,
        });
      }
    }
    if (errors.length === 0 && !success) {
      errors.push({
        code: 'UNKNOWN',
        message: 'Invoice submission failed',
        category: 'API',
      });
    }
  }

  // Extract status string
  const status = (body.invoiceStatus || body.EINV_STATUS || null) as
    string | null;

  return {
    success,
    uuid,
    status,
    qrCode,
    invoiceNumber,
    signedXml,
    rawResponse: body,
    errors,
  };
}
