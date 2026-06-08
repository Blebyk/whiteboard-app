import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);

  const board = db.prepare(`
    SELECT b.* FROM boards b
    LEFT JOIN board_shares s ON s.boardId = b.id AND s.userId = ?
    WHERE b.id = ? AND (b.userId = ? OR s.userId = ?)
  `).get(user.id, boardId, user.id, user.id);

  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const logs = db.prepare(`
    SELECT * FROM activity_log
    WHERE boardId = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(boardId);

  return NextResponse.json({ logs });
}
