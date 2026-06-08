import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { setSelection } from '@/lib/boardPresence';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/boards/[id]/presence — публикует текущее выделение пользователя.
// Сервер кладёт его в presence-запись и рассылает остальным по SSE, чтобы они
// подсветили эти объекты в цвете автора.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const ok = db
    .prepare(`
      SELECT 1 FROM boards b
      LEFT JOIN board_shares s ON s.boardId = b.id AND s.userId = ?
      WHERE b.id = ? AND (b.userId = ? OR s.userId = ?)
    `)
    .get(user.id, boardId, user.id, user.id);
  if (!ok) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const selection = Array.isArray(body?.selection)
    ? body.selection.filter((x: unknown) => typeof x === 'string').slice(0, 100)
    : [];

  setSelection(boardId, user.id, selection);
  return NextResponse.json({ ok: true });
}
