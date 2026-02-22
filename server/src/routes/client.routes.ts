import { Router } from 'express';
import { eq, or, ilike, desc, count, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, invoices, quotes, activityLog } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { createClientSchema, updateClientSchema } from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// GET / - List clients with optional search and pagination
router.get('/', async (req, res, next) => {
  try {
    const { search, page = '1', pageSize = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, Math.min(100, parseInt(pageSize as string, 10) || 50));
    const offset = (pageNum - 1) * size;

    const conditions = [];
    if (search && typeof search === 'string') {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(clients.name, pattern),
          ilike(clients.email, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ value: count() })
      .from(clients)
      .where(whereClause);

    const total = totalResult?.value ?? 0;

    const result = await db.select().from(clients)
      .where(whereClause)
      .orderBy(desc(clients.createdAt))
      .limit(size)
      .offset(offset);

    res.json({
      data: result,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get single client with invoices and quotes
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const client = await db.query.clients.findFirst({
      where: eq(clients.id, id),
      with: {
        invoices: true,
        quotes: true,
      },
    });

    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    res.json({ data: client });
  } catch (err) {
    next(err);
  }
});

// POST / - Create client
router.post('/', validate(createClientSchema), async (req, res, next) => {
  try {
    const [client] = await db.insert(clients)
      .values(req.body)
      .returning();

    await db.insert(activityLog).values({
      entityType: 'client',
      entityId: client.id,
      action: 'created',
      description: `Client "${client.name}" created`,
      userId: (req as AuthRequest).userId,
    });

    res.status(201).json({ data: client });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update client
router.put('/:id', validate(updateClientSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [updated] = await db.update(clients)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await db.insert(activityLog).values({
      entityType: 'client',
      entityId: updated.id,
      action: 'updated',
      description: `Client "${updated.name}" updated`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete client
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [deleted] = await db.delete(clients)
      .where(eq(clients.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await db.insert(activityLog).values({
      entityType: 'client',
      entityId: deleted.id,
      action: 'deleted',
      description: `Client "${deleted.name}" deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Client deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
