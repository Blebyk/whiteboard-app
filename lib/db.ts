// Конфигурация SQLite базы данных
import Database from 'better-sqlite3';
import path from 'path';

// Путь к файлу БД в корне проекта
const dbPath = path.join(process.cwd(), 'whiteboard.db');
const db = new Database(dbPath);

// Создание таблицы пользователей с полями для email верификации
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    emailVerified INTEGER DEFAULT 0,
    verificationToken TEXT,
    tokenExpiry DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

export default db;