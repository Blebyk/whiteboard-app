import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { ensureBoardObjects, applyObjectChanges, type ObjectChange } from '@/lib/boardSync';
import { publish } from '@/lib/boardEvents';

/** Строка доски, если пользователь владелец или ему её расшарили, иначе undefined. */
function getAccess(userId: number, boardId: number) {
  return db
    .prepare(`
      SELECT b.id, b.userId, b.rev,
             CASE WHEN b.userId = ? THEN 'owner' ELSE s.role END AS role
      FROM boards b
      LEFT JOIN board_shares s ON s.boardId = b.id AND s.userId = ?
      WHERE b.id = ? AND (b.userId = ? OR s.userId = ?)
    `)
    .get(userId, userId, boardId, userId, userId) as
    | { id: number; userId: number; rev: number; role: string }
    | undefined;
}

// GET /api/boards/[id]/sync?since=<rev>
// Возвращает текущую ревизию и все изменения объектов с rev > since.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const board = getAccess(user.id, boardId);
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  ensureBoardObjects(boardId);

  const since = Number(new URL(req.url).searchParams.get('since') ?? 0) || 0;
  const rows = db
    .prepare(`
      SELECT objectId, data, deleted, updated_by
      FROM board_objects
      WHERE boardId = ? AND rev > ?
      ORDER BY rev, rowid
    `)
    .all(boardId, since) as Array<{ objectId: string; data: string | null; deleted: number; updated_by: number | null }>;

  const current = db.prepare('SELECT rev FROM boards WHERE id = ?').get(boardId) as { rev: number };
  const changes = rows.map((r) => ({
    objectId: r.objectId,
    deleted: !!r.deleted,
    data: r.deleted || !r.data ? null : JSON.parse(r.data),
    updated_by: r.updated_by,
  }));

  return NextResponse.json({ rev: current?.rev ?? 0, changes });
}

// POST /api/boards/[id]/sync — пуш пачки изменений объектов (только редакторы).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const board = getAccess(user.id, boardId);
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
  if (board.role !== 'owner' && board.role !== 'editor') {
    return NextResponse.json({ error: 'Нет прав на редактирование' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const changes: ObjectChange[] = Array.isArray(body?.changes) ? body.changes : [];
  const meta = body?.meta && typeof body.meta === 'object' ? body.meta : undefined;
  const thumbnail = typeof body?.thumbnail === 'string' ? body.thumbnail : undefined;

  if (changes.length === 0 && thumbnail === undefined) {
    return NextResponse.json({ rev: board.rev });
  }

  ensureBoardObjects(boardId);
  const rev = applyObjectChanges(boardId, user.id, changes, meta, thumbnail);
  // Мгновенно будим SSE-соединения других клиентов (низкая задержка синка).
  publish(boardId, { rev, by: user.id });
  return NextResponse.json({ rev });
}
