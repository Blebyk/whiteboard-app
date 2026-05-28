import { randomUUID } from 'crypto';
import db from '@/lib/db';

export interface ObjectChange {
  objectId: string;
  data?: unknown;   // fabric object JSON for an upsert
  deleted?: boolean;
}

/**
 * Seed the per-object table from the legacy whole-canvas `canvasState`, exactly
 * once per board. Each object is given a stable `data.id` and `canvasState` is
 * rewritten with those ids, so every client that opens the board afterwards
 * loads the same ids and incremental diffing works from the first edit.
 *
 * No-op when the board already has object rows (or has no content to seed).
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
    // Persist the ids back into the cached full snapshot.
    db.prepare('UPDATE boards SET canvasState = ? WHERE id = ?').run(
      JSON.stringify(parsed),
      boardId
    );
  });
  seed();
}

/**
 * Apply a batch of object changes from one client, bump the board revision and
 * rebuild the cached `canvasState`. Returns the new revision. Per-object
 * last-writer-wins: the last push to reach the server wins for a given object.
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

    // Rebuild the cached full snapshot used for first paint / thumbnails.
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
