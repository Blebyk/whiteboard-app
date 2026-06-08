import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { publishTaskUpdate } from '@/lib/boardEvents';

function getAccessibleBoard(userId: number, boardId: number) {
  return db.prepare(`
    SELECT b.* FROM boards b
    LEFT JOIN board_shares s ON s.boardId = b.id AND s.userId = ?
    WHERE b.id = ? AND (b.userId = ? OR s.userId = ?)
  `).get(userId, boardId, userId, userId) as any;
}

type Ctx = { params: Promise<{ id: string; taskId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id, taskId } = await params;
  const board = getAccessibleBoard(user.id, Number(id));
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ? AND t.boardId = ?
  `).get(Number(taskId), Number(id));

  if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });

  const comments = db.prepare(`
    SELECT tc.*, u.name as user_name
    FROM task_comments tc
    JOIN users u ON u.id = tc.userId
    WHERE tc.taskId = ?
    ORDER BY tc.created_at ASC
  `).all(Number(taskId));

  return NextResponse.json({ task, comments });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id, taskId } = await params;
  const boardId = Number(id);
  const board = getAccessibleBoard(user.id, boardId);
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND boardId = ?')
    .get(Number(taskId), boardId) as any;
  if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });

  const body = await req.json();
  const { title, description, status, priority, assignee_id, due_date, position } = body;

  const updates: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (title !== undefined) { updates.push('title = ?'); values.push(title.trim()); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description); }
  if (status !== undefined) { updates.push('status = ?'); values.push(status); }
  if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
  if ('assignee_id' in body) { updates.push('assignee_id = ?'); values.push(assignee_id || null); }
  if ('due_date' in body) { updates.push('due_date = ?'); values.push(due_date || null); }
  if (position !== undefined) { updates.push('position = ?'); values.push(position); }

  values.push(Number(taskId));
  db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  if (status !== undefined && status !== task.status) {
    db.prepare(`
      INSERT INTO activity_log (boardId, taskId, userId, userName, action, details)
      VALUES (?, ?, ?, ?, 'task_status_changed', ?)
    `).run(boardId, task.id, user.id, user.name, JSON.stringify({
      title: task.title,
      from: task.status,
      to: status,
    }));
  }

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ?
  `).get(Number(taskId));

  publishTaskUpdate(boardId, user.id);
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id, taskId } = await params;
  const boardId = Number(id);
  const board = getAccessibleBoard(user.id, boardId);
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND boardId = ?')
    .get(Number(taskId), boardId) as any;
  if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(Number(taskId));

  db.prepare(`
    INSERT INTO activity_log (boardId, taskId, userId, userName, action, details)
    VALUES (?, NULL, ?, ?, 'task_deleted', ?)
  `).run(boardId, user.id, user.name, JSON.stringify({ title: task.title }));

  publishTaskUpdate(boardId, user.id);
  return NextResponse.json({ success: true });
}
