import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'whiteboard.db');

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    emailVerified INTEGER DEFAULT 0,
    verificationToken TEXT,
    tokenExpiry TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;