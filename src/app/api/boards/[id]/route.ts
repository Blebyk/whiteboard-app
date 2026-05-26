import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// Defensive table creation
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

/** Returns the board if the user is the owner OR has been shared with. */
function getAccessibleBoard(userId: number, boardId: number) {
  return db
    .prepare(`
      SELECT b.* FROM boards b
      LEFT JOIN board_shares s ON s.boardId = b.id AND s.userId = ?
      WHERE b.id = ? AND (b.userId = ? OR s.userId = ?)
    `)
    .get(userId, boardId, userId, userId) as any;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const board = getAccessibleBoard(user.id, Number(id));
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  return NextResponse.json({ board });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  const board = getAccessibleBoard(user.id, Number(id));
  if (!board) return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });

  // Viewers cannot save
  const isOwner = board.userId === user.id;
  if (!isOwner) {
    const share = db.prepare('SELECT role FROM board_shares WHERE boardId = ? AND userId = ?')
      .get(Number(id), user.id) as any;
    if (!share || share.role !== 'editor') {
      return NextResponse.json({ error: 'Нет прав на редактирование' }, { status: 403 });
    }
  }

  const { name, canvasState, thumbnail, bgStyle } = await request.json().catch(() => ({}));

  const updates: string[] = ["updated_at = datetime('now')", 'updated_by = ?'];
  const values: unknown[] = [user.id];

  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (canvasState !== undefined) { updates.push('canvasState = ?'); values.push(canvasState); }
  if (thumbnail !== undefined) { updates.push('thumbnail = ?'); values.push(thumbnail); }
  if (bgStyle !== undefined) { updates.push('bgStyle = ?'); values.push(bgStyle); }

  values.push(Number(id));

  db.prepare(`UPDATE boards SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT id, updated_at, updated_by FROM boards WHERE id = ?').get(Number(id)) as any;
  return NextResponse.json({ board: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { id } = await params;
  // Only the owner can delete. Shared users can only revoke their own share.
  const owned = db.prepare('SELECT * FROM boards WHERE id = ? AND userId = ?').get(Number(id), user.id);
  if (owned) {
    db.prepare('DELETE FROM boards WHERE id = ?').run(Number(id));
    return NextResponse.json({ success: true });
  }
  // Shared user removing themselves
  const share = db.prepare('SELECT * FROM board_shares WHERE boardId = ? AND userId = ?').get(Number(id), user.id);
  if (share) {
    db.prepare('DELETE FROM board_shares WHERE boardId = ? AND userId = ?').run(Number(id), user.id);
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: 'Доска не найдена' }, { status: 404 });
}
