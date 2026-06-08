// Присутствие на доске: кто прямо сейчас её открыл. Состояние живёт в памяти
// процесса (как boardEvents) — оно эфемерное и переживает HMR через globalThis.
// Привязано к жизненному циклу SSE-соединения: открыли поток = пользователь
// онлайн, оборвалось = ушёл. Один Node-процесс — при multi-process деплое
// presence показывает только тех, кто подключён к этому же процессу.
//
// Несколько вкладок: у одного userId может быть несколько соединений; считаем
// человека онлайн, пока живо хотя бы одно из них.

export interface PresenceUser {
  id: number;
  name: string;
  color: string; // стабильный цвет аватара
  selection: string[]; // id объектов, которые пользователь сейчас выделил
}

interface Entry {
  id: number;
  name: string;
  color: string;
  conns: Map<string, number>; // connId → время последнего пинга (мс)
  selection: string[];
}

type Listener = (users: PresenceUser[]) => void;

const g = globalThis as unknown as {
  __boardPresence?: Map<number, Map<number, Entry>>;
  __presenceSubs?: Map<number, Set<Listener>>;
};
if (!g.__boardPresence) g.__boardPresence = new Map();
if (!g.__presenceSubs) g.__presenceSubs = new Map();
const store = g.__boardPresence;
const subs = g.__presenceSubs;

// Соединение считается мёртвым, если по нему давно не было пинга — страховка от
// «призраков», когда abort у SSE не сработал (например, при обрыве сети).
const TTL = 70_000;

// Палитра аватаров. Цвет выбирается по userId, поэтому стабилен для всех клиентов.
const PALETTE = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
export function colorForUser(userId: number): string {
  return PALETTE[Math.abs(userId) % PALETTE.length];
}

export function subscribePresence(boardId: number, fn: Listener): () => void {
  let set = subs.get(boardId);
  if (!set) { set = new Set(); subs.set(boardId, set); }
  set.add(fn);
  return () => {
    const s = subs.get(boardId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) subs.delete(boardId);
  };
}

// Рассылает актуальный список присутствующих всем подписчикам доски.
function notify(boardId: number): void {
  const set = subs.get(boardId);
  if (!set) return;
  const users = listPresence(boardId);
  for (const fn of set) { try { fn(users); } catch { /* игнорируем сбойный слушатель */ } }
}

// Регистрирует соединение пользователя и оповещает остальных.
export function joinPresence(boardId: number, user: { id: number; name: string }, connId: string): void {
  let board = store.get(boardId);
  if (!board) { board = new Map(); store.set(boardId, board); }
  let entry = board.get(user.id);
  if (!entry) {
    entry = { id: user.id, name: user.name, color: colorForUser(user.id), conns: new Map(), selection: [] };
    board.set(user.id, entry);
  } else {
    entry.name = user.name; // имя могло измениться между сессиями
  }
  entry.conns.set(connId, Date.now());
  notify(boardId);
}

// Продлевает жизнь соединения (вызывается на каждый SSE-пинг).
export function touchPresence(boardId: number, userId: number, connId: string): void {
  const entry = store.get(boardId)?.get(userId);
  if (entry && entry.conns.has(connId)) entry.conns.set(connId, Date.now());
}

// Обновляет текущее выделение пользователя и оповещает остальных, чтобы они
// подсветили эти объекты в его цвете. No-op, если пользователя ещё нет в presence.
export function setSelection(boardId: number, userId: number, selection: string[]): void {
  const entry = store.get(boardId)?.get(userId);
  if (!entry) return;
  entry.selection = selection;
  notify(boardId);
}

// Снимает соединение; если у пользователя их больше нет — убирает его и оповещает.
export function leavePresence(boardId: number, userId: number, connId: string): void {
  const board = store.get(boardId);
  const entry = board?.get(userId);
  if (!board || !entry) return;
  entry.conns.delete(connId);
  if (entry.conns.size === 0) board.delete(userId);
  if (board.size === 0) store.delete(boardId);
  notify(boardId);
}

// Текущий список присутствующих; попутно вычищает протухшие соединения.
export function listPresence(boardId: number): PresenceUser[] {
  const board = store.get(boardId);
  if (!board) return [];
  const now = Date.now();
  const out: PresenceUser[] = [];
  for (const [userId, entry] of board) {
    for (const [connId, seen] of entry.conns) {
      if (now - seen > TTL) entry.conns.delete(connId);
    }
    if (entry.conns.size === 0) { board.delete(userId); continue; }
    out.push({ id: entry.id, name: entry.name, color: entry.color, selection: entry.selection });
  }
  return out;
}
