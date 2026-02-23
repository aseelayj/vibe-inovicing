import { GoogleGenAI } from '@google/genai';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { env } from '../env.js';
import { decryptSecret } from '../utils/crypto.js';

let cachedKey: string | null = null;
let cachedAt = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getGeminiApiKey(): Promise<string> {
  const now = Date.now();
  if (cachedKey && now - cachedAt < CACHE_TTL) return cachedKey;

  const [row] = await db.select({ geminiApiKey: settings.geminiApiKey })
    .from(settings).limit(1);
  const dbKey = decryptSecret(row?.geminiApiKey);

  cachedKey = dbKey || env.GEMINI_API_KEY;
  cachedAt = now;
  return cachedKey;
}

export async function getGeminiClient(): Promise<GoogleGenAI> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      'Gemini API key not configured. Add it in Settings > Integrations or set GEMINI_API_KEY environment variable.',
    );
  }
  return new GoogleGenAI({ apiKey });
}
