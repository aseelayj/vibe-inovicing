import { Router } from 'express';
import { eq, desc, ilike, and, or, count, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { products } from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import { createProductSchema, updateProductSchema } from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';

const router = Router();

// GET / - List products with optional search and filter
router.get('/', async (req, res, next) => {
  try {
    const { search, category, type, active } = req.query;
    const conditions = [];

    if (active !== 'all') {
      conditions.push(eq(products.isActive, active !== 'false'));
    }

    if (type && typeof type === 'string') {
      conditions.push(eq(products.type, type));
    }

    if (category && typeof category === 'string') {
      conditions.push(eq(products.category, category));
    }

    if (search && typeof search === 'string') {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(products.name, pattern),
          ilike(products.description, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.updatedAt));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /categories - List distinct categories
router.get('/categories', async (req, res, next) => {
  try {
    const result = await db.execute(
      sql`SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category`,
    );
    const categories = (result.rows as any[]).map((r) => r.category);
    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get single product
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

// POST / - Create product
router.post('/', validate(createProductSchema), async (req, res, next) => {
  try {
    const { unitPrice, ...rest } = req.body;

    const [product] = await db.insert(products).values({
      ...rest,
      unitPrice: String(unitPrice),
    }).returning();

    res.status(201).json({ data: product });
  } catch (err) {
    next(err);
  }
});

// PUT /:id - Update product
router.put('/:id', validate(updateProductSchema), async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const { unitPrice, ...rest } = req.body;
    const updateData: Record<string, unknown> = {
      ...rest,
      updatedAt: new Date(),
    };

    if (unitPrice !== undefined) {
      updateData.unitPrice = String(unitPrice);
    }

    const [updated] = await db.update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id - Delete product
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [deleted] = await db.delete(products)
      .where(eq(products.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ data: { message: 'Product deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
