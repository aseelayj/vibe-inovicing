import { GoogleGenAI, createPartFromBase64, type Part } from '@google/genai';
import { TRANSACTION_CATEGORIES } from '@vibe/shared';
import { env } from '../env.js';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

function parseJsonResponse(text: string): any {
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    console.error('Failed to parse AI response:', cleaned.slice(0, 200));
    throw new Error('AI returned an invalid response. Please try again.');
  }
}

export async function generateInvoiceFromPrompt(
  prompt: string,
  clients: { id: number; name: string; company: string | null }[],
): Promise<{
  clientId: number | null;
  clientName: string;
  lineItems: { description: string; quantity: number; unitPrice: number }[];
  notes: string;
  dueInDays: number;
  currency: string;
}> {
  const clientList = clients
    .map((c) => `ID:${c.id} - ${c.name}${c.company ? ` (${c.company})` : ''}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: `You are an invoicing assistant. Given a natural language description of work done or services provided, generate a structured invoice.

Here are the existing clients:
${clientList || 'No clients yet.'}

Respond with ONLY valid JSON matching this schema:
{
  "clientId": number | null,
  "clientName": "string",
  "lineItems": [{"description": "string", "quantity": number, "unitPrice": number}],
  "notes": "string",
  "dueInDays": number,
  "currency": "USD"
}

If the client matches an existing one, use their ID. Otherwise set clientId to null and provide the name.
Extract line items with clear descriptions, quantities, and unit prices.
If no due date is mentioned, default to 30 days.`,
      temperature: 0.3,
    },
  });

  return parseJsonResponse(response.text || '{}');
}

export async function suggestLineItems(
  clientHistory: { description: string; quantity: number; unitPrice: number }[],
  partialDescription?: string,
): Promise<{ description: string; quantity: number; unitPrice: number }[]> {
  const historyStr = clientHistory.length > 0
    ? clientHistory.map(
      (h) => `- "${h.description}" (qty: ${h.quantity}, price: ${h.unitPrice})`
    ).join('\n')
    : 'No previous history.';

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: partialDescription
      ? `Suggest line items similar to or continuing from: "${partialDescription}"`
      : 'Suggest common line items based on the client history.',
    config: {
      systemInstruction: `You are an invoicing assistant. Based on the client's previous invoice line items, suggest relevant line items for a new invoice.

Previous line items:
${historyStr}

Respond with ONLY a JSON array of up to 5 suggestions:
[{"description": "string", "quantity": number, "unitPrice": number}]`,
      temperature: 0.5,
    },
  });

  return parseJsonResponse(response.text || '[]');
}

export async function draftEmail(params: {
  type: 'send' | 'reminder' | 'followup';
  invoiceNumber: string;
  clientName: string;
  total: string;
  dueDate: string;
  businessName: string;
  isOverdue?: boolean;
  daysOverdue?: number;
}): Promise<{ subject: string; body: string }> {
  const contextMap = {
    send: `Draft a professional email to send invoice ${params.invoiceNumber} for ${params.total} due on ${params.dueDate}.`,
    reminder: `Draft a friendly payment reminder for invoice ${params.invoiceNumber} for ${params.total}${params.isOverdue ? `, which is ${params.daysOverdue} days overdue` : `, due on ${params.dueDate}`}.`,
    followup: `Draft a follow-up email about invoice ${params.invoiceNumber} for ${params.total} due on ${params.dueDate}.`,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: contextMap[params.type],
    config: {
      systemInstruction: `You are an invoicing assistant for ${params.businessName}. Draft professional, concise emails for invoicing purposes. The client's name is ${params.clientName}.

Respond with ONLY valid JSON:
{"subject": "string", "body": "string"}

The body should be plain text (no HTML), 2-4 sentences, professional but warm. Do not include greetings or signatures - those are added automatically.`,
      temperature: 0.7,
    },
  });

  return parseJsonResponse(response.text || '{}');
}

export async function summarizeDashboard(stats: {
  totalRevenue: number;
  outstandingAmount: number;
  overdueAmount: number;
  totalInvoices: number;
  totalClients: number;
  paidThisMonth: number;
}): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summarize these business metrics: ${JSON.stringify(stats)}`,
    config: {
      systemInstruction: `You are a business analytics assistant. Given invoice/payment statistics, provide a brief, insightful 2-3 sentence summary highlighting key trends, concerns (like overdue amounts), and positives. Be concise and actionable. Respond with plain text only, no JSON.`,
      temperature: 0.5,
    },
  });

  return response.text || 'Unable to generate summary.';
}

export async function smartSearch(
  query: string,
  context: {
    invoices: { id: number; invoiceNumber: string; clientName: string; total: string; status: string }[];
    clients: { id: number; name: string; email: string | null; company: string | null }[];
  },
): Promise<{
  results: { type: 'invoice' | 'client'; id: number; label: string; detail: string }[];
}> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Search query: "${query}"`,
    config: {
      systemInstruction: `You are a search assistant for an invoicing system. Given a search query, find the most relevant matches from the data below.

Invoices: ${JSON.stringify(context.invoices.slice(0, 50))}
Clients: ${JSON.stringify(context.clients.slice(0, 50))}

Respond with ONLY valid JSON:
{"results": [{"type": "invoice" | "client", "id": number, "label": "string", "detail": "string"}]}

Return up to 10 most relevant results. Match by name, number, email, company, status, amounts, etc. The label should be the primary identifier (invoice number or client name) and detail should be a short description.`,
      temperature: 0.2,
    },
  });

  return parseJsonResponse(response.text || '{"results": []}');
}

export async function parseTransactionsFromText(
  text: string,
  base64Data?: string,
  mimeType?: string,
): Promise<{
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}[]> {
  const categories = TRANSACTION_CATEGORIES.join(', ');
  const systemInstruction = `You are a financial data extraction assistant. Parse bank statement data and extract individual transactions.

Available categories: ${categories}

For each transaction, determine:
- date: in YYYY-MM-DD format
- description: clear, concise description of the transaction
- amount: always positive (the "type" field indicates direction)
- type: "income" for credits/deposits, "expense" for debits/charges
- category: best matching category from the list above

Respond with ONLY a valid JSON array:
[{"date": "YYYY-MM-DD", "description": "string", "amount": number, "type": "income" | "expense", "category": "string"}]

If you cannot parse any transactions, return an empty array [].`;

  const contents: (string | Part)[] = [];

  if (base64Data && mimeType) {
    contents.push(createPartFromBase64(base64Data, mimeType));
    contents.push('Extract all transactions from this bank statement document.');
  } else {
    contents.push(`Parse the following bank statement data and extract transactions:\n\n${text}`);
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction,
      temperature: 0.2,
    },
  });

  return parseJsonResponse(response.text || '[]');
}

// ---- Daily Summary ----
export async function generateDailySummary(
  date: string,
  activities: {
    description: string | null;
    action: string;
    entityType: string;
    userName: string | null;
    createdAt: Date;
  }[],
) {
  const byUser = new Map<string, string[]>();
  for (const a of activities) {
    const name = a.userName || 'System';
    if (!byUser.has(name)) byUser.set(name, []);
    byUser.get(name)!.push(
      a.description || `${a.action} on ${a.entityType}`,
    );
  }

  let activityText = '';
  for (const [name, items] of byUser) {
    activityText += `\n${name}:\n`;
    for (const item of items) {
      activityText += `  - ${item}\n`;
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Summarize the following team activity for ${date}:\n${activityText}`,
    config: {
      systemInstruction: `You are a business activity summarizer. Given a list of activities grouped by team member, provide:
1. A brief overall summary (2-3 sentences) of the day's work
2. A per-user summary (1-2 sentences each) highlighting key accomplishments

Respond with ONLY valid JSON:
{
  "summary": "Overall team summary...",
  "userSummaries": [{"userName": "Name", "summary": "What they did..."}]
}`,
      temperature: 0.5,
    },
  });

  const parsed = parseJsonResponse(response.text || '{}');
  return {
    date,
    summary: parsed.summary || 'No summary available.',
    userSummaries: parsed.userSummaries || [],
  };
}
