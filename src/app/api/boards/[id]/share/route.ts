import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

db.exec(`
  CREATE TABLE IF NOT EXISTS board_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boardId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boardId) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(boardId, userId)
  );
`);

function ensureOwner(boardId: number, userId: number) {
  return db
    .prepare('SELECT * FROM boards WHERE id = ? AND userId = ?')
    .get(boardId, userId) as any;
}

// POST /api/boards/[id]/share  тело: { email, role? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  if (!ensureOwner(boardId, me.id))
    return NextResponse.json({ error: 'Только владелец может делиться доской' }, { status: 403 });

  const { email, role = 'editor' } = await request.json().catch(() => ({}));
  if (!email || typeof email !== 'string')
    return NextResponse.json({ error: 'Укажите email' }, { status: 400 });
  if (role !== 'viewer' && role !== 'editor')
    return NextResponse.json({ error: 'Роль должна быть viewer или editor' }, { status: 400 });

  const normalised = email.trim().toLowerCase();
  if (normalised === me.email.toLowerCase())
    return NextResponse.json({ error: 'Нельзя поделиться с самим собой' }, { status: 400 });

  const target = db
    .prepare('SELECT id, name, email FROM users WHERE LOWER(email) = ?')
    .get(normalised) as any;
  if (!target)
    return NextResponse.json({ error: 'Пользователь с таким email не найден' }, { status: 404 });

  db.prepare(`
    INSERT INTO board_shares (boardId, userId, role) VALUES (?, ?, ?)
    ON CONFLICT(boardId, userId) DO UPDATE SET role = excluded.role
  `).run(boardId, target.id, role);

  return NextResponse.json({ success: true, user: { id: target.id, name: target.name, email: target.email, role } });
}

// GET /api/boards/[id]/share
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  if (!ensureOwner(boardId, me.id))
    return NextResponse.json({ error: 'Только владелец видит список' }, { status: 403 });

  const users = db.prepare(`
    SELECT u.id, u.name, u.email, s.role, s.created_at
    FROM board_shares s
    INNER JOIN users u ON u.id = s.userId
    WHERE s.boardId = ?
    ORDER BY s.created_at DESC
  `).all(boardId);

  return NextResponse.json({ users });
}

// PATCH /api/boards/[id]/share  тело: { userId, role }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  if (!ensureOwner(boardId, me.id))
    return NextResponse.json({ error: 'Только владелец может менять роли' }, { status: 403 });

  const { userId, role } = await request.json().catch(() => ({}));
  if (!userId) return NextResponse.json({ error: 'Укажите userId' }, { status: 400 });
  if (role !== 'viewer' && role !== 'editor')
    return NextResponse.json({ error: 'Роль должна быть viewer или editor' }, { status: 400 });

  db.prepare('UPDATE board_shares SET role = ? WHERE boardId = ? AND userId = ?')
    .run(role, boardId, userId);

  return NextResponse.json({ success: true });
}

// DELETE /api/boards/[id]/share?userId=N
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  if (!ensureOwner(boardId, me.id))
    return NextResponse.json({ error: 'Только владелец может убрать доступ' }, { status: 403 });

  const userId = Number(request.nextUrl.searchParams.get('userId'));
  if (!userId) return NextResponse.json({ error: 'Укажите userId' }, { status: 400 });

  db.prepare('DELETE FROM board_shares WHERE boardId = ? AND userId = ?').run(boardId, userId);
  return NextResponse.json({ success: true });
}
