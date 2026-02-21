import { Router } from 'express';
import { eq, or, ilike, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { clients, invoices, quotes, activityLog } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { createClientSchema, updateClientSchema } from '@vibe/shared';

const router = Router();

// GET / - List all clients (with optional ?search)
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;

    let query = db.select().from(clients).orderBy(desc(clients.createdAt));

    if (search && typeof search === 'string') {
      const pattern = `%${search}%`;
      query = query.where(
        or(
          ilike(clients.name, pattern),
          ilike(clients.email, pattern),
        ),
      ) as typeof query;
    }

    const result = await query;
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get single client with invoices and quotes
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

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
    });

    res.status(201).json({ data: client });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update client
router.put('/:id', validate(updateClientSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

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
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete client
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

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
    });

    res.json({ data: { message: 'Client deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
