import { randomUUID } from 'crypto';
import db from '@/lib/db';

export interface ObjectChange {
  objectId: string;
  data?: unknown;   // JSON объекта Fabric для upsert
  deleted?: boolean;
}

/**
 * Засеивает по-объектную таблицу из устаревшего цельного `canvasState` ровно
 * один раз на доску. Каждому объекту присваивается стабильный `data.id`, а
 * `canvasState` перезаписывается с этими id, чтобы любой клиент, открывающий
 * доску позже, грузил те же id и инкрементальный дифф работал с первой правки.
 *
 * No-op, если у доски уже есть строки объектов (или нет содержимого для сидинга).
 */
export function ensureBoardObjects(boardId: number): void {
  const { n } = db
    .prepare('SELECT COUNT(*) AS n FROM board_objects WHERE boardId = ?')
    .get(boardId) as { n: number };
  if (n > 0) return;

  const board = db.prepare('SELECT canvasState FROM boards WHERE id = ?').get(boardId) as
    | { canvasState: string | null }
    | undefined;
  if (!board) return;

  let parsed: { objects?: Array<{ data?: Record<string, unknown> }> } | null = null;
  try {
    parsed = board.canvasState ? JSON.parse(board.canvasState) : null;
  } catch {
    parsed = null;
  }
  const objects = parsed?.objects ?? [];
  if (objects.length === 0) return;

  const seed = db.transaction(() => {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO board_objects (boardId, objectId, data, deleted, rev, updated_by) VALUES (?, ?, ?, 0, 0, NULL)'
    );
    for (const obj of objects) {
      if (!obj.data || typeof obj.data !== 'object') obj.data = {};
      if (!obj.data.id) obj.data.id = randomUUID();
      insert.run(boardId, obj.data.id as string, JSON.stringify(obj));
    }
    // Сохраняем id обратно в кэшированный полный снимок.
    db.prepare('UPDATE boards SET canvasState = ? WHERE id = ?').run(
      JSON.stringify(parsed),
      boardId
    );
  });
  seed();
}

/**
 * Применяет пачку изменений объектов от одного клиента, поднимает ревизию доски
 * и пересобирает кэшированный `canvasState`. Возвращает новую ревизию. Стратегия
 * last-writer-wins по объекту: для данного объекта побеждает последний дошедший
 * до сервера пуш.
 */
export function applyObjectChanges(
  boardId: number,
  userId: number,
  changes: ObjectChange[],
  meta: Record<string, unknown> | undefined,
  thumbnail: string | undefined
): number {
  const run = db.transaction(() => {
    const cur = db.prepare('SELECT rev FROM boards WHERE id = ?').get(boardId) as
      | { rev: number }
      | undefined;
    const newRev = (cur?.rev ?? 0) + 1;

    const upsert = db.prepare(`
      INSERT INTO board_objects (boardId, objectId, data, deleted, rev, updated_by)
      VALUES (?, ?, ?, 0, ?, ?)
      ON CONFLICT(boardId, objectId) DO UPDATE SET
        data = excluded.data, deleted = 0, rev = excluded.rev, updated_by = excluded.updated_by
    `);
    const remove = db.prepare(`
      INSERT INTO board_objects (boardId, objectId, data, deleted, rev, updated_by)
      VALUES (?, ?, NULL, 1, ?, ?)
      ON CONFLICT(boardId, objectId) DO UPDATE SET
        data = NULL, deleted = 1, rev = excluded.rev, updated_by = excluded.updated_by
    `);

    for (const ch of changes) {
      if (!ch?.objectId) continue;
      if (ch.deleted) remove.run(boardId, ch.objectId, newRev, userId);
      else upsert.run(boardId, ch.objectId, JSON.stringify(ch.data), newRev, userId);
    }

    // Пересобираем кэшированный полный снимок для первой отрисовки / превью.
    const rows = db
      .prepare('SELECT data FROM board_objects WHERE boardId = ? AND deleted = 0 ORDER BY rowid')
      .all(boardId) as Array<{ data: string }>;
    const objects = rows.map((r) => JSON.parse(r.data));
    const wrapper = { ...(meta ?? {}), objects };

    db.prepare(`
      UPDATE boards
      SET rev = ?, canvasState = ?, thumbnail = COALESCE(?, thumbnail),
          updated_at = datetime('now'), updated_by = ?
      WHERE id = ?
    `).run(newRev, JSON.stringify(wrapper), thumbnail ?? null, userId, boardId);

    return newRev;
  });
  return run();
}
