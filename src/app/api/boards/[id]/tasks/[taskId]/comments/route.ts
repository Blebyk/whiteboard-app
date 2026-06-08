import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string; taskId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { taskId } = await params;

  const comments = db.prepare(`
    SELECT tc.*, u.name as user_name
    FROM task_comments tc
    JOIN users u ON u.id = tc.userId
    WHERE tc.taskId = ?
    ORDER BY tc.created_at ASC
  `).all(Number(taskId));

  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id, taskId } = await params;
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Текст обязателен' }, { status: 400 });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND boardId = ?')
    .get(Number(taskId), Number(id)) as any;
  if (!task) return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });

  const result = db.prepare(
    'INSERT INTO task_comments (taskId, userId, content) VALUES (?, ?, ?)'
  ).run(Number(taskId), user.id, content.trim());

  db.prepare(`
    INSERT INTO activity_log (boardId, taskId, userId, userName, action, details)
    VALUES (?, ?, ?, ?, 'comment_added', ?)
  `).run(Number(id), Number(taskId), user.id, user.name, JSON.stringify({ title: task.title }));

  const comment = db.prepare(`
    SELECT tc.*, u.name as user_name
    FROM task_comments tc
    JOIN users u ON u.id = tc.userId
    WHERE tc.id = ?
  `).get(result.lastInsertRowid);

  return NextResponse.json({ comment }, { status: 201 });
}
