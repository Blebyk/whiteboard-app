import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const boards = db
    .prepare('SELECT id, name, thumbnail, created_at, updated_at FROM boards WHERE userId = ? ORDER BY updated_at DESC')
    .all(user.id);

  return NextResponse.json({ boards });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { name } = await request.json().catch(() => ({}));

  const result = db
    .prepare('INSERT INTO boards (userId, name) VALUES (?, ?)')
    .run(user.id, name || 'Без названия');

  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(result.lastInsertRowid) as any;

  return NextResponse.json({ board }, { status: 201 });
}
