import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { env } from '../env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte encryption key from ENCRYPTION_KEY or fall back to JWT_SECRET.
 * Using a dedicated ENCRYPTION_KEY is recommended for production.
 */
function getKey(): Buffer {
  const secret = env.ENCRYPTION_KEY || env.JWT_SECRET;
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypt a plaintext string. Returns a hex-encoded string in the format:
 *   iv:authTag:ciphertext
 * Returns null if input is null/undefined/empty.
 */
export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a previously encrypted string.
 * Returns null if input is null/undefined/empty.
 * Returns the input as-is if it doesn't match the encrypted format
 * (for backward compatibility with existing plaintext values).
 */
export function decryptSecret(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;

  // Check if this looks like an encrypted value (iv:authTag:ciphertext)
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    // Likely a legacy plaintext value — return as-is
    return encrypted;
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  // Validate hex lengths
  if (ivHex.length !== IV_LENGTH * 2 || authTagHex.length !== AUTH_TAG_LENGTH * 2) {
    return encrypted; // Not an encrypted value
  }

  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // Decryption failed — might be a legacy plaintext value
    return encrypted;
  }
}

/** Fields in the settings table that contain secrets and should be encrypted. */
export const SECRET_FIELDS = [
  'jofotaraClientSecret',
  'paypalClientSecret',
  'geminiApiKey',
  'resendApiKey',
  'smtpPassword',
] as const;

/**
 * Encrypt all secret fields in a settings payload before writing to DB.
 */
export function encryptSettingsSecrets(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...payload };
  for (const field of SECRET_FIELDS) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encryptSecret(result[field] as string);
    }
  }
  return result;
}

/**
 * Decrypt all secret fields in a settings row read from DB.
 */
export function decryptSettingsSecrets<T extends Record<string, unknown>>(
  row: T,
): T {
  const result = { ...row };
  for (const field of SECRET_FIELDS) {
    if ((result as Record<string, unknown>)[field] && typeof (result as Record<string, unknown>)[field] === 'string') {
      (result as Record<string, unknown>)[field] = decryptSecret(
        (result as Record<string, unknown>)[field] as string,
      );
    }
  }
  return result;
}
