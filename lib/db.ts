import Database from 'better-sqlite3';
import path from 'path';

// Путь к файлу БД настраивается, чтобы в продакшене он мог лежать на
// примонтированном диске (например, Railway Volume → DB_PATH=/data/whiteboard.db).
// По умолчанию — каталог проекта (для локальной разработки).
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'whiteboard.db');

// Открывает соединение и прогоняет идемпотентные миграции. Вызывается лениво в
// рантайме — никогда во время `next build` (см. ниже).
function init(): Database.Database {
  const db = new Database(dbPath);

  // WAL = лучше конкурентные чтения; busy_timeout гасит кратковременный SQLITE_BUSY.
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 10000');

  // Создаём все таблицы, если их ещё нет (безопасно запускать при каждом старте)
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

  // ── Миграции для существующих БД (идемпотентные) ──────────────
  const boardCols = (db.pragma('table_info(boards)') as { name: string }[]).map((c) => c.name);
  if (!boardCols.includes('bgStyle')) {
    db.exec("ALTER TABLE boards ADD COLUMN bgStyle TEXT NOT NULL DEFAULT 'dots'");
  }
  if (!boardCols.includes('updated_by')) {
    db.exec('ALTER TABLE boards ADD COLUMN updated_by INTEGER');
  }
  // `rev` = монотонный счётчик ревизий доски, используется как курсор синхронизации.
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

  // Одна строка на объект холста. `data` — JSON объекта Fabric (NULL при удалении —
  // хранится как «надгробие», чтобы соседи узнали об удалении). Каждое изменение
  // штампует новый `rev` доски, позволяя клиентам подтягивать только то, что
  // изменилось с момента их последней синхронизации.
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

// Переиспользуем одно соединение между HMR-циклами / перезагрузками модуля.
const globalForDb = global as unknown as { _db?: Database.Database };
function getDb(): Database.Database {
  if (!globalForDb._db) globalForDb._db = init();
  return globalForDb._db;
}

// `next build` исполняет модули роутов/страниц (иногда в параллельных воркерах).
// Открытие + миграции SQLite там вызывали SQLITE_BUSY, а файловая система сборки
// может быть только для чтения — при этом БД сборке не нужна вовсе. На этапе
// сборки отдаём no-op заглушку; реальное соединение открывается только в рантайме.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

const db: Database.Database = isBuildPhase
  ? (new Proxy({}, { get: () => () => undefined }) as unknown as Database.Database)
  : getDb();

export default db;
