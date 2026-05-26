import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// GET /api/boards/[id]/sync
// Lightweight endpoint for polling: returns only updated_at and updated_by (no canvas state).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);

  const row = db.prepare(`
    SELECT b.updated_at, b.updated_by
    FROM boards b
    LEFT JOIN board_shares s ON s.boardId = b.id AND s.userId = ?
    WHERE b.id = ? AND (b.userId = ? OR s.userId = ?)
  `).get(user.id, boardId, user.id, user.id) as any;

  if (!row) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  return NextResponse.json({ updated_at: row.updated_at, updated_by: row.updated_by ?? null });
}
