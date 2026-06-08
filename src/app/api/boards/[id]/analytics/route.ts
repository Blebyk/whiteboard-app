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
  `).get(user.id, boardId, user.id, user.id) as any;

  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const total = (db.prepare('SELECT COUNT(*) as c FROM tasks WHERE boardId = ?')
    .get(boardId) as { c: number }).c;

  const byStatus = db.prepare(
    'SELECT status, COUNT(*) as count FROM tasks WHERE boardId = ? GROUP BY status'
  ).all(boardId) as { status: string; count: number }[];

  const byPriority = db.prepare(
    'SELECT priority, COUNT(*) as count FROM tasks WHERE boardId = ? GROUP BY priority'
  ).all(boardId) as { priority: string; count: number }[];

  const byAssignee = db.prepare(`
    SELECT COALESCE(u.name, 'Не назначено') as name, COUNT(*) as count
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.boardId = ?
    GROUP BY t.assignee_id
    ORDER BY count DESC
  `).all(boardId) as { name: string; count: number }[];

  const overdue = (db.prepare(`
    SELECT COUNT(*) as c FROM tasks
    WHERE boardId = ? AND due_date IS NOT NULL AND due_date < date('now') AND status != 'done'
  `).get(boardId) as { c: number }).c;

  const perDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count
    FROM tasks
    WHERE boardId = ? AND created_at >= date('now', '-6 days')
    GROUP BY day
    ORDER BY day ASC
  `).all(boardId) as { day: string; count: number }[];

  const recentActivity = db.prepare(`
    SELECT * FROM activity_log WHERE boardId = ? ORDER BY created_at DESC LIMIT 10
  `).all(boardId);

  return NextResponse.json({
    total,
    byStatus,
    byPriority,
    byAssignee,
    overdue,
    perDay,
    recentActivity,
    boardName: board.name,
  });
}
