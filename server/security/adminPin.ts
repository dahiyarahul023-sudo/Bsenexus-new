import { createHash, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

export function timingSafePinEqual(left: string, right: string): boolean {
  return timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());
}

export async function verifyAndMigrateAdminPin(pin: string, stored: string | undefined, envPin: string | undefined, saveHash: (hash: string) => Promise<void>): Promise<boolean> {
  if (stored?.startsWith('$2')) {
    try { return await bcrypt.compare(pin, stored); } catch { return false; }
  }
  const expected = stored || envPin?.trim();
  if (!expected || !timingSafePinEqual(pin, expected)) return false;
  // Migration must succeed before granting elevation. Once stored, only the
  // bcrypt branch is used; APP_PIN cannot bypass an existing stored hash.
  await saveHash(await bcrypt.hash(pin, 10));
  return true;
}
