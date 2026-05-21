import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'whiteboard.db');

// Singleton – reuse the same connection across HMR cycles in dev
const globalForDb = global as unknown as { _db?: Database.Database };
if (!globalForDb._db) {
  globalForDb._db = new Database(dbPath);
}
const db = globalForDb._db;

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

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

// Add bgStyle column if it doesn't exist yet (migration for existing DBs)
const boardCols = db.pragma('table_info(boards)') as { name: string }[];
if (!boardCols.map((c) => c.name).includes('bgStyle')) {
  db.exec("ALTER TABLE boards ADD COLUMN bgStyle TEXT NOT NULL DEFAULT 'dots'");
}

// Add reset password columns if they don't exist yet (migration for existing DBs)
const userCols = db.pragma('table_info(users)') as { name: string }[];
const colNames = userCols.map((c) => c.name);
if (!colNames.includes('resetToken')) {
  db.exec('ALTER TABLE users ADD COLUMN resetToken TEXT');
}
if (!colNames.includes('resetTokenExpiry')) {
  db.exec('ALTER TABLE users ADD COLUMN resetTokenExpiry DATETIME');
}


export default db;
