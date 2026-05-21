import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// Defensive: ensure board_shares exists (older DBs / cached HMR singletons
// may not have run the CREATE TABLE statement yet).
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

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

    // Owned boards + boards shared with me. `shared = 1` marks ones I don't own.
    // `ownerName` is only meaningful for shared boards (NULL for own ones).
    const boards = db
      .prepare(`
        SELECT id, name, thumbnail, created_at, updated_at, 0 AS shared, NULL AS ownerName
        FROM boards WHERE userId = ?
        UNION ALL
        SELECT b.id, b.name, b.thumbnail, b.created_at, b.updated_at, 1 AS shared, u.name AS ownerName
        FROM boards b
        INNER JOIN board_shares s ON s.boardId = b.id
        INNER JOIN users u ON u.id = b.userId
        WHERE s.userId = ? AND b.userId != ?
        ORDER BY updated_at DESC
      `)
      .all(user.id, user.id, user.id);

    return NextResponse.json({ boards });
  } catch (err) {
    console.error('GET /api/boards failed:', err);
    return NextResponse.json({ error: 'Ошибка получения досок', boards: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });

  const { name } = await request.json().catch(() => ({}));

  const result = db
    .prepare('INSERT INTO boards (userId, name) VALUES (?, ?)')
    .run(user.id, name || 'Без названия');

  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(result.lastInsertRowid) as any;

  return NextResponse.json({ board }, { status: 201 });
}
