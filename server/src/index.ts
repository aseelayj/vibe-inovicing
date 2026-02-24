import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import { errorHandler } from './middleware/error-handler.js';
import { mountRoutes } from './routes/index.js';
import { startRecurringScheduler } from './services/recurring.service.js';
import { startReminderScheduler } from './services/reminder.service.js';
import { bootstrapOwner } from './services/bootstrap.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const app = express();

app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  } : false,
}));
app.use(cors({
  origin: isProduction
    ? (process.env.CORS_ORIGIN || true)
    : 'http://localhost:5173',
}));
app.use(express.json({ limit: '10mb' }));

mountRoutes(app);

// In production, serve the client build
if (isProduction) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use(errorHandler);

bootstrapOwner()
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
      startRecurringScheduler();
      startReminderScheduler();
    });
  })
  .catch((err) => {
    console.error('[bootstrap] Failed:', err);
    process.exit(1);
  });
