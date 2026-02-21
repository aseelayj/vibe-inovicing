import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env.js';
import { errorHandler } from './middleware/error-handler.js';
import { mountRoutes } from './routes/index.js';
import { startRecurringScheduler } from './services/recurring.service.js';
import { bootstrapOwner } from './services/bootstrap.service.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

mountRoutes(app);

app.use(errorHandler);

bootstrapOwner()
  .then(() => {
    app.listen(env.PORT, () => {
      console.log(`Server running on http://localhost:${env.PORT}`);
      startRecurringScheduler();
    });
  })
  .catch((err) => {
    console.error('[bootstrap] Failed:', err);
    process.exit(1);
  });
