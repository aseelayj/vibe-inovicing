import { Router } from 'express';
import { eq, desc, and, lt, ne } from 'drizzle-orm';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.js';
import { conversations, chatMessages, invoices } from '../db/schema.js';
import { env } from '../env.js';
import { buildSystemPrompt, buildGeminiContents } from '../services/chat.service.js';
import {
  chatToolDeclarations,
  toolExecutors,
  READ_ONLY_TOOLS,
  generateActionSummary,
} from '../services/chat-tools.js';
import type { ChatMessage, ChatToolCall, PageContext } from '@vibe/shared';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Helper: send SSE event
function sendSSE(res: any, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Helper: auto-title a conversation using AI (fire-and-forget)
async function autoTitleConversation(conversationId: number) {
  const [conv] = await db.select().from(conversations)
    .where(eq(conversations.id, conversationId));
  if (!conv || conv.title !== 'New Chat') return;

  const msgs = await db.select().from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt);
  if (msgs.length < 2) return; // Need at least user + assistant

  const snippet = msgs
    .filter((m) => m.content)
    .slice(0, 4)
    .map((m) => `${m.role}: ${m.content!.slice(0, 200)}`)
    .join('\n');

  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: snippet }] }],
    config: {
      systemInstruction:
        'Generate a short title (3-6 words) for this conversation. '
        + 'Return ONLY the title text, nothing else. No quotes.',
      temperature: 0.3,
      maxOutputTokens: 30,
    },
  });

  const title = result.text?.trim().slice(0, 60);
  if (title) {
    await db.update(conversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }
}

// GET /proactive-alerts - Check for notifications to ping the user
router.get('/proactive-alerts', async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = await db.select({ id: invoices.id }).from(invoices)
      .where(
        and(
          lt(invoices.dueDate, today),
          ne(invoices.status, 'paid'),
          ne(invoices.status, 'cancelled')
        )
      );

    const overdueCount = overdueInvoices.length;
    if (overdueCount > 0) {
      res.json({
        data: {
          hasAlerts: true,
          message: `You have ${overdueCount} overdue invoice${overdueCount > 1 ? 's' : ''} that need attention.`
        }
      });
    } else {
      res.json({ data: { hasAlerts: false } });
    }
  } catch (err) {
    next(err);
  }
});

// POST /transcribe - Transcribe audio via Gemini
router.post('/transcribe', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    const base64Audio = req.file.buffer.toString('base64');

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Transcribe this audio precisely. Return ONLY the transcribed text. Do not include any conversational filler, markdown formatting, or introductory words.' },
            {
              inlineData: {
                data: base64Audio,
                mimeType: req.file.mimetype || 'audio/webm',
              }
            }
          ]
        }
      ]
    });

    const text = result.text?.trim() || '';
    res.json({ data: { text } });
  } catch (err) {
    console.error('Transcription error:', err);
    next(err);
  }
});

// POST / - Create new conversation
router.post('/', async (req, res, next) => {
  try {
    const { title, pageContext } = req.body;
    const [conversation] = await db.insert(conversations).values({
      title: title || 'New Chat',
      pageContext: pageContext || null,
    }).returning();
    res.status(201).json({ data: conversation });
  } catch (err) {
    next(err);
  }
});

// GET / - List conversations
router.get('/', async (req, res, next) => {
  try {
    const result = await db.select().from(conversations)
      .where(eq(conversations.isArchived, false))
      .orderBy(desc(conversations.updatedAt));
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get conversation with messages
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, id),
      with: { messages: true },
    });
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ data: conversation });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete conversation
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(conversations).where(eq(conversations.id, id));
    res.json({ data: { message: 'Conversation deleted' } });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id - Update conversation (title, archive)
router.patch('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, isArchived } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (isArchived !== undefined) updates.isArchived = isArchived;

    const [updated] = await db.update(conversations)
      .set(updates)
      .where(eq(conversations.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /:id/messages - Send message and stream AI response via SSE
router.post('/:id/messages', async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const { content, pageContext, attachments } = req.body;

    // Input validation
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }
    if (content.length > 8000) {
      res.status(400).json({ error: 'Message too long (max 8000 characters)' });
      return;
    }

    // Verify conversation exists
    const [conversation] = await db.select().from(conversations)
      .where(eq(conversations.id, conversationId));
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    // Always update timestamp; update page context if provided
    const convUpdate: Record<string, unknown> = { updatedAt: new Date() };
    if (pageContext) convUpdate.pageContext = pageContext;
    await db.update(conversations)
      .set(convUpdate)
      .where(eq(conversations.id, conversationId));

    // Save user message
    await db.insert(chatMessages).values({
      conversationId,
      role: 'user',
      content: content || null,
      attachments: attachments || null,
    });

    // Load full conversation history
    const allMessages = await db.select().from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt);

    const geminiContents = buildGeminiContents(allMessages as unknown as ChatMessage[]);
    const systemPrompt = await buildSystemPrompt(
      (pageContext || conversation.pageContext) as PageContext | null,
    );

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Stream response from Gemini
    await streamGeminiResponse(
      res, conversationId, geminiContents, systemPrompt,
      (req as AuthRequest).userId,
    );

  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      sendSSE(res, 'error', { message: String(err) });
      res.end();
    }
  }
});

// Recursive streaming handler for multi-turn tool calls
async function streamGeminiResponse(
  res: any,
  conversationId: number,
  contents: any[],
  systemPrompt: string,
  userId?: number,
  depth = 0,
) {
  if (depth > 10) {
    sendSSE(res, 'error', { message: 'Too many tool call rounds' });
    res.end();
    return;
  }

  try {
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: chatToolDeclarations }],
        temperature: 0.4,
      },
    });

    let fullText = '';
    let functionCall: { name: string; args: Record<string, unknown> } | null = null;

    for await (const chunk of stream) {
      if (chunk.candidates?.[0]?.content?.parts) {
        for (const part of chunk.candidates[0].content.parts) {
          if (part.text) {
            fullText += part.text;
            sendSSE(res, 'text_delta', { text: part.text });
          }
          if (part.functionCall) {
            functionCall = {
              name: part.functionCall.name!,
              args: (part.functionCall.args as Record<string, unknown>) || {},
            };
          }
        }
      }
    }

    if (functionCall) {
      const toolName = functionCall.name;
      const toolArgs = functionCall.args;
      const isReadOnly = READ_ONLY_TOOLS.has(toolName);

      if (isReadOnly) {
        // Auto-execute read-only tools
        try {
          const executor = toolExecutors[toolName];
          if (!executor) throw new Error(`Unknown tool: ${toolName}`);
          // Send keepalive while tool executes
          const keepalive = setInterval(() => {
            res.write(': keepalive\n\n');
          }, 5000);
          let result: unknown;
          try {
            result = await executor(toolArgs, { userId });
          } finally {
            clearInterval(keepalive);
          }
          const summary = await generateActionSummary(toolName, toolArgs);

          // Save assistant message with tool call
          await db.insert(chatMessages).values({
            conversationId,
            role: 'assistant',
            content: fullText || null,
            toolCall: functionCall,
            toolResult: { name: toolName, data: result, summary },
          });

          sendSSE(res, 'tool_result', { name: toolName, data: result, summary });

          // Feed result back to Gemini for summarization
          const updatedMessages = await db.select().from(chatMessages)
            .where(eq(chatMessages.conversationId, conversationId))
            .orderBy(chatMessages.createdAt);

          const updatedContents = buildGeminiContents(
            updatedMessages as unknown as ChatMessage[],
          );

          await streamGeminiResponse(
            res, conversationId, updatedContents, systemPrompt, userId, depth + 1,
          );
          return;
        } catch (err: any) {
          if (depth < 2) {
            console.error(`Self-correction retry for ${toolName}:`, err.message);
            // Feed error back to Gemini for self-correction without notifying user
            contents.push({
              role: 'model',
              parts: [{ functionCall: { name: toolName, args: toolArgs } }],
            });
            contents.push({
              role: 'user',
              parts: [{ functionResponse: { name: toolName, response: { error: err.message, advice: 'Please fix the arguments and try again.' } } }],
            });

            await streamGeminiResponse(res, conversationId, contents, systemPrompt, userId, depth + 1);
            return;
          }

          sendSSE(res, 'error', { message: err.message || 'Tool execution failed' });

          // Save error as assistant message
          await db.insert(chatMessages).values({
            conversationId,
            role: 'assistant',
            content: `Error executing ${toolName}: ${err.message}`,
            toolCall: functionCall,
          });
        }
      } else {
        // Mutating tool: propose action, wait for confirmation
        const summary = await generateActionSummary(toolName, toolArgs);

        const [savedMsg] = await db.insert(chatMessages).values({
          conversationId,
          role: 'assistant',
          content: fullText || null,
          toolCall: functionCall,
          actionStatus: 'pending',
        }).returning();

        sendSSE(res, 'action_proposal', {
          messageId: savedMsg.id,
          toolCall: functionCall,
          summary,
        });
      }
    } else if (fullText) {
      // Plain text response
      const [savedMsg] = await db.insert(chatMessages).values({
        conversationId,
        role: 'assistant',
        content: fullText,
      }).returning();

      sendSSE(res, 'done', { messageId: savedMsg.id });
    }

    // Auto-title the conversation on first exchange (non-blocking)
    autoTitleConversation(conversationId).catch((err) => {
      console.error('Auto-title failed:', err.message);
    });

    if (!functionCall) {
      res.end();
    } else if (!READ_ONLY_TOOLS.has(functionCall.name)) {
      // For mutation proposals, end the stream after sending the proposal
      res.end();
    }
  } catch (err: any) {
    sendSSE(res, 'error', { message: err.message || 'Stream error' });
    res.end();
  }
}

// POST /:id/confirm/:msgId - Confirm and execute a pending action
router.post('/:id/confirm/:msgId', async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const msgId = parseInt(req.params.msgId, 10);

    const [msg] = await db.select().from(chatMessages)
      .where(eq(chatMessages.id, msgId));

    if (!msg || msg.conversationId !== conversationId) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    if (msg.actionStatus !== 'pending') {
      res.status(400).json({ error: 'Action is not pending' });
      return;
    }

    const toolCall = msg.toolCall as ChatToolCall;
    if (!toolCall) {
      res.status(400).json({ error: 'No tool call to execute' });
      return;
    }

    // Support overriding arguments from the client before execution
    if (req.body && req.body.args) {
      toolCall.args = { ...toolCall.args, ...req.body.args };
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const executor = toolExecutors[toolCall.name];
      if (!executor) throw new Error(`Unknown tool: ${toolCall.name}`);
      // Keepalive during potentially slow operations (PDF, email)
      const keepalive = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 5000);
      let result: unknown;
      try {
        result = await executor(toolCall.args, { userId: (req as AuthRequest).userId });
      } finally {
        clearInterval(keepalive);
      }
      const summary = await generateActionSummary(toolCall.name, toolCall.args);

      // Update message with result
      await db.update(chatMessages).set({
        actionStatus: 'executed',
        toolResult: { name: toolCall.name, data: result, summary },
      }).where(eq(chatMessages.id, msgId));

      sendSSE(res, 'tool_result', { name: toolCall.name, data: result, summary });

      // Get full conversation and stream AI's follow-up response
      const allMessages = await db.select().from(chatMessages)
        .where(eq(chatMessages.conversationId, conversationId))
        .orderBy(chatMessages.createdAt);

      const [conversation] = await db.select().from(conversations)
        .where(eq(conversations.id, conversationId));

      const geminiContents = buildGeminiContents(allMessages as unknown as ChatMessage[]);
      const systemPrompt = await buildSystemPrompt(conversation?.pageContext as PageContext | null);

      await streamGeminiResponse(
        res, conversationId, geminiContents, systemPrompt,
        (req as AuthRequest).userId,
      );
    } catch (err: any) {
      await db.update(chatMessages).set({ actionStatus: 'rejected' })
        .where(eq(chatMessages.id, msgId));
      sendSSE(res, 'error', { message: err.message || 'Execution failed' });
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      sendSSE(res, 'error', { message: String(err) });
      res.end();
    }
  }
});

// POST /:id/reject/:msgId - Reject a pending action
router.post('/:id/reject/:msgId', async (req, res, next) => {
  try {
    const conversationId = parseInt(req.params.id, 10);
    const msgId = parseInt(req.params.msgId, 10);

    const [msg] = await db.select().from(chatMessages)
      .where(eq(chatMessages.id, msgId));

    if (!msg || msg.conversationId !== conversationId) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    await db.update(chatMessages).set({ actionStatus: 'rejected' })
      .where(eq(chatMessages.id, msgId));

    // Save a system message noting the rejection
    await db.insert(chatMessages).values({
      conversationId,
      role: 'assistant',
      content: 'Action cancelled.',
    });

    res.json({ data: { message: 'Action rejected' } });
  } catch (err) {
    next(err);
  }
});

// POST /upload - Upload file attachment
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { originalname, mimetype, size, buffer } = req.file;

    // For XLSX/XLS files: parse to CSV text so AI can read the content
    const isSpreadsheet = mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      || mimetype === 'application/vnd.ms-excel'
      || originalname.endsWith('.xlsx')
      || originalname.endsWith('.xls');

    if (isSpreadsheet) {
      try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const csvParts: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          if (workbook.SheetNames.length > 1) {
            csvParts.push(`[Sheet: ${sheetName}]\n${csv}`);
          } else {
            csvParts.push(csv);
          }
        }
        const csvText = csvParts.join('\n\n');
        // Store as text/csv data URL so buildGeminiContents sends it as text
        const csvBase64 = Buffer.from(csvText, 'utf-8').toString('base64');
        const dataUrl = `data:text/csv;base64,${csvBase64}`;

        res.json({
          data: {
            name: originalname,
            mimeType: 'text/csv', // Override so Gemini gets it as text
            url: dataUrl,
            size,
            originalMimeType: mimetype,
          },
        });
        return;
      } catch (err: any) {
        console.error('XLSX parse error:', err.message);
        // Fall through to default handling
      }
    }

    // Store as base64 data URL for simplicity
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64}`;

    res.json({
      data: {
        name: originalname,
        mimeType: mimetype,
        url: dataUrl,
        size,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
