import Database from 'better-sqlite3';
import path from 'path';

// DB file location is configurable so it can live on a mounted volume in
// production (e.g. Railway Volume → DB_PATH=/data/whiteboard.db). Falls back to
// the project directory for local dev.
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'whiteboard.db');

// Open the connection and run idempotent migrations. Called lazily at runtime —
// never during `next build` (see below).
function init(): Database.Database {
  const db = new Database(dbPath);

  // WAL = better concurrent reads; busy_timeout avoids transient SQLITE_BUSY.
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 10000');

  // Create all tables if they don't exist yet (safe to run on every boot)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      emailVerified INTEGER DEFAULT 0,
      verificationToken TEXT,
      tokenExpiry DATETIME,
      resetToken TEXT,
      resetTokenExpiry DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expiresAt DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT 'Без названия',
      canvasState TEXT,
      thumbnail TEXT,
      bgStyle TEXT NOT NULL DEFAULT 'dots',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

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

  // ── Migrations for existing DBs (idempotent) ──────────────────
  const boardCols = (db.pragma('table_info(boards)') as { name: string }[]).map((c) => c.name);
  if (!boardCols.includes('bgStyle')) {
    db.exec("ALTER TABLE boards ADD COLUMN bgStyle TEXT NOT NULL DEFAULT 'dots'");
  }
  if (!boardCols.includes('updated_by')) {
    db.exec('ALTER TABLE boards ADD COLUMN updated_by INTEGER');
  }
  // `rev` = per-board monotonic revision counter used as the sync cursor.
  if (!boardCols.includes('rev')) {
    db.exec('ALTER TABLE boards ADD COLUMN rev INTEGER NOT NULL DEFAULT 0');
  }

  const userCols = (db.pragma('table_info(users)') as { name: string }[]).map((c) => c.name);
  if (!userCols.includes('resetToken')) db.exec('ALTER TABLE users ADD COLUMN resetToken TEXT');
  if (!userCols.includes('resetTokenExpiry')) db.exec('ALTER TABLE users ADD COLUMN resetTokenExpiry DATETIME');

  const sharesCols = (db.pragma('table_info(board_shares)') as { name: string }[]).map((c) => c.name);
  if (!sharesCols.includes('role')) {
    db.exec("ALTER TABLE board_shares ADD COLUMN role TEXT NOT NULL DEFAULT 'editor'");
  }

  // One row per canvas object. `data` is the fabric JSON (NULL when deleted —
  // kept as a tombstone so peers learn about removals). Every change stamps the
  // board's new `rev`, letting clients pull only what changed since they last saw.
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_objects (
      boardId    INTEGER NOT NULL,
      objectId   TEXT NOT NULL,
      data       TEXT,
      deleted    INTEGER NOT NULL DEFAULT 0,
      rev        INTEGER NOT NULL DEFAULT 0,
      updated_by INTEGER,
      PRIMARY KEY (boardId, objectId),
      FOREIGN KEY (boardId) REFERENCES boards(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_board_objects_rev ON board_objects(boardId, rev);
  `);

  return db;
}

// Reuse one connection across HMR cycles / module reloads.
const globalForDb = global as unknown as { _db?: Database.Database };
function getDb(): Database.Database {
  if (!globalForDb._db) globalForDb._db = init();
  return globalForDb._db;
}

// `next build` evaluates route/page modules (sometimes in parallel workers).
// Opening + migrating SQLite there caused SQLITE_BUSY and the build FS may be
// read-only — and the build never needs the DB. During the build phase we hand
// out a no-op proxy; the real connection is opened only at runtime.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

const db: Database.Database = isBuildPhase
  ? (new Proxy({}, { get: () => () => undefined }) as unknown as Database.Database)
  : getDb();

export default db;
