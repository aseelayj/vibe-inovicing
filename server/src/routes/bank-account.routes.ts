import { Router } from 'express';
import { eq, desc, sum, sql, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bankAccounts,
  bankSessions,
  transactions,
  activityLog,
  settings,
} from '../db/schema.js';
import { validate } from '../middleware/validate.js';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  syncBankAccountSchema,
} from '@vibe/shared';
import { parseId } from '../utils/parse-id.js';
import { type AuthRequest } from '../middleware/auth.middleware.js';
import {
  getPayPalAccessToken,
  fetchPayPalTransactions,
  mapPayPalTransactionToLocal,
} from '../services/paypal.service.js';

const router = Router();

// Helper: recalculate bank account balance
async function recalculateBalance(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  accountId: number,
) {
  const [account] = await tx.select().from(bankAccounts)
    .where(eq(bankAccounts.id, accountId));

  if (!account) return;

  const [incomeResult] = await tx
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(sql`${transactions.bankAccountId} = ${accountId} AND ${transactions.type} = 'income'`);

  const [expenseResult] = await tx
    .select({ total: sum(transactions.amount) })
    .from(transactions)
    .where(sql`${transactions.bankAccountId} = ${accountId} AND ${transactions.type} = 'expense'`);

  const income = parseFloat(incomeResult?.total ?? '0');
  const expenses = parseFloat(expenseResult?.total ?? '0');
  const initialBalance = parseFloat(account.initialBalance);
  const currentBalance = initialBalance + income - expenses;

  await tx.update(bankAccounts)
    .set({
      currentBalance: String(currentBalance.toFixed(2)),
      updatedAt: new Date(),
    })
    .where(eq(bankAccounts.id, accountId));
}

// Helper: get PayPal config from settings
async function getPayPalConfig() {
  const [s] = await db.select().from(settings);
  if (!s?.paypalEnabled || !s.paypalClientId || !s.paypalClientSecret) {
    throw new Error(
      'PayPal is not configured. Go to Settings to add your PayPal API credentials.',
    );
  }
  return {
    clientId: s.paypalClientId,
    clientSecret: s.paypalClientSecret,
    environment: (s.paypalEnvironment || 'sandbox') as 'sandbox' | 'live',
  };
}

// Helper: get or refresh PayPal token for an account
async function getPayPalTokenForAccount(accountId: number) {
  const config = await getPayPalConfig();

  // Check for cached token
  const [session] = await db.select().from(bankSessions)
    .where(and(
      eq(bankSessions.bankAccountId, accountId),
      eq(bankSessions.provider, 'paypal'),
    ));

  if (session && new Date(session.expiresAt) > new Date()) {
    return { accessToken: session.token, environment: config.environment };
  }

  // Refresh token
  const { accessToken, expiresIn } = await getPayPalAccessToken(
    config.clientId, config.clientSecret, config.environment,
  );

  // Upsert session
  if (session) {
    await db.update(bankSessions).set({
      token: accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    }).where(eq(bankSessions.id, session.id));
  } else {
    await db.insert(bankSessions).values({
      bankAccountId: accountId,
      provider: 'paypal',
      token: accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      metadata: { environment: config.environment },
    });
  }

  return { accessToken, environment: config.environment };
}

// GET / - List all bank accounts
router.get('/', async (req, res, next) => {
  try {
    const activeOnly = req.query.active === 'true';
    const conditions = activeOnly
      ? eq(bankAccounts.isActive, true)
      : undefined;

    const result = await db.select().from(bankAccounts)
      .where(conditions)
      .orderBy(desc(bankAccounts.createdAt));

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// GET /:id - Get bank account with transactions
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const result = await db.query.bankAccounts.findFirst({
      where: eq(bankAccounts.id, id),
      with: {
        transactions: {
          orderBy: [desc(transactions.date)],
        },
      },
    });

    if (!result) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST / - Create bank account
router.post(
  '/',
  validate(createBankAccountSchema),
  async (req, res, next) => {
    try {
      const {
        name, bankName, accountNumber, currency,
        initialBalance, isActive, notes, provider,
      } = req.body;

      const [account] = await db.insert(bankAccounts).values({
        name,
        bankName,
        accountNumber,
        currency,
        initialBalance: String(initialBalance ?? 0),
        currentBalance: String(initialBalance ?? 0),
        isActive,
        notes,
        provider: provider || 'manual',
      }).returning();

      await db.insert(activityLog).values({
        entityType: 'bank_account',
        entityId: account.id,
        action: 'created',
        description: `Bank account "${name}" created`,
        userId: (req as AuthRequest).userId,
      });

      res.status(201).json({ data: account });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /:id - Update bank account
router.put(
  '/:id',
  validate(updateBankAccountSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;
      const [existing] = await db.select().from(bankAccounts)
        .where(eq(bankAccounts.id, id));

      if (!existing) {
        res.status(404).json({ error: 'Bank account not found' });
        return;
      }

      const updates: Record<string, unknown> = {
        ...req.body,
        updatedAt: new Date(),
      };

      if (req.body.initialBalance !== undefined) {
        updates.initialBalance = String(req.body.initialBalance);
        delete updates.currentBalance;
      }

      const result = await db.transaction(async (tx) => {
        const [account] = await tx.update(bankAccounts)
          .set(updates as any)
          .where(eq(bankAccounts.id, id))
          .returning();

        // Recalculate if initialBalance changed
        if (req.body.initialBalance !== undefined) {
          await recalculateBalance(tx, id);
        }

        // Re-fetch after recalculation
        const [updated] = await tx.select().from(bankAccounts)
          .where(eq(bankAccounts.id, id));
        return updated;
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /:id - Delete bank account (cascade deletes transactions)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;
    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, id));

    if (!account) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));

    await db.insert(activityLog).values({
      entityType: 'bank_account',
      entityId: id,
      action: 'deleted',
      description: `Bank account "${account.name}" deleted`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Bank account deleted' } });
  } catch (err) {
    next(err);
  }
});

// POST /:id/connect-paypal - Link this account as a PayPal account
router.post('/:id/connect-paypal', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, id));

    if (!account) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    // Validate PayPal is configured in settings
    const config = await getPayPalConfig();

    // Validate credentials by fetching a token
    const { accessToken, expiresIn } = await getPayPalAccessToken(
      config.clientId, config.clientSecret, config.environment,
    );

    // Update account provider
    await db.update(bankAccounts).set({
      provider: 'paypal',
      updatedAt: new Date(),
    }).where(eq(bankAccounts.id, id));

    // Delete any existing sessions for this account
    await db.delete(bankSessions).where(
      eq(bankSessions.bankAccountId, id),
    );

    // Cache the token
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    await db.insert(bankSessions).values({
      bankAccountId: id,
      provider: 'paypal',
      token: accessToken,
      expiresAt,
      metadata: { environment: config.environment },
    });

    await db.insert(activityLog).values({
      entityType: 'bank_account',
      entityId: id,
      action: 'paypal_connected',
      description: `PayPal connected to "${account.name}" (${config.environment})`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'PayPal connected successfully' } });
  } catch (err: any) {
    if (err?.message?.includes('PayPal auth failed')) {
      res.status(400).json({
        error: 'Invalid PayPal credentials. Check your settings.',
      });
      return;
    }
    if (err?.message?.includes('not configured')) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// POST /:id/disconnect - Disconnect provider from bank account
router.post('/:id/disconnect', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, id));

    if (!account) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    if (account.provider === 'manual') {
      res.status(400).json({ error: 'Account has no provider to disconnect' });
      return;
    }

    await db.update(bankAccounts).set({
      provider: 'manual',
      updatedAt: new Date(),
    }).where(eq(bankAccounts.id, id));

    // Delete related sessions
    await db.delete(bankSessions).where(
      eq(bankSessions.bankAccountId, id),
    );

    await db.insert(activityLog).values({
      entityType: 'bank_account',
      entityId: id,
      action: 'provider_disconnected',
      description: `Provider disconnected from "${account.name}"`,
      userId: (req as AuthRequest).userId,
    });

    res.json({ data: { message: 'Provider disconnected' } });
  } catch (err) {
    next(err);
  }
});

// POST /:id/sync - Sync transactions from provider
router.post(
  '/:id/sync',
  validate(syncBankAccountSchema),
  async (req, res, next) => {
    try {
      const id = parseId(req, res);
      if (id === null) return;

      const [account] = await db.select().from(bankAccounts)
        .where(eq(bankAccounts.id, id));

      if (!account) {
        res.status(404).json({ error: 'Bank account not found' });
        return;
      }

      if (account.provider === 'manual') {
        res.status(400).json({ error: 'Manual accounts cannot be synced' });
        return;
      }

      const { fromDate, toDate } = req.body;

      // Mark as syncing
      await db.update(bankAccounts).set({
        lastSyncStatus: 'syncing',
        updatedAt: new Date(),
      }).where(eq(bankAccounts.id, id));

      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      try {
        if (account.provider === 'paypal') {
          const { accessToken, environment } =
            await getPayPalTokenForAccount(id);
          const paypalTxns = await fetchPayPalTransactions(
            accessToken, environment, fromDate, toDate,
          );

          for (const txn of paypalTxns) {
            const mapped = mapPayPalTransactionToLocal(txn);
            if (!mapped) {
              skipped++;
              continue;
            }

            // Dedup by bankReference
            const [existing] = await db.select({ id: transactions.id })
              .from(transactions)
              .where(and(
                eq(transactions.bankAccountId, id),
                eq(transactions.bankReference, mapped.bankReference),
              ));

            if (existing) {
              skipped++;
              continue;
            }

            await db.insert(transactions).values({
              bankAccountId: id,
              type: mapped.type,
              category: mapped.category,
              amount: String(mapped.amount),
              date: mapped.date,
              description: mapped.description,
              notes: mapped.notes,
              bankReference: mapped.bankReference,
              supplierName: mapped.supplierName,
              isFromBank: true,
              bankSyncedAt: mapped.bankSyncedAt,
            });
            imported++;
          }
        }

        // Recalculate balance
        await db.transaction(async (tx) => {
          await recalculateBalance(tx, id);
        });

        // Update sync status
        await db.update(bankAccounts).set({
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          updatedAt: new Date(),
        }).where(eq(bankAccounts.id, id));

      } catch (syncErr: any) {
        errors.push(syncErr.message);
        await db.update(bankAccounts).set({
          lastSyncStatus: 'failed',
          updatedAt: new Date(),
        }).where(eq(bankAccounts.id, id));
      }

      await db.insert(activityLog).values({
        entityType: 'bank_account',
        entityId: id,
        action: 'synced',
        description: `Synced ${imported} transactions (${skipped} skipped)`,
        metadata: { imported, skipped, errors, fromDate, toDate },
        userId: (req as AuthRequest).userId,
      });

      res.json({ data: { imported, skipped, errors, bankAccountId: id } });
    } catch (err) {
      next(err);
    }
  },
);

// GET /:id/sync-status - Get sync status for a bank account
router.get('/:id/sync-status', async (req, res, next) => {
  try {
    const id = parseId(req, res);
    if (id === null) return;

    const [account] = await db.select().from(bankAccounts)
      .where(eq(bankAccounts.id, id));

    if (!account) {
      res.status(404).json({ error: 'Bank account not found' });
      return;
    }

    const [session] = await db.select().from(bankSessions)
      .where(eq(bankSessions.bankAccountId, id));

    const sessionActive = session
      ? new Date(session.expiresAt) > new Date()
      : false;

    res.json({
      data: {
        connected: account.provider !== 'manual',
        provider: account.provider,
        sessionActive,
        lastSyncAt: account.lastSyncAt,
        lastSyncStatus: account.lastSyncStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

export { recalculateBalance };
export default router;
