import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
  }

  const session = db
    .prepare("SELECT * FROM sessions WHERE token = ? AND expiresAt > datetime('now')")
    .get(token) as any;

  if (!session) {
    return NextResponse.json({ error: 'Сессия истекла' }, { status: 401 });
  }

  const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(session.userId) as any;

  if (!user) {
    return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
  }

  return NextResponse.json({ user });
}
