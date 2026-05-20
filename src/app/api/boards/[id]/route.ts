import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

async function getBoard(userId: number, boardId: number) {
  return db.prepare('SELECT * FROM boards WHERE id = ? AND userId = ?').get(boardId, userId) as any;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const board = await getBoard(user.id, Number(id));
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  return NextResponse.json({ board });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const board = await getBoard(user.id, Number(id));
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const { name, canvasState, thumbnail, bgStyle } = await request.json().catch(() => ({}));

  const updates: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (canvasState !== undefined) { updates.push('canvasState = ?'); values.push(canvasState); }
  if (thumbnail !== undefined) { updates.push('thumbnail = ?'); values.push(thumbnail); }
  if (bgStyle !== undefined) { updates.push('bgStyle = ?'); values.push(bgStyle); }

  values.push(Number(id), user.id);

  db.prepare(`UPDATE boards SET ${updates.join(', ')} WHERE id = ? AND userId = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM boards WHERE id = ?').get(Number(id)) as any;
  return NextResponse.json({ board: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const board = await getBoard(user.id, Number(id));
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  db.prepare('DELETE FROM boards WHERE id = ? AND userId = ?').run(Number(id), user.id);
  return NextResponse.json({ success: true });
}
