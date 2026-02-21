import type { Express } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import authRoutes from './auth.routes.js';
import clientRoutes from './client.routes.js';
import invoiceRoutes from './invoice.routes.js';
import quoteRoutes from './quote.routes.js';
import paymentRoutes from './payment.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import settingsRoutes from './settings.routes.js';
import recurringRoutes from './recurring.routes.js';
import aiRoutes from './ai.routes.js';

export function mountRoutes(app: Express) {
  app.use('/api/auth', authRoutes);
  app.use('/api/clients', authMiddleware, clientRoutes);
  app.use('/api/invoices', authMiddleware, invoiceRoutes);
  app.use('/api/quotes', authMiddleware, quoteRoutes);
  app.use('/api/payments', authMiddleware, paymentRoutes);
  app.use('/api/dashboard', authMiddleware, dashboardRoutes);
  app.use('/api/settings', authMiddleware, settingsRoutes);
  app.use('/api/recurring', authMiddleware, recurringRoutes);
  app.use('/api/ai', authMiddleware, aiRoutes);
}
