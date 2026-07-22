import { getPool } from './client.js';

export class WaitlistDuplicateError extends Error {
  constructor(email: string) {
    super(`Email already on waitlist: ${email}`);
    this.name = 'WaitlistDuplicateError';
  }
}

export class WaitlistInvalidEmailError extends Error {
  constructor() {
    super('Invalid email address');
    this.name = 'WaitlistInvalidEmailError';
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export async function addToWaitlist(
  email: string,
): Promise<{ created: true; email: string }> {
  const normalized = normalizeEmail(email);

  if (!isValidEmail(normalized)) {
    throw new WaitlistInvalidEmailError();
  }

  const db = await getPool();

  try {
    await db.query(
      'INSERT INTO waitlist (email) VALUES ($1)',
      [normalized],
    );
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      throw new WaitlistDuplicateError(normalized);
    }
    throw error;
  }

  return { created: true, email: normalized };
}
