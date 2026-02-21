import bcrypt from 'bcryptjs';
import { db } from '../db/index.js';
import { users, settings } from '../db/schema.js';
import { env } from '../env.js';
import { count } from 'drizzle-orm';

export async function bootstrapOwner() {
  const [{ value }] = await db.select({ value: count() }).from(users);
  if (value > 0) return;

  if (!env.AUTH_PASSWORD) {
    console.log(
      '[bootstrap] No users exist and AUTH_PASSWORD is not set. '
      + 'Set AUTH_PASSWORD in .env to create the owner account on next start.',
    );
    return;
  }

  // Try to get business email from settings for the owner account
  let email = 'admin@example.com';
  const [settingsRow] = await db.select({
    businessEmail: settings.businessEmail,
  }).from(settings).limit(1);
  if (settingsRow?.businessEmail && settingsRow.businessEmail !== 'hello@example.com') {
    email = settingsRow.businessEmail;
  }

  const passwordHash = await bcrypt.hash(env.AUTH_PASSWORD, 10);
  await db.insert(users).values({
    name: 'Owner',
    email,
    passwordHash,
    role: 'owner',
  });

  console.log(`[bootstrap] Owner account created with email: ${email}`);
  console.log('[bootstrap] Use your AUTH_PASSWORD to log in.');
}
