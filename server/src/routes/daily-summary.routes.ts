import { Router } from 'express';
import { eq, and, gte, lt, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { activityLog, users } from '../db/schema.js';
import { generateDailySummary } from '../services/ai.service.js';
import type { DailyUserSummary } from '@vibe/shared';

const router = Router();

// GET / - Get daily activity summary grouped by user
router.get('/', async (req, res, next) => {
  try {
    const dateStr = (req.query.date as string)
      || new Date().toISOString().split('T')[0];
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999`);

    const activities = await db.select({
      id: activityLog.id,
      entityType: activityLog.entityType,
      entityId: activityLog.entityId,
      action: activityLog.action,
      description: activityLog.description,
      userId: activityLog.userId,
      createdAt: activityLog.createdAt,
      userName: users.name,
      userRole: users.role,
    })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.userId, users.id))
      .where(and(
        gte(activityLog.createdAt, dayStart),
        lt(activityLog.createdAt, dayEnd),
      ))
      .orderBy(desc(activityLog.createdAt));

    // Group by user
    const userMap = new Map<number | null, DailyUserSummary>();

    for (const a of activities) {
      const key = a.userId;
      if (!userMap.has(key)) {
        userMap.set(key, {
          userId: a.userId ?? 0,
          userName: a.userName ?? 'System',
          userRole: (a.userRole as 'owner' | 'accountant') ?? 'accountant',
          activityCount: 0,
          stats: {
            invoicesCreated: 0,
            paymentsRecorded: 0,
            clientsAdded: 0,
            quotesCreated: 0,
            otherActions: 0,
          },
          activities: [],
        });
      }

      const group = userMap.get(key)!;
      group.activityCount++;
      group.activities.push({
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        action: a.action,
        description: a.description,
        userId: a.userId,
        createdAt: (a.createdAt as unknown as Date).toISOString(),
      });

      if (a.entityType === 'invoice' && a.action === 'created') {
        group.stats.invoicesCreated++;
      } else if (a.entityType === 'payment' && a.action === 'created') {
        group.stats.paymentsRecorded++;
      } else if (a.entityType === 'client' && a.action === 'created') {
        group.stats.clientsAdded++;
      } else if (a.entityType === 'quote' && a.action === 'created') {
        group.stats.quotesCreated++;
      } else {
        group.stats.otherActions++;
      }
    }

    res.json({
      data: {
        date: dateStr,
        totalActivities: activities.length,
        users: Array.from(userMap.values()),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /ai-summary - AI-generated summary for a date
router.get('/ai-summary', async (req, res, next) => {
  try {
    const dateStr = (req.query.date as string)
      || new Date().toISOString().split('T')[0];
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999`);

    const activities = await db.select({
      description: activityLog.description,
      action: activityLog.action,
      entityType: activityLog.entityType,
      userName: users.name,
      createdAt: activityLog.createdAt,
    })
      .from(activityLog)
      .leftJoin(users, eq(activityLog.userId, users.id))
      .where(and(
        gte(activityLog.createdAt, dayStart),
        lt(activityLog.createdAt, dayEnd),
      ))
      .orderBy(activityLog.createdAt);

    if (activities.length === 0) {
      res.json({
        data: {
          date: dateStr,
          summary: 'No activity recorded for this date.',
          userSummaries: [],
        },
      });
      return;
    }

    const summary = await generateDailySummary(dateStr, activities);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

export default router;
