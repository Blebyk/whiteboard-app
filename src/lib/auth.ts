import { cookies } from 'next/headers';
import db from '@/lib/db';

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;

  const session = db
    .prepare("SELECT * FROM sessions WHERE token = ? AND expiresAt > datetime('now')")
    .get(token) as any;

  if (!session) return null;

  const user = db
    .prepare('SELECT id, name, email FROM users WHERE id = ?')
    .get(session.userId) as any;

  return user || null;
}
