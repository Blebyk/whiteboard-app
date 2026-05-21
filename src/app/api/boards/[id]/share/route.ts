import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// Defensive table creation (in case the singleton DB module was cached
// before this table was added to lib/db.ts).
db.exec(`
  CREATE TABLE IF NOT EXISTS board_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    boardId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (boardId) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(boardId, userId)
  );
`);

/**
 * POST /api/boards/[id]/share  body: { email }
 *   Grants the user with the given email access to this board.
 *   Only the board owner can share.
 *
 * GET  /api/boards/[id]/share
 *   Lists users currently sharing this board.
 *
 * DELETE /api/boards/[id]/share?userId=N
 *   Revoke a specific user's access. Owner only.
 */

function ensureOwner(boardId: number, userId: number) {
  return db
    .prepare('SELECT * FROM boards WHERE id = ? AND userId = ?')
    .get(boardId, userId) as any;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const board = ensureOwner(boardId, me.id);
  if (!board) return NextResponse.json({ error: 'Только владелец может делиться доской' }, { status: 403 });

  const { email } = await request.json().catch(() => ({}));
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Укажите email' }, { status: 400 });
  }

  const normalised = email.trim().toLowerCase();
  if (normalised === me.email.toLowerCase()) {
    return NextResponse.json({ error: 'Нельзя поделиться с самим собой' }, { status: 400 });
  }

  const target = db
    .prepare('SELECT id, name, email FROM users WHERE LOWER(email) = ?')
    .get(normalised) as any;

  if (!target) {
    return NextResponse.json({ error: 'Пользователь с таким email не найден' }, { status: 404 });
  }

  // Insert-or-ignore (UNIQUE(boardId, userId) prevents duplicates)
  db.prepare('INSERT OR IGNORE INTO board_shares (boardId, userId) VALUES (?, ?)')
    .run(boardId, target.id);

  return NextResponse.json({
    success: true,
    user: { id: target.id, name: target.name, email: target.email },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const board = ensureOwner(boardId, me.id);
  if (!board) return NextResponse.json({ error: 'Только владелец видит список' }, { status: 403 });

  const users = db
    .prepare(`
      SELECT u.id, u.name, u.email, s.created_at
      FROM board_shares s
      INNER JOIN users u ON u.id = s.userId
      WHERE s.boardId = ?
      ORDER BY s.created_at DESC
    `)
    .all(boardId);

  return NextResponse.json({ users });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const boardId = Number(id);
  const board = ensureOwner(boardId, me.id);
  if (!board) return NextResponse.json({ error: 'Только владелец может убрать доступ' }, { status: 403 });

  const userId = Number(request.nextUrl.searchParams.get('userId'));
  if (!userId) return NextResponse.json({ error: 'Укажите userId' }, { status: 400 });

  db.prepare('DELETE FROM board_shares WHERE boardId = ? AND userId = ?').run(boardId, userId);
  return NextResponse.json({ success: true });
}
