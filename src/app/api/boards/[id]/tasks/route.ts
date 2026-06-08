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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const board = getAccessibleBoard(user.id, boardId);
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const tasks = db.prepare(`
    SELECT t.*,
           u.name as assignee_name,
           c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.boardId = ?
    ORDER BY t.position ASC, t.created_at ASC
  `).all(boardId);

  const members = db.prepare(`
    SELECT u.id, u.name, u.email FROM users u WHERE u.id = ?
    UNION
    SELECT u.id, u.name, u.email FROM users u
    JOIN board_shares s ON s.userId = u.id WHERE s.boardId = ?
  `).all(board.userId, boardId);

  return NextResponse.json({ tasks, members });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const board = getAccessibleBoard(user.id, boardId);
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  const { title, description, status, priority, assignee_id, due_date } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Название обязательно' }, { status: 400 });

  const col = status || 'todo';
  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) as maxPos FROM tasks WHERE boardId = ? AND status = ?'
  ).get(boardId, col) as { maxPos: number };

  const result = db.prepare(`
    INSERT INTO tasks (boardId, title, description, status, priority, assignee_id, due_date, created_by, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    boardId,
    title.trim(),
    description || '',
    col,
    priority || 'medium',
    assignee_id || null,
    due_date || null,
    user.id,
    maxPos.maxPos + 1,
  );

  db.prepare(`
    INSERT INTO activity_log (boardId, taskId, userId, userName, action, details)
    VALUES (?, ?, ?, ?, 'task_created', ?)
  `).run(boardId, result.lastInsertRowid, user.id, user.name, JSON.stringify({ title: title.trim() }));

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  publishTaskUpdate(boardId, user.id);
  return NextResponse.json({ task }, { status: 201 });
}
