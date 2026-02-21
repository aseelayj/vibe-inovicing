import dotenv from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env'), override: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_PASSWORD: z.string().default(''),
  JWT_SECRET: z.string().min(1),
  GEMINI_API_KEY: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  FROM_EMAIL: z.string().default('invoices@example.com'),
  SERVER_BASE_URL: z.string().default('http://localhost:3001'),
  PORT: z.coerce.number().default(3001),
});

export const env = envSchema.parse(process.env);
