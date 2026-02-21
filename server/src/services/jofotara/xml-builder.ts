import type { JofotaraInvoiceType } from '@vibe/shared';
import { JOFOTARA_PAYMENT_CODES } from '@vibe/shared';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmt(n: number): string {
  return n.toFixed(2);
}

export interface XmlLineItem {
  id: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  description: string;
  taxCategory: 'S' | 'Z' | 'O';
  taxPercent: number;
}

export interface XmlInvoiceParams {
  invoiceId: string;
  uuid: string;
  issueDate: string; // YYYY-MM-DD
  invoiceType: JofotaraInvoiceType;
  paymentMethod: 'cash' | 'receivable';
  note?: string;
  invoiceCounter?: number;

  // Credit invoice fields
  isCreditInvoice?: boolean;
  originalInvoiceId?: string;
  originalInvoiceUuid?: string;
  originalFullAmount?: number;
  reasonForReturn?: string;

  // Seller
  sellerName: string;
  sellerTin: string;

  // Customer
  customerId: string;
  customerIdType: 'TIN' | 'NIN' | 'PN';
  customerName: string;
  customerPhone?: string;
  customerCityCode?: string;
  customerPostalCode?: string;

  // Supplier income source
  incomeSourceSequence: string;

  // Items
  lineItems: XmlLineItem[];
}

export function buildJofotaraXml(params: XmlInvoiceParams): string {
  const xml: string[] = [];
  const paymentCode =
    JOFOTARA_PAYMENT_CODES[params.invoiceType][params.paymentMethod];
  const invoiceTypeCode = params.isCreditInvoice ? '381' : '388';

  // XML declaration + root
  xml.push('<?xml version="1.0" encoding="UTF-8"?>');
  xml.push(
    '<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"'
    + ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:'
    + 'CommonAggregateComponents-2"'
    + ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:'
    + 'CommonBasicComponents-2"'
    + ' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:'
    + 'CommonExtensionComponents-2">',
  );

  // UBL version
  xml.push('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>');

  // Basic info
  xml.push(`<cbc:ID>${escapeXml(params.invoiceId)}</cbc:ID>`);
  xml.push(`<cbc:UUID>${escapeXml(params.uuid)}</cbc:UUID>`);
  xml.push(`<cbc:IssueDate>${params.issueDate}</cbc:IssueDate>`);
  xml.push(
    `<cbc:InvoiceTypeCode name="${escapeXml(paymentCode)}">`
    + `${invoiceTypeCode}</cbc:InvoiceTypeCode>`,
  );

  if (params.note) {
    xml.push(`<cbc:Note>${escapeXml(params.note)}</cbc:Note>`);
  }

  // Currency
  xml.push('<cbc:DocumentCurrencyCode>JOD</cbc:DocumentCurrencyCode>');
  xml.push('<cbc:TaxCurrencyCode>JOD</cbc:TaxCurrencyCode>');

  // Billing reference (credit invoices only)
  if (params.isCreditInvoice && params.originalInvoiceId) {
    xml.push('<cac:BillingReference>');
    xml.push('    <cac:InvoiceDocumentReference>');
    xml.push(
      `        <cbc:ID>${escapeXml(params.originalInvoiceId)}</cbc:ID>`,
    );
    xml.push(
      `        <cbc:UUID>${escapeXml(
        params.originalInvoiceUuid || '',
      )}</cbc:UUID>`,
    );
    xml.push(
      `        <cbc:DocumentDescription>${fmt(
        params.originalFullAmount || 0,
      )}</cbc:DocumentDescription>`,
    );
    xml.push('    </cac:InvoiceDocumentReference>');
    xml.push('</cac:BillingReference>');
  }

  // Invoice counter (ICV)
  const counter = params.invoiceCounter ?? 1;
  xml.push('<cac:AdditionalDocumentReference>');
  xml.push('    <cbc:ID>ICV</cbc:ID>');
  xml.push(`    <cbc:UUID>${counter}</cbc:UUID>`);
  xml.push('</cac:AdditionalDocumentReference>');

  // Seller (AccountingSupplierParty)
  xml.push('<cac:AccountingSupplierParty>');
  xml.push('    <cac:Party>');
  xml.push('        <cac:PostalAddress>');
  xml.push('            <cac:Country>');
  xml.push(
    '                <cbc:IdentificationCode>JO</cbc:IdentificationCode>',
  );
  xml.push('            </cac:Country>');
  xml.push('        </cac:PostalAddress>');
  xml.push('        <cac:PartyTaxScheme>');
  xml.push(
    `            <cbc:CompanyID>${escapeXml(
      params.sellerTin,
    )}</cbc:CompanyID>`,
  );
  xml.push('            <cac:TaxScheme>');
  xml.push('                <cbc:ID>VAT</cbc:ID>');
  xml.push('            </cac:TaxScheme>');
  xml.push('        </cac:PartyTaxScheme>');
  xml.push('        <cac:PartyLegalEntity>');
  xml.push(
    `            <cbc:RegistrationName>${escapeXml(
      params.sellerName,
    )}</cbc:RegistrationName>`,
  );
  xml.push('        </cac:PartyLegalEntity>');
  xml.push('    </cac:Party>');
  xml.push('</cac:AccountingSupplierParty>');

  // Customer (AccountingCustomerParty)
  xml.push('<cac:AccountingCustomerParty>');
  xml.push('    <cac:Party>');
  xml.push('        <cac:PartyIdentification>');
  xml.push(
    `            <cbc:ID schemeID="${escapeXml(params.customerIdType)}">`
    + `${escapeXml(params.customerId)}</cbc:ID>`,
  );
  xml.push('        </cac:PartyIdentification>');

  if (params.customerCityCode || params.customerPostalCode) {
    xml.push('        <cac:PostalAddress>');
    if (params.customerPostalCode) {
      xml.push(
        `            <cbc:PostalZone>${escapeXml(
          params.customerPostalCode,
        )}</cbc:PostalZone>`,
      );
    }
    if (params.customerCityCode) {
      xml.push(
        `            <cbc:CountrySubentityCode>${escapeXml(
          params.customerCityCode,
        )}</cbc:CountrySubentityCode>`,
      );
    }
    xml.push('            <cac:Country>');
    xml.push(
      '                <cbc:IdentificationCode>JO'
      + '</cbc:IdentificationCode>',
    );
    xml.push('            </cac:Country>');
    xml.push('        </cac:PostalAddress>');
  }

  xml.push('        <cac:PartyTaxScheme>');
  xml.push(
    `            <cbc:CompanyID>${escapeXml(
      params.customerId,
    )}</cbc:CompanyID>`,
  );
  xml.push('            <cac:TaxScheme>');
  xml.push('                <cbc:ID>VAT</cbc:ID>');
  xml.push('            </cac:TaxScheme>');
  xml.push('        </cac:PartyTaxScheme>');

  if (params.customerName) {
    xml.push('        <cac:PartyLegalEntity>');
    xml.push(
      `            <cbc:RegistrationName>${escapeXml(
        params.customerName,
      )}</cbc:RegistrationName>`,
    );
    xml.push('        </cac:PartyLegalEntity>');
  }
  if (params.customerPhone) {
    xml.push('        <cac:Contact>');
    xml.push(
      `            <cbc:Telephone>${escapeXml(
        params.customerPhone,
      )}</cbc:Telephone>`,
    );
    xml.push('        </cac:Contact>');
  }
  xml.push('    </cac:Party>');
  xml.push('</cac:AccountingCustomerParty>');

  // Supplier income source
  xml.push('<cac:SellerSupplierParty>');
  xml.push('    <cac:Party>');
  xml.push('        <cac:PartyIdentification>');
  xml.push(
    `            <cbc:ID>${escapeXml(
      params.incomeSourceSequence,
    )}</cbc:ID>`,
  );
  xml.push('        </cac:PartyIdentification>');
  xml.push('    </cac:Party>');
  xml.push('</cac:SellerSupplierParty>');

  // Payment means (credit invoices only)
  if (params.isCreditInvoice && params.reasonForReturn) {
    xml.push('<cac:PaymentMeans>');
    xml.push(
      '<cbc:PaymentMeansCode listID="UN/ECE 4461">10'
      + '</cbc:PaymentMeansCode>',
    );
    xml.push(
      `<cbc:InstructionNote>${escapeXml(
        params.reasonForReturn,
      )}</cbc:InstructionNote>`,
    );
    xml.push('</cac:PaymentMeans>');
  }

  // Calculate totals from line items (round per-line to avoid drift)
  let taxExclusiveAmount = 0;
  let taxTotalAmount = 0;
  let discountTotalAmount = 0;

  for (const item of params.lineItems) {
    const lineSubtotal = item.quantity * item.unitPrice;
    const lineAfterDiscount = lineSubtotal - item.discount;
    const lineTax =
      item.taxCategory === 'S'
        ? Math.round(lineAfterDiscount * (item.taxPercent / 100) * 100) / 100
        : 0;
    taxExclusiveAmount += Math.round(lineAfterDiscount * 100) / 100;
    taxTotalAmount += lineTax;
    discountTotalAmount += item.discount;
  }
  taxExclusiveAmount = Math.round(taxExclusiveAmount * 100) / 100;
  taxTotalAmount = Math.round(taxTotalAmount * 100) / 100;
  discountTotalAmount = Math.round(discountTotalAmount * 100) / 100;

  const taxInclusiveAmount = taxExclusiveAmount + taxTotalAmount;
  const payableAmount = taxInclusiveAmount;

  // Allowance/Charge (discount at invoice level)
  if (discountTotalAmount > 0) {
    xml.push('<cac:AllowanceCharge>');
    xml.push('    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>');
    xml.push(
      '    <cbc:AllowanceChargeReason>discount'
      + '</cbc:AllowanceChargeReason>',
    );
    xml.push(
      `    <cbc:Amount currencyID="JOD">${fmt(
        discountTotalAmount,
      )}</cbc:Amount>`,
    );
    xml.push('</cac:AllowanceCharge>');
  }

  // Tax total
  xml.push('<cac:TaxTotal>');
  xml.push(
    `    <cbc:TaxAmount currencyID="JOD">${fmt(
      taxTotalAmount,
    )}</cbc:TaxAmount>`,
  );
  xml.push('</cac:TaxTotal>');

  // Legal monetary total
  xml.push('<cac:LegalMonetaryTotal>');
  xml.push(
    `    <cbc:TaxExclusiveAmount currencyID="JOD">${fmt(
      taxExclusiveAmount,
    )}</cbc:TaxExclusiveAmount>`,
  );
  xml.push(
    `    <cbc:TaxInclusiveAmount currencyID="JOD">${fmt(
      taxInclusiveAmount,
    )}</cbc:TaxInclusiveAmount>`,
  );
  if (discountTotalAmount > 0) {
    xml.push(
      `    <cbc:AllowanceTotalAmount currencyID="JOD">${fmt(
        discountTotalAmount,
      )}</cbc:AllowanceTotalAmount>`,
    );
  }
  xml.push(
    `    <cbc:PayableAmount currencyID="JOD">${fmt(
      payableAmount,
    )}</cbc:PayableAmount>`,
  );
  xml.push('</cac:LegalMonetaryTotal>');

  // Invoice lines
  for (const item of params.lineItems) {
    const lineSubtotal = item.quantity * item.unitPrice;
    const lineAfterDiscount = Math.round(
      (lineSubtotal - item.discount) * 100,
    ) / 100;
    const lineTax =
      item.taxCategory === 'S'
        ? Math.round(
          lineAfterDiscount * (item.taxPercent / 100) * 100,
        ) / 100
        : 0;
    const lineTaxInclusive = Math.round(
      (lineAfterDiscount + lineTax) * 100,
    ) / 100;

    xml.push('<cac:InvoiceLine>');
    xml.push(`    <cbc:ID>${item.id}</cbc:ID>`);
    xml.push(
      `    <cbc:InvoicedQuantity unitCode="PCE">${fmt(
        item.quantity,
      )}</cbc:InvoicedQuantity>`,
    );
    xml.push(
      `    <cbc:LineExtensionAmount currencyID="JOD">${fmt(
        lineAfterDiscount,
      )}</cbc:LineExtensionAmount>`,
    );

    // Line tax
    xml.push('    <cac:TaxTotal>');
    xml.push(
      `        <cbc:TaxAmount currencyID="JOD">${fmt(
        lineTax,
      )}</cbc:TaxAmount>`,
    );
    xml.push(
      `        <cbc:RoundingAmount currencyID="JOD">${fmt(
        lineTaxInclusive,
      )}</cbc:RoundingAmount>`,
    );
    xml.push('        <cac:TaxSubtotal>');
    xml.push(
      `            <cbc:TaxAmount currencyID="JOD">${fmt(
        lineTax,
      )}</cbc:TaxAmount>`,
    );
    xml.push('            <cac:TaxCategory>');
    xml.push(
      '                <cbc:ID schemeAgencyID="6"'
      + ` schemeID="UN/ECE 5305">${item.taxCategory}</cbc:ID>`,
    );
    xml.push(
      `                <cbc:Percent>${fmt(
        item.taxPercent,
      )}</cbc:Percent>`,
    );
    xml.push('                <cac:TaxScheme>');
    xml.push(
      '                    <cbc:ID schemeAgencyID="6"'
      + ' schemeID="UN/ECE 5153">VAT</cbc:ID>',
    );
    xml.push('                </cac:TaxScheme>');
    xml.push('            </cac:TaxCategory>');
    xml.push('        </cac:TaxSubtotal>');
    xml.push('    </cac:TaxTotal>');

    // Item description
    xml.push('    <cac:Item>');
    xml.push(
      `        <cbc:Name>${escapeXml(item.description)}</cbc:Name>`,
    );
    xml.push('    </cac:Item>');

    // Price with discount
    xml.push('    <cac:Price>');
    xml.push(
      `        <cbc:PriceAmount currencyID="JOD">${fmt(
        item.unitPrice,
      )}</cbc:PriceAmount>`,
    );
    if (item.discount > 0) {
      xml.push('        <cac:AllowanceCharge>');
      xml.push(
        '            <cbc:ChargeIndicator>false</cbc:ChargeIndicator>',
      );
      xml.push(
        '            <cbc:AllowanceChargeReason>DISCOUNT'
        + '</cbc:AllowanceChargeReason>',
      );
      xml.push(
        `            <cbc:Amount currencyID="JOD">${fmt(
          item.discount,
        )}</cbc:Amount>`,
      );
      xml.push('        </cac:AllowanceCharge>');
    }
    xml.push('    </cac:Price>');

    xml.push('</cac:InvoiceLine>');
  }

  xml.push('</Invoice>');

  return xml.join('\n');
}
